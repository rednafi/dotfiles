import assert from "node:assert/strict";
import { chmodSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, beforeEach, describe, test } from "node:test";
import { executeAction, type ActionParams } from "../../lib/actions.ts";
import { loadConfig, paths } from "../../lib/config.ts";
import { loadRegistry } from "../../lib/registry.ts";
import { listRuns } from "../../lib/runs.ts";
import { Service } from "../../lib/service.ts";
import { baseJob, type Env, makeEnv } from "../helpers.ts";

let e: Env = makeEnv();
let svc = new Service(e.cfg);
after(() => e.cleanup());
beforeEach(() => {
	e.cleanup();
	e = makeEnv();
	svc = new Service(e.cfg);
});

const act = (p: ActionParams, s = svc) => executeAction(s, p);
const label = (n: string) => paths.label(e.cfg, n);
const loaded = () => Object.keys(e.launchctlState().loaded);
const mutatingCalls = () => e.launchctlState().calls.filter((c) => ["bootstrap", "bootout", "kickstart"].includes(c[0]));
const plists = () => readdirSync(e.agents).filter((f) => f.endsWith(".plist"));

describe("lifecycle", () => {
	test("add → list → update → pause → resume → run → logs → remove", async () => {
		e.fakePi({ MODE: "ok" });
		let r = await act({ action: "add", name: "standup", ...baseJob() });
		assert.equal(r.isError, false, r.text);
		assert.match(r.text, /added standup: Mon 08:45/);
		assert.deepEqual(loaded(), [label("standup")]);
		assert.deepEqual(plists(), [`${label("standup")}.plist`]);
		assert.equal(loadRegistry(e.cfg).jobs.standup.prompt, "say hi");

		r = await act({ action: "list" });
		assert.match(r.text, /standup\s+enabled\s+Mon 08:45\s+never run\s+in /);
		assert.doesNotMatch(r.text, /drift/);

		let before = mutatingCalls().length;
		r = await act({ action: "update", name: "standup", prompt: "new prompt" });
		assert.match(r.text, /registry only, no reload/);
		assert.equal(mutatingCalls().length, before, "prompt-only update touches no launchd state");
		assert.equal(loadRegistry(e.cfg).jobs.standup.prompt, "new prompt");

		r = await act({ action: "update", name: "standup", schedule: { intervalSeconds: 900 } });
		assert.match(r.text, /schedule reloaded in launchd\): every 15m/);
		assert.match(readFileSync(paths.plist(e.cfg, "standup"), "utf8"), /<key>StartInterval<\/key>\n\t<integer>900<\/integer>/);

		r = await act({ action: "pause", name: "standup" });
		assert.equal(r.isError, false, r.text);
		assert.deepEqual(loaded(), []);
		assert.deepEqual(plists(), [], "paused jobs leave no plist (would autoload at login)");
		assert.match((await act({ action: "list" })).text, /standup\s+paused/);

		r = await act({ action: "run", name: "standup" });
		assert.match(r.text, /paused; resume it first/);

		r = await act({ action: "resume", name: "standup" });
		assert.deepEqual(loaded(), [label("standup")]);

		r = await act({ action: "run", name: "standup", wait: true });
		assert.equal(r.isError, false, r.text);
		assert.match(r.text, /ok\s+trigger=manual\s+attempts=1\s+exit=0\s+\d+s\s+\d+s ago/, "finished runs read as past");

		r = await act({ action: "logs", name: "standup" });
		assert.match(r.text, /latest output .*\n# report\nall good/);

		r = await act({ action: "remove", name: "standup" });
		assert.match(r.text, /run history kept/);
		assert.deepEqual(loaded(), []);
		assert.deepEqual(plists(), []);
		assert.equal(loadRegistry(e.cfg).jobs.standup, undefined);
		assert.equal(listRuns(e.cfg, "standup").length, 1);
		// History is still readable after removal.
		assert.equal((await act({ action: "logs", name: "standup" })).isError, false);
		r = await act({ action: "remove", name: "standup", purge: true });
		assert.equal(r.isError, false, r.text);
		assert.equal(existsSync(paths.runsFor(e.cfg, "standup")), false);
	});
});

