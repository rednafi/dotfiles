import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, describe, test } from "node:test";
import { loadConfig, paths } from "../../lib/config.ts";
import { pidAlive } from "../../lib/fsutil.ts";
import { emptyRegistry, saveRegistry } from "../../lib/registry.ts";
import { listRuns } from "../../lib/runs.ts";
import { ERROR_TAIL_BYTES, runJob } from "../../lib/runner.ts";
import type { RunRecord } from "../../lib/types.ts";
import { validateJob } from "../../lib/validate.ts";
import { type Env, makeEnv, waitFor } from "../helpers.ts";

let e: Env = makeEnv();
after(() => e.cleanup());
beforeEach(() => {
	e.cleanup();
	e = makeEnv();
});

const RUN_JOB = new URL("../../bin/run-job.ts", import.meta.url).pathname;

function seed(name: string, over: Record<string, unknown> = {}, regOver: Partial<ReturnType<typeof emptyRegistry>> = {}) {
	const reg = { ...emptyRegistry(), ...regOver };
	reg.jobs[name] = validateJob(
		{ prompt: "say hi", schedule: { intervalSeconds: 600 }, notify: "always", ...over },
		{ minInterval: 300, now: new Date() },
	);
	saveRegistry(e.cfg, reg);
	mkdirSync(paths.locks(e.cfg), { recursive: true });
}

const piArgsSeen = () => readFileSync(join(e.root, "fake-pi.args"), "utf8").split("\0").slice(0, -1);
const calls = () => (existsSync(join(e.root, "fake-pi.calls")) ? readFileSync(join(e.root, "fake-pi.calls"), "utf8").trim().split("\n").length : 0);
const run = (name: string, opts: Parameters<typeof runJob>[2] = {}, cfg = e.cfg) => runJob(cfg, name, opts);

