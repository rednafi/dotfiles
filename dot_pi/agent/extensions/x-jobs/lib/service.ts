// Actions behind the `jobs` tool. jobs.json is the source of truth: plists
// are generated from it, and launchd is brought in line with it.
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { type Config, ensureLayout, paths } from "./config.ts";
import { type Drift, type DriftIssue, diffState, fixFor } from "./drift.ts";
import { atomicWrite, errMsg, readHead, sleep, withLock } from "./fsutil.ts";
import { bootout, bootstrap, kickstart, listLoaded } from "./launchd.ts";
import { lintPlist, renderJobPlist } from "./plist.ts";
import { loadRegistry, saveRegistry } from "./registry.ts";
import { type Failure, findRun, latestRun, listRuns, markSeen, unseenFailures } from "./runs.ts";
import { humanizeSchedule, nextRun } from "./schedule.ts";
import { isFinished, isSkipped, type Job, type Registry, type RunRecord } from "./types.ts";
import { requireName, validateJob } from "./validate.ts";

export class JobError extends Error {}

export type JobSummary = {
	name: string;
	enabled: boolean;
	schedule: string;
	running: boolean;
	lastRun?: Pick<RunRecord, "runId" | "status" | "startedAt" | "endedAt" | "exitCode">;
	nextRun?: string;
	drift: DriftIssue[];
	prompt: string;
};

export type ChangeResult = { name: string; dryRun?: boolean; job?: Job; schedule?: string; reload?: boolean; warning?: string };
export type RemoveResult = { name: string; dryRun?: boolean; removed?: boolean; purged: boolean };
export type RunResult = { name: string; dryRun?: boolean; started: boolean; record?: RunRecord; note?: string };
export type LogsResult = { name: string; runs: RunRecord[]; latestOutput?: string; latestOutputPath?: string; launchdLog: string };
export type SyncResult = { fixed: Record<string, string>; errors: Record<string, string> };

type Loaded = Map<string, number | null>;

const readIfExists = (file: string) => (existsSync(file) ? readFileSync(file, "utf8") : undefined);

/** Write the plist atomically, refusing to install one that fails plutil -lint. */
function writePlist(cfg: Config, name: string, content: string): void {
	try {
		atomicWrite(paths.plist(cfg, name), content, (tmp) => lintPlist(cfg, tmp));
	} catch (err) {
		throw new JobError(`generated plist failed plutil -lint: ${errMsg(err)}`);
	}
}

async function load(cfg: Config, name: string, content: string): Promise<void> {
	writePlist(cfg, name, content);
	await bootstrap(cfg, paths.plist(cfg, name), paths.label(cfg, name));
}

async function unload(cfg: Config, name: string): Promise<void> {
	await bootout(cfg, paths.label(cfg, name));
	rmSync(paths.plist(cfg, name), { force: true });
}

/** Put a job's plist and launchd state back the way they were after a failed change. */
async function restore(cfg: Config, name: string, prevPlist: string | undefined, wasLoaded: boolean): Promise<void> {
	try {
		if (prevPlist === undefined) return await unload(cfg, name);
		atomicWrite(paths.plist(cfg, name), prevPlist);
		if (wasLoaded) await bootstrap(cfg, paths.plist(cfg, name), paths.label(cfg, name));
		else await bootout(cfg, paths.label(cfg, name));
	} catch {} // best effort; list/sync will show what is left
}

function plistsOnDisk(cfg: Config): Map<string, string> {
	const out = new Map<string, string>();
	for (const f of existsSync(cfg.agentsDir) ? readdirSync(cfg.agentsDir) : []) {
		const name = f.endsWith(".plist") ? paths.nameOf(cfg, f) : undefined;
		if (name) out.set(name, readFileSync(join(cfg.agentsDir, f), "utf8"));
	}
	return out;
}

export class Service {
	readonly cfg: Config;
	constructor(cfg: Config) {
		this.cfg = cfg;
	}

	private lock<T>(fn: () => Promise<T>): Promise<T> {
		ensureLayout(this.cfg);
		return withLock(paths.registryLock(this.cfg), fn, 30_000);
	}

	private validate(input: unknown, existing?: Job): Job {
		return validateJob(input, { minInterval: this.cfg.minInterval, now: this.cfg.now(), existing });
	}