describe("errors are reported, nothing half-applied", () => {
	test("validation errors list every problem", async () => {
		const r = await act({ action: "add", name: "x", prompt: "", schedule: { calendar: [{ Hour: 9 }] } });
		assert.equal(r.isError, true);
		assert.match(r.text, /invalid input:\n- prompt must be/);
		assert.match(r.text, /must set Minute/);
		assert.equal(existsSync(paths.registry(e.cfg)), false);
	});
	test("bad names", async () => {
		for (const name of [undefined, "Bad Name", "../x"]) {
			const r = await act({ action: "add", name, ...baseJob() } as ActionParams);
			assert.equal(r.isError, true, String(name));
		}
	});
	test("duplicate add", async () => {
		await act({ action: "add", name: "a", ...baseJob() });
		const r = await act({ action: "add", name: "a", ...baseJob() });
		assert.match(r.text, /already exists; use update/);
	});
	test("update/pause/run/remove on a missing job", async () => {
		for (const action of ["update", "pause", "resume", "run", "remove", "logs"] as const) {
			const r = await act({ action, name: "ghost", prompt: "x" });
			assert.equal(r.isError, true, action);
			assert.match(r.text, /no job named ghost/, action);
		}
	});
	test("empty update", async () => {
		await act({ action: "add", name: "a", ...baseJob() });
		assert.match((await act({ action: "update", name: "a" })).text, /at least one field/);
	});
	test("unknown action", async () => {
		assert.match((await act({ action: "explode" } as unknown as ActionParams)).text, /unknown action explode/);
	});
	test("bootstrap failure on add rolls back registry and plist", async () => {
		process.env.FAKE_LAUNCHCTL_FAIL = "bootstrap";
		const r = await act({ action: "add", name: "a", ...baseJob() });
		assert.equal(r.isError, true);
		assert.match(r.text, /launchctl bootstrap failed/);
		assert.equal(loadRegistry(e.cfg).jobs.a, undefined);
		assert.deepEqual(plists(), []);
		assert.deepEqual(loaded(), []);
	});
	test("bootstrap failure on schedule update restores the old job and plist", async () => {
		await act({ action: "add", name: "a", ...baseJob() });
		const oldPlist = readFileSync(paths.plist(e.cfg, "a"), "utf8");
		process.env.FAKE_LAUNCHCTL_FAIL = "bootstrap";
		const r = await act({ action: "update", name: "a", schedule: { intervalSeconds: 900 } });
		assert.equal(r.isError, true);
		assert.deepEqual(loadRegistry(e.cfg).jobs.a.schedule, baseJob().schedule);
		assert.equal(readFileSync(paths.plist(e.cfg, "a"), "utf8"), oldPlist);
		delete process.env.FAKE_LAUNCHCTL_FAIL;
		assert.equal((await act({ action: "list" })).text.includes("drift"), true, "old job is unloaded after a failed reload; list shows it");
		await act({ action: "sync" });
		assert.deepEqual(loaded(), [label("a")]);
	});
	test("plutil lint failure: nothing written, nothing loaded", async () => {
		const badLint = join(e.dir, "bad-plutil");
		writeFileSync(badLint, "#!/bin/sh\necho 'broken plist' >&2; exit 1\n");
		chmodSync(badLint, 0o755);
		const s = new Service(loadConfig({ ...e.env, PI_JOBS_PLUTIL: badLint }));
		const r = await act({ action: "add", name: "a", ...baseJob() }, s);
		assert.match(r.text, /failed plutil -lint: broken plist/);
		assert.equal(loadRegistry(e.cfg).jobs.a, undefined);
		assert.deepEqual(readdirSync(e.agents), [], "no temp plist left behind");
	});
	test("corrupt registry: every action reports it and nothing is overwritten", async () => {
		writeFileSync(paths.registry(e.cfg), "{bad");
		for (const action of ["list", "add", "sync"] as const) {
			const r = await act({ action, name: "a", ...baseJob() });
			assert.equal(r.isError, true, action);
			assert.match(r.text, /not valid JSON/, action);
		}
		assert.equal(readFileSync(paths.registry(e.cfg), "utf8"), "{bad");
	});
});

describe("drift and sync", () => {
	test("plist deleted behind our back", async () => {
		await act({ action: "add", name: "a", ...baseJob() });
		rmSync(paths.plist(e.cfg, "a"));
		assert.match((await act({ action: "list" })).text, /drift: missing-plist/);
		assert.match((await act({ action: "sync" })).text, /a: reload: missing-plist/);
		assert.doesNotMatch((await act({ action: "list" })).text, /drift/);
	});
	test("job unloaded behind our back", async () => {
		await act({ action: "add", name: "a", ...baseJob() });
		const st = e.launchctlState();
		st.loaded = {};
		writeFileSync(process.env.FAKE_LAUNCHCTL_STATE as string, JSON.stringify(st));
		assert.match((await act({ action: "list" })).text, /drift: not-loaded/);
		await act({ action: "sync" });
		assert.deepEqual(loaded(), [label("a")]);
	});
	test("plist hand-edited -> stale and reloaded", async () => {
		await act({ action: "add", name: "a", ...baseJob() });
		writeFileSync(paths.plist(e.cfg, "a"), readFileSync(paths.plist(e.cfg, "a"), "utf8").replace("<integer>45</integer>", "<integer>46</integer>"));
		assert.match((await act({ action: "list" })).text, /stale-plist/);
		await act({ action: "sync" });
		assert.match(readFileSync(paths.plist(e.cfg, "a"), "utf8"), /<integer>45<\/integer>/);
	});
	test("orphan plist and orphan loaded job are removed; unrelated labels untouched", async () => {
		writeFileSync(join(e.agents, `${label("old")}.plist`), "<plist/>");
		writeFileSync(join(e.agents, "com.other.thing.plist"), "<plist/>");
		const r = await act({ action: "list" });
		assert.match(r.text, /orphaned .*: old/);
		await act({ action: "sync" });
		assert.deepEqual(readdirSync(e.agents), ["com.other.thing.plist"]);
	});
	test("registry moved to a new node/PATH -> every job is stale until sync", async () => {
		await act({ action: "add", name: "a", ...baseJob() });
		const reg = JSON.parse(readFileSync(paths.registry(e.cfg), "utf8"));
		reg.nodePath = "/new/node";
		writeFileSync(paths.registry(e.cfg), JSON.stringify(reg));
		assert.match((await act({ action: "list" })).text, /stale-plist/);
		await act({ action: "sync" });
		assert.match(readFileSync(paths.plist(e.cfg, "a"), "utf8"), /\/new\/node/);
	});
	test("in sync -> nothing to do", async () => {
		await act({ action: "add", name: "a", ...baseJob() });
		assert.equal((await act({ action: "sync" })).text, "everything in sync");
	});
});