describe("outcomes", () => {
	test("success writes output, record and notification", async () => {
		seed("ok");
		e.fakePi({ MODE: "ok" });
		const out = await run("ok");
		assert.equal(out.exitCode, 0);
		const r = out.record as RunRecord;
		assert.equal(r.status, "ok");
		assert.equal(r.attempts, 1);
		assert.equal(r.exitCode, 0);
		assert.equal(readFileSync(r.outputPath, "utf8"), "# report\nall good\n");
		assert.ok(r.durationMs !== undefined && r.endedAt);
		assert.equal(r.errorTail, undefined);
		assert.deepEqual(listRuns(e.cfg, "ok")[0], r);
		assert.deepEqual(e.notifications(), ["pi job ok|# report all good"]);
	});

	test("hard failure retries 1+retries times with backoff delays", async () => {
		seed("bad", { retries: 2 });
		e.fakePi({ MODE: "fail" });
		const delays: number[] = [];
		const cfg = loadConfig({ ...e.env, PI_JOBS_RETRY_DELAYS: "30,120" });
		const out = await run("bad", { sleep: async (ms) => void delays.push(ms) }, cfg);
		const r = out.record as RunRecord;
		assert.equal(out.exitCode, 1);
		assert.equal(r.status, "failed");
		assert.equal(r.attempts, 3);
		assert.equal(r.exitCode, 1);
		assert.deepEqual(delays, [30_000, 120_000]);
		assert.equal(calls(), 3);
		assert.match(r.errorTail ?? "", /boom: something broke/);
		assert.match(r.errorTail ?? "", /attempt 3\/3/);
		assert.doesNotMatch(r.errorTail ?? "", /attempt 1\/3/, "tail covers only the last attempt");
		assert.deepEqual(e.notifications(), ["pi job bad FAILED|failed (exit 1) after 3 attempt(s)"]);
	});

	test("delays beyond the list reuse the last delay", async () => {
		seed("d", { retries: 4 });
		e.fakePi({ MODE: "fail" });
		const delays: number[] = [];
		await run("d", { sleep: async (ms) => void delays.push(ms) }, loadConfig({ ...e.env, PI_JOBS_RETRY_DELAYS: "1,2" }));
		assert.deepEqual(delays, [1000, 2000, 2000, 2000]);
	});

	test("flaky job succeeds on attempt 3", async () => {
		seed("flaky", { retries: 2 });
		e.fakePi({ MODE: "flaky", FAIL_TIMES: 2 });
		const r = (await run("flaky")).record as RunRecord;
		assert.equal(r.status, "ok");
		assert.equal(r.attempts, 3);
		assert.equal(readFileSync(r.outputPath, "utf8"), "succeeded on call 3\n", "output is from the successful attempt");
	});

	test("retries: 0 means a single attempt", async () => {
		seed("once", { retries: 0 });
		e.fakePi({ MODE: "fail" });
		assert.equal(((await run("once")).record as RunRecord).attempts, 1);
	});

	test("timeout kills the whole process group", async () => {
		seed("hang", { timeoutSeconds: 1, retries: 0 });
		e.fakePi({ MODE: "hang" });
		const t0 = Date.now();
		const r = (await run("hang")).record as RunRecord;
		assert.equal(r.status, "timeout");
		assert.equal(r.exitCode, 124);
		assert.equal(r.timedOut, true);
		assert.ok(Date.now() - t0 < 5000);
		const grandchild = Number(readFileSync(join(e.root, "fake-pi.child"), "utf8"));
		await waitFor(() => !pidAlive(grandchild), 3000);
	});

	test("timeout escalates to SIGKILL when TERM is ignored", async () => {
		seed("stubborn", { timeoutSeconds: 1, retries: 0 });
		e.fakePi({ MODE: "hang-ignore-term" });
		const r = (await run("stubborn")).record as RunRecord;
		assert.equal(r.status, "timeout");
		const pid = Number(readFileSync(join(e.root, "fake-pi.pid"), "utf8"));
		await waitFor(() => !pidAlive(pid), 3000);
	});

	test("50 MB of output is streamed to disk; error tail stays capped", async () => {
		seed("big", { retries: 0 });
		e.fakePi({ MODE: "big", MB: 50 });
		const r = (await run("big")).record as RunRecord;
		assert.equal(r.status, "failed");
		assert.equal(r.outputBytes, 50 * 1024 * 1024);
		assert.ok(Buffer.byteLength(r.errorTail ?? "") <= ERROR_TAIL_BYTES);
		assert.match(r.errorTail ?? "", /last error line/);
		assert.ok(readFileSync(join(paths.runsFor(e.cfg, "big"), `${r.runId}.json`)).length < 10_000, "record stays small");
	});

	test("empty output is ok", async () => {
		seed("empty");
		e.fakePi({ MODE: "empty" });
		const r = (await run("empty")).record as RunRecord;
		assert.equal(r.status, "ok");
		assert.equal(r.outputBytes, 0);
		assert.deepEqual(e.notifications(), ["pi job empty|done (no output)"]);
	});

	test("unicode output survives", async () => {
		seed("u");
		e.fakePi({ MODE: "unicode" });
		const r = (await run("u")).record as RunRecord;
		assert.equal(readFileSync(r.outputPath, "utf8"), "✓ héllo 🎉 — ok\n");
	});

	test("missing pi binary fails cleanly with exit 127", async () => {
		seed("nopi", { retries: 1 });
		const r = (await run("nopi", {}, loadConfig({ ...e.env, PI_JOBS_PI_BIN: "/nonexistent/pi" }))).record as RunRecord;
		assert.equal(r.status, "failed");
		assert.equal(r.exitCode, 127);
		assert.equal(r.attempts, 2);
		assert.match(r.errorTail ?? "", /could not start \/nonexistent\/pi/);
	});
});

