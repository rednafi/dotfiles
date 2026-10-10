// Runs one job once. launchd calls this through bin/run-job.ts.
import { spawn } from "node:child_process";
import { appendFileSync, closeSync, existsSync, openSync, rmSync } from "node:fs";
import { type Config, ensureLayout, paths } from "./config.ts";
import { errMsg, readHead, readTail, sizeOf, sleep, tryLock } from "./fsutil.ts";
import { loadRegistry } from "./registry.ts";
import { newRecord, writeRecord } from "./runs.ts";
import { lastSlot } from "./schedule.ts";
import { sweep } from "./sweep.ts";
import type { Job, Registry, RunRecord } from "./types.ts";
import { validateName } from "./validate.ts";

export const ERROR_TAIL_BYTES = 2000;

export function piArgs(job: Job): string[] {
	const args = ["--no-session", "-p"];
	if (job.model) args.push("--model", job.model);
	if (job.thinking) args.push("--thinking", job.thinking);
	if (job.tools) args.push("--tools", job.tools.join(","));
	// "--" keeps a prompt that starts with "-" a prompt. pi still reads a
	// leading "@" as a file reference, so pad it with a space.
	args.push("--", job.prompt.startsWith("@") ? ` ${job.prompt}` : job.prompt);
	return args;
}

function notify(cfg: Config, title: string, message: string): Promise<void> {
	// Text goes in as argv, never spliced into AppleScript source.
	const args =
		cfg.notify === "osascript"
			? ["-e", "on run argv", "-e", "display notification (item 2 of argv) with title (item 1 of argv)", "-e", "end run", title, message]
			: [title, message];
	return new Promise((resolve) => {
		const p = spawn(cfg.notify, args, { stdio: "ignore", env: { ...process.env, ...cfg.passthroughEnv } });
		p.on("error", () => resolve());
		p.on("exit", () => resolve());
	});
}

export type RunOptions = {
	/** Replaces the retry delay (tests). */
	sleep?: (ms: number) => Promise<unknown>;
	/** Install SIGTERM/SIGINT handlers (bin entrypoint only). */
	handleSignals?: boolean;
};

export type RunOutcome = { exitCode: number; record?: RunRecord; message: string };

type Attempt = { code: number; timedOut: boolean; killed: boolean; spawnError?: string };

const log = (file: string, line: string) => appendFileSync(file, `[pi-jobs ${new Date().toISOString()}] ${line}\n`);

function runAttempt(cfg: Config, job: Job, rec: RunRecord, onKill: (kill: (() => void) | undefined) => void): Promise<Attempt> {
	return new Promise((resolve) => {
		const out = openSync(rec.outputPath, "w");
		const err = openSync(rec.logPath, "a");
		let timedOut = false;
		let killed = false;
		let settled = false;
		const child = spawn(cfg.piBin, piArgs(job), {
			cwd: job.cwd ?? paths.work(cfg),
			env: { ...process.env, ...cfg.passthroughEnv, PI_JOBS_CHILD: "1" },
			stdio: ["ignore", out, err],
			detached: true, // own process group, so a kill also reaches MCP servers and shells
		});
		const killGroup = (sig: NodeJS.Signals) => {
			try {
				if (child.pid) process.kill(-child.pid, sig);
			} catch {}
		};
		let grace: NodeJS.Timeout | undefined;
		const terminate = () => {
			killGroup("SIGTERM");
			grace = setTimeout(() => killGroup("SIGKILL"), cfg.killGraceMs);
		};
		const timer = setTimeout(() => {
			timedOut = true;
			terminate();
		}, job.timeoutSeconds * 1000);
		onKill(() => {
			killed = true;
			terminate();
		});
		const finish = (code: number, spawnError?: string) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			clearTimeout(grace);
			onKill(undefined);
			killGroup("SIGKILL"); // reap leftovers in the group, e.g. MCP stdio servers
			closeSync(out);
			closeSync(err);
			resolve({ code, timedOut, killed, spawnError });
		};
		child.on("error", (e) => finish(127, e.message));
		child.on("exit", (code, signal) => finish(timedOut ? 124 : (code ?? (signal === "SIGKILL" ? 137 : 143))));
	});
}

