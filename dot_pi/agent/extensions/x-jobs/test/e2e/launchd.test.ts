// Real launchd, fake pi. Opt in with PI_JOBS_E2E=1 (npm run e2e). Every label
// uses the com.rednafi.pi.jobtest prefix and plists live in a temp dir, so
// real jobs are never touched and nothing autoloads at login.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import { executeAction, type ActionParams } from "../../lib/actions.ts";
import { paths } from "../../lib/config.ts";
import { listRuns } from "../../lib/runs.ts";
import { Service } from "../../lib/service.ts";
import type { RunRecord } from "../../lib/types.ts";
import { type Env, makeEnv, sleep, waitFor } from "../helpers.ts";

const enabled = process.env.PI_JOBS_E2E === "1" && process.platform === "darwin";
const PREFIX = "com.rednafi.pi.jobtest";
const uid = process.getuid?.() ?? 0;

function cleanupLaunchd(): void {
	const list = execFileSync("launchctl", ["list"]).toString();
	for (const line of list.split("\n")) {
		const label = line.split("\t")[2];
		if (label?.startsWith(`${PREFIX}.`)) {
			try {
				execFileSync("launchctl", ["bootout", `gui/${uid}/${label}`], { stdio: "ignore" });
			} catch {}
		}
	}
}