describe("arguments and environment", () => {
	test("hostile prompt reaches pi byte-for-byte, nothing executes", async () => {
		const prompt = `"; touch ${e.root}/pwned; echo $(whoami) \`id\` 'q' \n🎉 & <x> $HOME`;
		seed("h", { prompt });
		e.fakePi({ MODE: "ok" });
		await run("h");
		assert.deepEqual(piArgsSeen(), ["--no-session", "-p", "--", prompt]);
		assert.equal(existsSync(join(e.root, "pwned")), false);
	});
	test("prompt starting with '-' stays a prompt (after --)", async () => {
		seed("dash", { prompt: "--help me" });
		e.fakePi({ MODE: "ok" });
		await run("dash");
		assert.deepEqual(piArgsSeen().slice(-2), ["--", "--help me"]);
	});
	test("prompt starting with '@' is not read as a file", async () => {
		seed("at", { prompt: "@channel summary" });
		e.fakePi({ MODE: "ok" });
		await run("at");
		assert.equal(piArgsSeen().at(-1), " @channel summary");
	});
	test("model, thinking and tools are passed", async () => {
		seed("m", { model: "sonnet", thinking: "low", tools: ["read", "codemode", "mcp__slack__*"] });
		e.fakePi({ MODE: "ok" });
		await run("m");
		assert.deepEqual(piArgsSeen(), ["--no-session", "-p", "--model", "sonnet", "--thinking", "low", "--tools", "read,codemode,mcp__slack__*", "--", "say hi"]);
	});
	test("PI_JOBS_CHILD=1 recursion guard and default cwd", async () => {
		seed("env");
		e.fakePi({ MODE: "env" });
		const r = (await run("env")).record as RunRecord;
		const out = readFileSync(r.outputPath, "utf8");
		assert.match(out, /^CHILD=1$/m);
		assert.match(out, new RegExp(`^CWD=(/private)?${paths.work(e.cfg)}$`, "m"));
	});
	test("custom cwd", async () => {
		const d = mkdtempSync(join(tmpdir(), "cwd-"));
		seed("cwd", { cwd: d });
		e.fakePi({ MODE: "env" });
		const r = (await run("cwd")).record as RunRecord;
		assert.match(readFileSync(r.outputPath, "utf8"), new RegExp(`^CWD=(/private)?${d}$`, "m"));
	});
	test("works with launchd's bare environment (bin entrypoint)", async () => {
		seed("bare");
		e.fakePi({ MODE: "env" });
		const env: Record<string, string> = { PATH: "/usr/bin:/bin" };
		for (const [k, v] of Object.entries(e.env)) if (k.startsWith("PI_JOBS_")) env[k] = v;
		const code = await new Promise((res) => spawn(process.execPath, [RUN_JOB, "bare"], { env, stdio: "ignore" }).on("exit", res));
		assert.equal(code, 0);
		assert.equal(listRuns(e.cfg, "bare")[0].status, "ok");
	});
});

describe("notify modes", () => {
	const matrix: [string, string, number][] = [
		["always", "ok", 1],
		["always", "fail", 1],
		["always", "empty", 1],
		["failure", "ok", 0],
		["failure", "fail", 1],
		["output", "ok", 1],
		["output", "empty", 0],
		["output", "fail", 1],
		["never", "ok", 0],
		["never", "fail", 0],
	];
	for (const [notify, mode, expected] of matrix) {
		test(`notify=${notify} pi=${mode} -> ${expected}`, async () => {
			seed("n", { notify, retries: 0 });
			e.fakePi({ MODE: mode });
			await run("n");
			assert.equal(e.notifications().length, expected);
		});
	}
});

describe("guards", () => {
	test("invalid name: exit 2 and nothing written", async () => {
		const out = await run("../../etc");
		assert.equal(out.exitCode, 2);
		assert.equal(existsSync(paths.runs(e.cfg)), false);
	});
	test("job not in registry: error record, exit 2", async () => {
		saveRegistry(e.cfg, emptyRegistry());
		const out = await run("ghost");
		assert.equal(out.exitCode, 2);
		assert.equal(out.record?.status, "error");
		assert.match(out.record?.message ?? "", /not in the registry/);
	});
	test("corrupt registry: error record and failure notification", async () => {
		writeFileSync(paths.registry(e.cfg), "{oops");
		const out = await run("any");
		assert.equal(out.record?.status, "error");
		assert.match(out.record?.message ?? "", /not valid JSON/);
		assert.equal(e.notifications().length, 1);
	});
	test("disabled job is a no-op", async () => {
		seed("off", { enabled: false });
		const out = await run("off");
		assert.equal(out.exitCode, 0);
		assert.deepEqual(listRuns(e.cfg, "off"), []);
		assert.equal(calls(), 0);
	});
	test("overlapping run is skipped while the lock is held by a live process", async () => {
		seed("lock");
		e.fakePi({ MODE: "ok" });
		writeFileSync(paths.runLock(e.cfg, "lock"), String(process.ppid));
		const out = await run("lock");
		assert.equal(out.record?.status, "skipped-locked");
		assert.equal(calls(), 0);
	});
	test("stale lock from a dead runner is taken over", async () => {
		seed("stale");
		e.fakePi({ MODE: "ok" });
		writeFileSync(paths.runLock(e.cfg, "stale"), "999999");
		assert.equal((await run("stale")).record?.status, "ok");
		assert.equal(existsSync(paths.runLock(e.cfg, "stale")), false, "lock released");
	});
});