export async function runJob(cfg: Config, name: string, opts: RunOptions = {}): Promise<RunOutcome> {
	const nameProblems = validateName(name);
	if (nameProblems.length) return { exitCode: 2, message: nameProblems.join("; ") };
	ensureLayout(cfg);
	const now = cfg.now();
	const wait = opts.sleep ?? sleep;

	const finish = (rec: RunRecord, patch: Partial<RunRecord>) => {
		const end = new Date(Math.max(cfg.now().getTime(), now.getTime()));
		Object.assign(rec, patch, { endedAt: end.toISOString(), durationMs: end.getTime() - now.getTime() });
		writeRecord(cfg, rec);
		return rec;
	};
	const fail = (message: string): RunOutcome => ({
		exitCode: 2,
		message,
		record: finish(newRecord(cfg, name, now, "schedule"), { status: "error", message }),
	});

	let reg: Registry;
	let job: Job | undefined;
	try {
		reg = loadRegistry(cfg);
		job = reg.jobs[name];
	} catch (err) {
		const out = fail(errMsg(err));
		await notify(cfg, `pi job ${name} FAILED`, out.message);
		return out;
	}
	if (!job) return fail(`job ${name} is not in the registry`);
	if (!job.enabled) return { exitCode: 0, message: `job ${name} is disabled; nothing to do` };

	const marker = paths.manualMarker(cfg, name);
	const manual = existsSync(marker);
	if (manual) rmSync(marker, { force: true });
	const rec = newRecord(cfg, name, now, manual ? "manual" : "schedule");

	const release = tryLock(paths.runLock(cfg, name));
	if (!release) {
		finish(rec, { status: "skipped-locked", message: "previous run still in progress" });
		return { exitCode: 0, record: rec, message: "skipped: previous run still in progress" };
	}
	try {
		// launchd runs a missed calendar slot on wake. Skip it if it is too stale to be useful.
		if (!manual && "calendar" in job.schedule && job.maxLateMinutes > 0) {
			const slot = lastSlot(job.schedule.calendar, now);
			if (slot) {
				rec.scheduledFor = slot.toISOString();
				rec.lateMinutes = Math.floor((now.getTime() - slot.getTime()) / 60_000);
				if (rec.lateMinutes > job.maxLateMinutes) {
					const message = `scheduled for ${rec.scheduledFor}, ${rec.lateMinutes}m late (limit ${job.maxLateMinutes}m)`;
					finish(rec, { status: "skipped-late", message });
					return { exitCode: 0, record: rec, message };
				}
			}
		}

		writeRecord(cfg, rec);
		log(rec.logPath, `run ${rec.runId} trigger=${rec.trigger} pid=${process.pid}`);

		let kill: (() => void) | undefined;
		let interrupted = false;
		const onSignal = () => {
			interrupted = true;
			kill?.();
		};
		if (opts.handleSignals) {
			process.on("SIGTERM", onSignal);
			process.on("SIGINT", onSignal);
		}
		const maxAttempts = 1 + job.retries;
		let attempt: Attempt = { code: 1, timedOut: false, killed: false };
		let tailFrom = 0;
		try {
			for (let n = 1; n <= maxAttempts; n++) {
				rec.attempts = n;
				writeRecord(cfg, rec);
				tailFrom = sizeOf(rec.logPath);
				log(rec.logPath, `attempt ${n}/${maxAttempts}: ${cfg.piBin} (timeout ${job.timeoutSeconds}s)`);
				attempt = await runAttempt(cfg, job, rec, (k) => {
					kill = k;
				});
				if (attempt.spawnError) log(rec.logPath, `could not start ${cfg.piBin}: ${attempt.spawnError}`);
				if (attempt.timedOut) log(rec.logPath, `attempt ${n} timed out after ${job.timeoutSeconds}s`);
				log(rec.logPath, `attempt ${n} exited ${attempt.code}`);
				if (attempt.code === 0 || interrupted || attempt.killed || n === maxAttempts) break;
				const delay = cfg.retryDelays[Math.min(n - 1, cfg.retryDelays.length - 1)];
				log(rec.logPath, `retrying in ${delay}s`);
				await wait(delay * 1000);
				if (interrupted) break;
			}
		} finally {
			process.off("SIGTERM", onSignal);
			process.off("SIGINT", onSignal);
		}

		const status = interrupted || attempt.killed ? "killed" : attempt.code === 0 ? "ok" : attempt.timedOut ? "timeout" : "failed";
		const outputBytes = sizeOf(rec.outputPath);
		finish(rec, {
			status,
			exitCode: attempt.code,
			timedOut: attempt.timedOut,
			outputBytes,
			// Tail of the last attempt only.
			...(status !== "ok" && { errorTail: readTail(rec.logPath, Math.min(sizeOf(rec.logPath) - tailFrom, ERROR_TAIL_BYTES)) }),
		});

		const failed = status !== "ok";
		const mode = job.notify;
		if (mode === "always" || (failed && mode !== "never") || (mode === "output" && outputBytes > 0)) {
			const msg = failed
				? `${status} (exit ${attempt.code}) after ${rec.attempts} attempt(s)`
				: outputBytes > 0
					? readHead(rec.outputPath, 200).replace(/\s+/g, " ").trim()
					: "done (no output)";
			await notify(cfg, `pi job ${name}${failed ? " FAILED" : ""}`, msg);
		}
		return { exitCode: failed ? 1 : 0, record: rec, message: `${status} after ${rec.attempts} attempt(s)` };
	} finally {
		release();
		try {
			sweep(cfg, reg, cfg.now(), name);
		} catch {}
	}
}