describe("real launchd", { skip: !enabled && "set PI_JOBS_E2E=1 on macOS" }, () => {
	let e: Env;
	let svc: Service;
	const act = (p: ActionParams) => executeAction(svc, p);
	const runs = (n: string) => listRuns(e.cfg, n).filter((r) => r.status !== "running");
	const isLoaded = (n: string) => {
		try {
			execFileSync("launchctl", ["print", `gui/${uid}/${PREFIX}.${n}`], { stdio: "ignore" });
			return true;
		} catch {
			return false;
		}
	};

	before(() => {
		cleanupLaunchd();
		e = makeEnv({ PI_JOBS_LAUNCHCTL: "launchctl", PI_JOBS_LABEL_PREFIX: PREFIX, PI_JOBS_MIN_INTERVAL: "10" });
		svc = new Service(e.cfg);
	});
	after(() => {
		cleanupLaunchd();
		e.cleanup();
	});

	test("interval job fires repeatedly under launchd's environment", async () => {
		e.fakePi({ MODE: "env" });
		const r = await act({ action: "add", name: "tick", prompt: "x", schedule: { intervalSeconds: 10 }, notify: "never" });
		assert.equal(r.isError, false, r.text);
		assert.ok(isLoaded("tick"));
		const done = await waitFor(() => runs("tick").length >= 2 && runs("tick"), 40_000, 500);
		for (const x of done) {
			assert.equal(x.status, "ok");
			assert.equal(x.trigger, "schedule");
		}
		const out = readFileSync(done[0].outputPath, "utf8");
		assert.match(out, /^CHILD=1$/m);
		const reg = JSON.parse(readFileSync(paths.registry(e.cfg), "utf8"));
		assert.match(out, new RegExp(`^PATH=${reg.env.PATH.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"), "PATH comes from the registry, not launchd's bare PATH");
		assert.equal(readFileSync(paths.launchdLog(e.cfg, "tick"), { encoding: "utf8", flag: "a+" }), "", "launchd log stays empty on success");
	});

	test("pause stops runs and leaves nothing loaded; resume starts them again", async () => {
		await act({ action: "pause", name: "tick" });
		assert.equal(isLoaded("tick"), false);
		assert.equal(existsSync(paths.plist(e.cfg, "tick")), false);
		const count = runs("tick").length;
		await sleep(25_000);
		assert.equal(runs("tick").length, count, "no runs while paused");
		await act({ action: "resume", name: "tick" });
		await waitFor(() => runs("tick").length > count, 30_000, 500);
	});

	test("run (kickstart) works and is marked manual", async () => {
		await act({ action: "remove", name: "tick", purge: true });
		e.fakePi({ MODE: "ok" });
		await act({ action: "add", name: "manual", prompt: "x", schedule: { calendar: [{ Month: 2, Day: 30, Minute: 0, Hour: 0 }] }, notify: "never" });
		const r = await act({ action: "run", name: "manual", wait: true });
		assert.equal(r.isError, false, r.text);
		assert.match(r.text, /ok\s+trigger=manual/);
	});

	test("calendar job fires once, on its minute", async () => {
		const now = new Date();
		const slot = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + (now.getSeconds() > 45 ? 2 : 1));
		e.fakePi({ MODE: "ok" });
		await act({
			action: "add",
			name: "cal",
			prompt: "x",
			schedule: { calendar: [{ Hour: slot.getHours(), Minute: slot.getMinutes() }] },
			notify: "never",
		});
		const [rec] = await waitFor(() => runs("cal").length >= 1 && runs("cal"), slot.getTime() - Date.now() + 30_000, 500);
		assert.equal(rec.status, "ok");
		assert.equal(rec.scheduledFor, slot.toISOString());
		assert.equal(rec.lateMinutes, 0);
		assert.ok(Date.parse(rec.startedAt) >= slot.getTime());
		await sleep(5_000);
		assert.equal(runs("cal").length, 1, "fires exactly once");
	});

	test("launchd never overlaps a long run with the next interval", async () => {
		e.fakePi({ MODE: "sleep", SLEEP: 15 });
		await act({ action: "add", name: "slow", prompt: "x", schedule: { intervalSeconds: 10 }, notify: "never" });
		await waitFor(() => runs("slow").length >= 2, 60_000, 500);
		await act({ action: "pause", name: "slow" });
		const rs = listRuns(e.cfg, "slow").sort((a, b) => a.startedAt.localeCompare(b.startedAt));
		for (let i = 1; i < rs.length; i++) {
			if (!rs[i - 1].endedAt) continue;
			assert.ok(rs[i].startedAt >= (rs[i - 1].endedAt as string), `run ${i} started before run ${i - 1} ended`);
		}
		assert.ok(!rs.some((r) => r.status === "skipped-locked"), "launchd itself prevented the overlap");
	});

	test("bootout during a run (pause) kills pi and records 'killed'", async () => {
		e.fakePi({ MODE: "hang" });
		await act({ action: "add", name: "victim", prompt: "x", schedule: { intervalSeconds: 10 }, notify: "never", timeoutSeconds: 300 });
		await act({ action: "run", name: "victim" });
		await waitFor(() => listRuns(e.cfg, "victim")[0]?.status === "running", 15_000, 200);
		const r = await act({ action: "update", name: "victim", schedule: { intervalSeconds: 20 } });
		assert.match(r.text, /run was in progress and was stopped/);
		const killed = await waitFor(() => listRuns(e.cfg, "victim").find((x: RunRecord) => x.status === "killed"), 15_000, 200);
		assert.equal(killed.attempts, 1);
		await act({ action: "remove", name: "victim" });
	});

	test("failure writes one line to the launchd log and a failed record", async () => {
		e.fakePi({ MODE: "fail" });
		await act({ action: "add", name: "bad", prompt: "x", schedule: { intervalSeconds: 600 }, notify: "never", retries: 1 });
		const r = await act({ action: "run", name: "bad", wait: true });
		assert.equal(r.isError, true);
		assert.match(r.text, /failed .*attempts=2/);
		assert.match(readFileSync(paths.launchdLog(e.cfg, "bad"), "utf8"), /bad: failed after 2 attempt\(s\)\n$/);
	});

	test("sync repairs a job unloaded behind its back; remove cleans up fully", async () => {
		execFileSync("launchctl", ["bootout", `gui/${uid}/${PREFIX}.bad`]);
		assert.match((await act({ action: "list" })).text, /bad .*drift: not-loaded/);
		await act({ action: "sync" });
		assert.ok(isLoaded("bad"));
		for (const n of ["bad", "manual", "cal", "slow"]) await act({ action: "remove", name: n, purge: true });
		for (const n of ["bad", "manual", "cal", "slow"]) assert.equal(isLoaded(n), false, n);
		assert.equal((await act({ action: "list" })).text, "No jobs. Add one with the jobs tool (action: add).");
	});
});