describe("missed-run policy", () => {
	// Mon 2025-06-02 08:45 local (TZ fixed by the test script).
	const slot = new Date(2025, 5, 2, 8, 45);
	const at = (minutesLate: number) => loadConfig({ ...e.env, PI_JOBS_NOW: new Date(slot.getTime() + minutesLate * 60_000).toISOString() });
	const cal = { schedule: { calendar: [{ Weekday: 1, Hour: 8, Minute: 45 }] } };

	test("on time runs", async () => {
		seed("s", cal);
		e.fakePi({ MODE: "ok" });
		const r = (await run("s", {}, at(0))).record as RunRecord;
		assert.equal(r.status, "ok");
		assert.equal(r.lateMinutes, 0);
		assert.equal(r.scheduledFor, slot.toISOString());
	});
	test("60m late (within 120) runs", async () => {
		seed("s", cal);
		e.fakePi({ MODE: "ok" });
		assert.equal((await run("s", {}, at(60))).record?.status, "ok");
	});
	test("180m late is skipped and pi is not called", async () => {
		seed("s", cal);
		e.fakePi({ MODE: "ok" });
		const r = (await run("s", {}, at(180))).record as RunRecord;
		assert.equal(r.status, "skipped-late");
		assert.equal(r.lateMinutes, 180);
		assert.equal(calls(), 0);
		assert.equal(e.notifications().length, 0);
	});
	test("maxLateMinutes 0 always runs", async () => {
		seed("s", { ...cal, maxLateMinutes: 0 });
		e.fakePi({ MODE: "ok" });
		assert.equal((await run("s", {}, at(3000))).record?.status, "ok");
	});
	test("manual trigger marker bypasses the policy and is consumed", async () => {
		seed("s", cal);
		e.fakePi({ MODE: "ok" });
		writeFileSync(paths.manualMarker(e.cfg, "s"), "x");
		const r = (await run("s", {}, at(500))).record as RunRecord;
		assert.equal(r.status, "ok");
		assert.equal(r.trigger, "manual");
		assert.equal(existsSync(paths.manualMarker(e.cfg, "s")), false);
	});
	test("interval jobs are never skipped", async () => {
		seed("i");
		e.fakePi({ MODE: "ok" });
		assert.equal((await run("i", {}, at(9999))).record?.status, "ok");
	});
});

describe("signals and crashes (bin entrypoint)", () => {
	const startRunner = (name: string) => spawn(process.execPath, [RUN_JOB, name], { env: { ...process.env, ...e.env }, stdio: "ignore" });

	test("SIGTERM (launchd bootout) kills pi and records 'killed'", async () => {
		seed("t", { timeoutSeconds: 60 });
		e.fakePi({ MODE: "hang" });
		const child = startRunner("t");
		const piPid = await waitFor(() => existsSync(join(e.root, "fake-pi.pid")) && Number(readFileSync(join(e.root, "fake-pi.pid"), "utf8")));
		child.kill("SIGTERM");
		const code = await new Promise((r) => child.on("exit", r));
		assert.equal(code, 1);
		const r = listRuns(e.cfg, "t")[0];
		assert.equal(r.status, "killed");
		assert.equal(r.attempts, 1, "no retry after being killed");
		await waitFor(() => !pidAlive(piPid), 3000);
		assert.equal(existsSync(paths.runLock(e.cfg, "t")), false);
	});

	test("SIGKILL of the runner leaves a record that reads as crashed", async () => {
		seed("k", { timeoutSeconds: 60 });
		e.fakePi({ MODE: "hang" });
		const child = startRunner("k");
		const piPid = await waitFor(() => existsSync(join(e.root, "fake-pi.pid")) && Number(readFileSync(join(e.root, "fake-pi.pid"), "utf8")));
		child.kill("SIGKILL");
		await new Promise((r) => child.on("exit", r));
		// pi is in its own group and survives the runner; launchd would reap it, we do it here.
		try {
			process.kill(-piPid, "SIGKILL");
		} catch {}
		assert.equal(listRuns(e.cfg, "k")[0].status, "crashed");
		// The next run takes over the dead runner's lock.
		e.fakePi({ MODE: "ok" });
		assert.equal((await run("k")).record?.status, "ok");
	});
});