describe("run", () => {
	test("run --wait returns a failed run as an error result with the tail", async () => {
		e.fakePi({ MODE: "fail" });
		await act({ action: "add", name: "a", ...baseJob({ retries: 0 }) });
		const r = await act({ action: "run", name: "a", wait: true });
		assert.equal(r.isError, true);
		assert.match(r.text, /failed .*exit=1/);
		assert.match(r.text, /boom: something broke/);
	});
	test("run ignores the missed-run policy (manual trigger)", async () => {
		e.fakePi({ MODE: "ok" });
		await act({ action: "add", name: "a", ...baseJob({ maxLateMinutes: 1 }) });
		const r = await act({ action: "run", name: "a", wait: true });
		assert.match(r.text, /ok\s+trigger=manual/);
	});
	test("refuses to start a second copy", async () => {
		e.fakePi({ MODE: "sleep", SLEEP: 3 });
		await act({ action: "add", name: "a", ...baseJob() });
		await act({ action: "run", name: "a" });
		const r = await act({ action: "run", name: "a" });
		assert.match(r.text, /already running/);
	});
	test("kickstart failure removes the manual marker", async () => {
		await act({ action: "add", name: "a", ...baseJob() });
		process.env.FAKE_LAUNCHCTL_FAIL = "kickstart";
		const r = await act({ action: "run", name: "a" });
		assert.equal(r.isError, true);
		assert.equal(existsSync(paths.manualMarker(e.cfg, "a")), false);
	});
	test("not loaded -> tells you to sync", async () => {
		await act({ action: "add", name: "a", ...baseJob() });
		const st = e.launchctlState();
		st.loaded = {};
		writeFileSync(process.env.FAKE_LAUNCHCTL_STATE as string, JSON.stringify(st));
		assert.match((await act({ action: "run", name: "a" })).text, /not loaded in launchd; run sync/);
	});
});

describe("dry run", () => {
	test("mutations validate but change nothing", async () => {
		const s = new Service(loadConfig({ ...e.env, PI_JOBS_DRY_RUN: "1" }));
		const r = await act({ action: "add", name: "a", ...baseJob() }, s);
		assert.equal(r.isError, false);
		assert.match(r.text, /dry run: nothing changed/);
		assert.equal((r.data as { job: { prompt: string } }).job.prompt, "say hi");
		assert.equal(existsSync(paths.registry(e.cfg)), false);
		assert.deepEqual(mutatingCalls(), []);
		assert.equal((await act({ action: "add", name: "a", prompt: "" }, s)).isError, true, "still validates");
	});
	test("dry-run update/remove/sync on existing jobs", async () => {
		await act({ action: "add", name: "a", ...baseJob() });
		const s = new Service(loadConfig({ ...e.env, PI_JOBS_DRY_RUN: "1" }));
		const before = mutatingCalls().length;
		for (const p of [{ action: "update", name: "a", prompt: "z" }, { action: "pause", name: "a" }, { action: "remove", name: "a", purge: true }, { action: "sync" }] as ActionParams[]) {
			assert.equal((await act(p, s)).isError, false, p.action);
		}
		assert.equal(mutatingCalls().length, before);
		assert.equal(loadRegistry(e.cfg).jobs.a.prompt, "say hi");
	});
});

describe("concurrency and shape", () => {
	test("parallel adds from two sessions both land", async () => {
		const s2 = new Service(loadConfig(e.env));
		const [a, b] = await Promise.all([act({ action: "add", name: "a", ...baseJob() }), act({ action: "add", name: "b", ...baseJob() }, s2)]);
		assert.equal(a.isError || b.isError, false);
		assert.deepEqual(Object.keys(loadRegistry(e.cfg).jobs).sort(), ["a", "b"]);
	});
	test("every action's data is JSON-serializable (structuredContent)", async () => {
		e.fakePi({ MODE: "ok" });
		const ps: ActionParams[] = [
			{ action: "add", name: "a", ...baseJob() },
			{ action: "list" },
			{ action: "update", name: "a", prompt: "q" },
			{ action: "run", name: "a", wait: true },
			{ action: "logs", name: "a" },
			{ action: "sync" },
			{ action: "remove", name: "a" },
		];
		for (const p of ps) {
			const r = await act(p);
			assert.doesNotThrow(() => JSON.parse(JSON.stringify(r.data)), p.action);
		}
	});
});
