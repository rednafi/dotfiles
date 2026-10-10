import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { type Config, paths } from "./config.ts";
import { pidAlive, readJson, sizeOf, writeJson } from "./fsutil.ts";
import { DAY_MS, FAILURE_STATUSES, isFinished, type Retention, type RunRecord, type RunStatus } from "./types.ts";

const RUN_ID_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)(?:-(\d+))?$/;

export function runIdFor(date: Date): string {
	return date.toISOString().replace(/:/g, "-").replace(".", "-");
}

/** Allocate a run id that does not collide with existing runs in `dir`. */
export function allocRunId(dir: string, date: Date): string {
	const base = runIdFor(date);
	let id = base;
	for (let n = 2; existsSync(join(dir, `${id}.json`)); n++) id = `${base}-${n}`;
	return id;
}

export function runIdTime(id: string): number {
	const m = RUN_ID_RE.exec(id);
	if (!m) return Number.NaN;
	const [date, time] = m[1].split("T");
	const [hh, mm, ss, ms] = time.replace("Z", "").split("-");
	return Date.parse(`${date}T${hh}:${mm}:${ss}.${ms}Z`);
}

export function runFiles(dir: string, id: string) {
	return { json: join(dir, `${id}.json`), md: join(dir, `${id}.md`), log: join(dir, `${id}.log`) };
}

/** A fresh "running" record with its files allocated in the job's run dir. */
export function newRecord(cfg: Config, name: string, now: Date, trigger: RunRecord["trigger"]): RunRecord {
	const dir = paths.runsFor(cfg, name);
	const runId = allocRunId(dir, now);
	const f = runFiles(dir, runId);
	return {
		job: name,
		runId,
		trigger,
		status: "running",
		pid: process.pid,
		attempts: 0,
		exitCode: null,
		timedOut: false,
		startedAt: now.toISOString(),
		outputPath: f.md,
		logPath: f.log,
		outputBytes: 0,
	};
}

export function writeRecord(cfg: Config, rec: RunRecord): void {
	writeJson(runFiles(paths.runsFor(cfg, rec.job), rec.runId).json, rec);
}

/** A "running" record whose process is gone was killed hard (SIGKILL, power loss). */
export function effectiveStatus(rec: RunRecord): RunStatus {
	return rec.status === "running" && !pidAlive(rec.pid) ? "crashed" : rec.status;
}

function readRecord(file: string): RunRecord | undefined {
	try {
		const rec = readJson<RunRecord>(file);
		if (rec) rec.status = effectiveStatus(rec);
		return rec;
	} catch {
		return undefined; // half-written or corrupt record: ignore
	}
}

/** Run ids (newest first) that have any file in the job's run dir. */
function runIds(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const ids = new Set<string>();
	for (const f of readdirSync(dir)) {
		const m = /^(.*)\.(json|md|log)$/.exec(f);
		if (m && RUN_ID_RE.test(m[1])) ids.add(m[1]);
	}
	return [...ids].sort().reverse();
}

/** Newest-first records, read lazily so callers can stop early. */
function* records(cfg: Config, name: string): Generator<RunRecord> {
	const dir = paths.runsFor(cfg, name);
	for (const id of runIds(dir)) {
		const rec = readRecord(runFiles(dir, id).json);
		if (rec) yield rec;
	}
}

export function listRuns(cfg: Config, name: string, limit = Infinity): RunRecord[] {
	const out: RunRecord[] = [];
	for (const r of records(cfg, name)) {
		if (out.length >= limit) break;
		out.push(r);
	}
	return out;
}

export function findRun(cfg: Config, name: string, pred: (r: RunRecord) => boolean): RunRecord | undefined {
	for (const r of records(cfg, name)) if (pred(r)) return r;
	return undefined;
}

export const latestRun = (cfg: Config, name: string) => findRun(cfg, name, () => true);
export const lastFinished = (cfg: Config, name: string) => findRun(cfg, name, (r) => isFinished(r.status));

/**
 * Delete runs older than `days` (failures get twice as long), but always keep
 * the newest `minRuns`. Then delete the oldest runs until the job fits in
 * `maxMB`, keeping at least one. Running runs are never deleted.
 */
export function pruneRuns(cfg: Config, name: string, ret: Retention, now: Date): { deleted: string[] } {
	const dir = paths.runsFor(cfg, name);
	const deleted: string[] = [];
	const del = (id: string) => {
		const f = runFiles(dir, id);
		for (const p of [f.json, f.md, f.log]) rmSync(p, { force: true });
		deleted.push(id);
	};
	const isRunning = (id: string) => readRecord(runFiles(dir, id).json)?.status === "running";
	const survivors: string[] = [];
	runIds(dir).forEach((id, idx) => {
		const ageDays = (now.getTime() - runIdTime(id)) / DAY_MS;
		// Only runs past the age limit need their record read.
		if (idx < ret.minRuns || ageDays <= ret.days) return void survivors.push(id);
		const rec = readRecord(runFiles(dir, id).json);
		const limit = ret.days * (rec && FAILURE_STATUSES.has(rec.status) ? 2 : 1);
		if (rec?.status === "running" || ageDays <= limit) survivors.push(id);
		else del(id);
	});
	const sizes = survivors.map((id) => Object.values(runFiles(dir, id)).reduce((sum, f) => sum + sizeOf(f), 0));
	let total = sizes.reduce((a, b) => a + b, 0);
	for (let i = survivors.length - 1; i >= 1 && total > ret.maxMB * 1024 * 1024; i--) {
		if (isRunning(survivors[i])) continue;
		del(survivors[i]);
		total -= sizes[i];
	}
	return { deleted };
}

// ---------- failure badge ----------

type State = { lastSeen?: string };

function readState(cfg: Config): State {
	try {
		return readJson<State>(paths.state(cfg)) ?? {};
	} catch {
		return {};
	}
}

export function markSeen(cfg: Config, at: Date): void {
	writeJson(paths.state(cfg), { ...readState(cfg), lastSeen: at.toISOString() });
}

export type Failure = { job: string; runId: string; status: RunStatus; endedAt: string };

/**
 * Failures since the user last opened /x-jobs. Only each job's latest finished
 * run counts, so a later success clears an earlier failure.
 */
export function unseenFailures(cfg: Config, jobNames: string[], now: Date): Failure[] {
	const seen = readState(cfg).lastSeen;
	const since = seen ? Date.parse(seen) : now.getTime() - 7 * DAY_MS;
	const out: Failure[] = [];
	for (const job of jobNames) {
		const r = lastFinished(cfg, job);
		if (!r || !FAILURE_STATUSES.has(r.status)) continue;
		const at = r.endedAt ?? r.startedAt;
		if (Date.parse(at) > since) out.push({ job, runId: r.runId, status: r.status, endedAt: at });
	}
	return out;
}