describe("sweep after each run", () => {
	const old = (name: string, daysAgo: number) => {
		const dir = paths.runsFor(e.cfg, name);
		mkdirSync(dir, { recursive: true });
		const id = new Date(Date.now() - daysAgo * 86_400_000).toISOString().replace(/:/g, "-").replace(".", "-");
		writeFileSync(join(dir, `${id}.json`), JSON.stringify({ status: "ok", pid: 1, startedAt: "" }));
		return dir;
	};
	test("prunes other jobs too: paused and removed ones", async () => {
		seed("active");
		const reg = JSON.parse(readFileSync(paths.registry(e.cfg), "utf8"));
		reg.jobs.paused = { ...reg.jobs.active, enabled: false, retention: { days: 1, minRuns: 1, maxMB: 50 } };
		saveRegistry(e.cfg, reg);
		for (const d of [10, 11, 12]) old("paused", d);
		const removedDir = old("removed", 400); // not in registry, default retention keeps minRuns=5
		e.fakePi({ MODE: "ok" });
		rmSync(paths.sweepStamp(e.cfg), { force: true });
		await run("active");
		assert.equal(readdirSync(paths.runsFor(e.cfg, "paused")).length, 1, "paused job pruned to minRuns");
		assert.ok(existsSync(removedDir), "removed job keeps its last runs (minRuns)");
	});
	test("removed job dirs disappear once empty; stale locks and old markers go", async () => {
		seed("active");
		mkdirSync(paths.runsFor(e.cfg, "gone"), { recursive: true });
		writeFileSync(paths.runLock(e.cfg, "dead"), "999999");
		writeFileSync(paths.runLock(e.cfg, "live"), String(process.pid));
		writeFileSync(paths.manualMarker(e.cfg, "fresh"), "x");
		e.fakePi({ MODE: "ok" });
		rmSync(paths.sweepStamp(e.cfg), { force: true });
		await run("active");
		assert.equal(existsSync(paths.runsFor(e.cfg, "gone")), false);
		assert.equal(existsSync(paths.runLock(e.cfg, "dead")), false);
		assert.ok(existsSync(paths.runLock(e.cfg, "live")));
		assert.ok(existsSync(paths.manualMarker(e.cfg, "fresh")));
	});
	test("launchd log stays empty on success, gets one line on failure", async () => {
		seed("quiet", { retries: 0 });
		const env: Record<string, string> = { PATH: "/usr/bin:/bin" };
		for (const [k, v] of Object.entries(e.env)) if (k.startsWith("PI_JOBS_")) env[k] = v;
		const runBin = async () => {
			let out = "";
			const c = spawn(process.execPath, [RUN_JOB, "quiet"], { env });
			c.stdout.on("data", (d) => (out += d));
			c.stderr.on("data", (d) => (out += d));
			await new Promise((r) => c.on("exit", r));
			return out;
		};
		e.fakePi({ MODE: "ok" });
		assert.equal(await runBin(), "");
		e.fakePi({ MODE: "fail" });
		assert.match(await runBin(), /^\[.*\] quiet: failed after 1 attempt\(s\)\n$/);
	});
});

describe("sweep cadence", () => {
	test("full sweep runs at most once a day; the ran job is always pruned", async () => {
		seed("cad", { retention: { days: 1, minRuns: 1, maxMB: 50 } });
		e.fakePi({ MODE: "ok" });
		await run("cad"); // first run: stamp created
		const t1 = statSync(paths.sweepStamp(e.cfg)).mtimeMs;
		await run("cad");
		assert.equal(statSync(paths.sweepStamp(e.cfg)).mtimeMs, t1, "no second sweep within a day");
		const old = new Date(Date.now() - 2 * 86_400_000);
		utimesSync(paths.sweepStamp(e.cfg), old, old);
		await run("cad");
		assert.ok(statSync(paths.sweepStamp(e.cfg)).mtimeMs > old.getTime() + 1000, "sweep ran again after a day");
	});
});

describe("retention during runs", () => {
	test("each run prunes its own job", async () => {
		seed("ret", { retention: { days: 1, minRuns: 3, maxMB: 50 } });
		e.fakePi({ MODE: "ok" });
		for (let d = 10; d < 15; d++) await run("ret", {}, loadConfig({ ...e.env, PI_JOBS_NOW: new Date(Date.now() - d * 86_400_000).toISOString() }));
		await run("ret");
		const files = readdirSync(paths.runsFor(e.cfg, "ret")).filter((f) => f.endsWith(".json"));
		assert.equal(files.length, 3);
	});
});