	/**
	 * Save `next` (undefined deletes the job), then apply the launchd change.
	 * If launchd fails, the registry and plist go back to how they were.
	 */
	private async commit(reg: Registry, name: string, next: Job | undefined, loaded: Loaded, apply: () => Promise<void>): Promise<void> {
		const prevJob = reg.jobs[name];
		const prevPlist = readIfExists(paths.plist(this.cfg, name));
		if (next) reg.jobs[name] = next;
		else delete reg.jobs[name];
		saveRegistry(this.cfg, reg);
		try {
			await apply();
		} catch (err) {
			if (prevJob) reg.jobs[name] = prevJob;
			else delete reg.jobs[name];
			saveRegistry(this.cfg, reg);
			await restore(this.cfg, name, prevPlist, loaded.has(name));
			throw err;
		}
	}

	async add(name: unknown, input: Record<string, unknown>): Promise<ChangeResult> {
		const n = requireName(name);
		const job = this.validate(input);
		return this.lock(async () => {
			const reg = loadRegistry(this.cfg);
			if (reg.jobs[n]) throw new JobError(`job ${n} already exists; use update`);
			const schedule = humanizeSchedule(job.schedule);
			if (this.cfg.dryRun) return { dryRun: true, name: n, job, schedule };
			const plist = renderJobPlist(this.cfg, reg, n, job);
			await this.commit(reg, n, job, await listLoaded(this.cfg), () => load(this.cfg, n, plist));
			return { name: n, job, schedule };
		});
	}

	async update(name: unknown, patch: Record<string, unknown>): Promise<ChangeResult> {
		const n = requireName(name);
		if (!Object.keys(patch).length) throw new JobError("update needs at least one field to change");
		return this.lock(async () => {
			const reg = loadRegistry(this.cfg);
			const old = reg.jobs[n];
			if (!old) throw new JobError(`no job named ${n}`);
			const job = this.validate(patch, old);
			const oldPlist = old.enabled ? renderJobPlist(this.cfg, reg, n, old) : undefined;
			const newPlist = job.enabled ? renderJobPlist(this.cfg, reg, n, job) : undefined;
			const reload = newPlist !== oldPlist;
			const schedule = humanizeSchedule(job.schedule);
			if (this.cfg.dryRun) return { dryRun: true, name: n, job, reload, schedule };
			const loaded = await listLoaded(this.cfg);
			const interrupted = reload && loaded.get(n) != null;
			await this.commit(reg, n, job, loaded, async () => {
				if (!reload) return;
				if (newPlist) await load(this.cfg, n, newPlist);
				else await unload(this.cfg, n);
			});
			return { name: n, job, reload, schedule, warning: interrupted ? "a run was in progress and was stopped by the reload" : undefined };
		});
	}

	pause(name: unknown) {
		return this.update(name, { enabled: false });
	}

	resume(name: unknown) {
		return this.update(name, { enabled: true });
	}

	async remove(name: unknown, purge = false): Promise<RemoveResult> {
		const n = requireName(name);
		return this.lock(async () => {
			const reg = loadRegistry(this.cfg);
			const existed = Boolean(reg.jobs[n]);
			const loaded = await listLoaded(this.cfg);
			const leftovers = existsSync(paths.plist(this.cfg, n)) || loaded.has(n) || (purge && existsSync(paths.runsFor(this.cfg, n)));
			if (!existed && !leftovers) throw new JobError(`no job named ${n}`);
			if (this.cfg.dryRun) return { dryRun: true, name: n, purged: purge };
			await unload(this.cfg, n);
			if (existed) {
				delete reg.jobs[n];
				saveRegistry(this.cfg, reg);
			}
			if (purge) {
				for (const p of [paths.runsFor(this.cfg, n), paths.launchdLog(this.cfg, n), paths.manualMarker(this.cfg, n)]) {
					rmSync(p, { recursive: true, force: true });
				}
			}
			return { name: n, removed: existed, purged: purge };
		});
	}

	/** Start a run now through launchd. With `wait`, block until it finishes. */
	async run(name: unknown, opts: { wait?: boolean; signal?: AbortSignal } = {}): Promise<RunResult> {
		const n = requireName(name);
		const job = loadRegistry(this.cfg).jobs[n];
		if (!job) throw new JobError(`no job named ${n}`);
		if (!job.enabled) throw new JobError(`job ${n} is paused; resume it first`);
		if (this.cfg.dryRun) return { dryRun: true, name: n, started: false };
		const loaded = await listLoaded(this.cfg);
		if (!loaded.has(n)) throw new JobError(`job ${n} is not loaded in launchd; run sync`);
		if (loaded.get(n) != null) throw new JobError(`job ${n} is already running (pid ${loaded.get(n)})`);
		const before = latestRun(this.cfg, n)?.runId;
		atomicWrite(paths.manualMarker(this.cfg, n), new Date().toISOString());
		try {
			await kickstart(this.cfg, paths.label(this.cfg, n));
		} catch (err) {
			rmSync(paths.manualMarker(this.cfg, n), { force: true });
			throw err;
		}
		if (!opts.wait) return { name: n, started: true };
		const budget = Math.min(job.timeoutSeconds * 1000 * (job.retries + 1) + 60_000, 30 * 60_000);
		const deadline = Date.now() + budget;
		while (Date.now() < deadline) {
			if (opts.signal?.aborted) return { name: n, started: true, note: "stopped waiting (aborted); the run continues" };
			const r = latestRun(this.cfg, n);
			if (r && r.runId !== before && r.status !== "running") return { name: n, started: true, record: r };
			await sleep(500);
		}
		return { name: n, started: true, note: `still running after ${Math.round(budget / 1000)}s` };
	}

	async logs(name: unknown, count = 5): Promise<LogsResult> {
		const n = requireName(name);
		const runs = listRuns(this.cfg, n, Math.max(1, Math.min(count, 50)));
		if (!runs.length && !loadRegistry(this.cfg).jobs[n]) throw new JobError(`no job named ${n} and no run history`);
		const latest = runs.find((r) => !isSkipped(r.status));
		return {
			name: n,
			runs,
			latestOutput: latest && readHead(latest.outputPath, 4000),
			latestOutputPath: latest?.outputPath,
			launchdLog: paths.launchdLog(this.cfg, n),
		};
	}

	async drift(): Promise<{ drift: Drift; reg: Registry; loaded: Loaded }> {
		const reg = loadRegistry(this.cfg);
		const registry = new Map<string, string | null>();
		for (const [n, j] of Object.entries(reg.jobs)) registry.set(n, j.enabled ? renderJobPlist(this.cfg, reg, n, j) : null);
		const loaded = await listLoaded(this.cfg);
		return { drift: diffState({ registry, disk: plistsOnDisk(this.cfg), loaded: new Set(loaded.keys()) }), reg, loaded };
	}

	async list(): Promise<{ jobs: JobSummary[]; orphans: string[] }> {
		const { drift, reg, loaded } = await this.drift();
		const now = this.cfg.now();
		const jobs = Object.entries(reg.jobs)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([name, job]): JobSummary => {
				const newest = latestRun(this.cfg, name);
				const last = newest && isFinished(newest.status) ? newest : findRun(this.cfg, name, (r) => isFinished(r.status));
				const next = job.enabled ? nextRun(job.schedule, now, newest && new Date(newest.startedAt)) : undefined;
				return {
					name,
					enabled: job.enabled,
					schedule: humanizeSchedule(job.schedule),
					running: loaded.get(name) != null || newest?.status === "running",
					lastRun: last && { runId: last.runId, status: last.status, startedAt: last.startedAt, endedAt: last.endedAt, exitCode: last.exitCode },
					nextRun: next?.toISOString(),
					drift: drift.get(name) ?? [],
					prompt: job.prompt.length > 120 ? `${job.prompt.slice(0, 117)}...` : job.prompt,
				};
			});
		const orphans = [...drift.entries()].filter(([, i]) => i.includes("orphan")).map(([n]) => n);
		return { jobs, orphans };
	}

	async sync(): Promise<SyncResult> {
		return this.lock(async () => {
			const { drift, reg } = await this.drift();
			const fixed: Record<string, string> = {};
			const errors: Record<string, string> = {};
			for (const [name, issues] of drift) {
				const action = fixFor(issues);
				if (this.cfg.dryRun) {
					fixed[name] = `${action} (dry run)`;
					continue;
				}
				try {
					const job = reg.jobs[name];
					if (action === "reload" && job) await load(this.cfg, name, renderJobPlist(this.cfg, reg, name, job));
					else if (action === "unload") await unload(this.cfg, name);
					fixed[name] = `${action}: ${issues.join(", ")}`;
				} catch (err) {
					errors[name] = errMsg(err);
				}
			}
			return { fixed, errors };
		});
	}

	/** Job names, or [] when the registry cannot be read (badge and completions must not throw). */
	names(): string[] {
		try {
			return Object.keys(loadRegistry(this.cfg).jobs);
		} catch {
			return [];
		}
	}

	failures(): Failure[] {
		return unseenFailures(this.cfg, this.names(), this.cfg.now());
	}

	markSeen(): void {
		markSeen(this.cfg, this.cfg.now());
	}
}
