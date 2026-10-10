import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { after, beforeEach, describe, test } from "node:test";
import { paths } from "../../lib/config.ts";
import { allocRunId, effectiveStatus, listRuns, markSeen, newRecord, pruneRuns, runIdFor, runIdTime, unseenFailures, writeRecord } from "../../lib/runs.ts";
import type { RunRecord, RunStatus } from "../../lib/types.ts";
import { makeEnv } from "../helpers.ts";

let e = makeEnv();
after(() => e.cleanup());
beforeEach(() => {
	e.cleanup();
	e = makeEnv();
});

const NOW = new Date("2025-06-30T12:00:00Z");
const DAY = 86_400_000;

function mkRun(name: string, daysAgo: number, status: RunStatus = "ok", bytes = 10, pid = 999999): RunRecord {
	mkdirSync(paths.runsFor(e.cfg, name), { recursive: true });
	const start = new Date(NOW.getTime() - daysAgo * DAY);
	const rec: RunRecord = { ...newRecord(e.cfg, name, start, "schedule"), status, pid, attempts: 1, exitCode: status === "ok" ? 0 : 1, outputBytes: bytes };
	if (status !== "running") rec.endedAt = start.toISOString();
	writeFileSync(rec.outputPath, "x".repeat(bytes));
	writeFileSync(rec.logPath, "");
	writeRecord(e.cfg, rec);
	return rec;
}

describe("run ids", () => {
	test("sortable, parseable", () => {
		const d = new Date("2025-06-02T08:45:00.123Z");
		assert.equal(runIdFor(d), "2025-06-02T08-45-00-123Z");
		assert.equal(runIdTime(runIdFor(d)), d.getTime());
		assert.ok(Number.isNaN(runIdTime("garbage")));
	});
	test("collisions get a suffix", () => {
		const a = mkRun("c", 1);
		const dir = paths.runsFor(e.cfg, "c");
		const b = allocRunId(dir, new Date(a.startedAt));
		assert.equal(b, `${a.runId}-2`);
		assert.equal(runIdTime(b), runIdTime(a.runId));
	});
});

describe("listRuns", () => {
	test("newest first, corrupt records ignored", () => {
		mkRun("l", 3);
		mkRun("l", 1);
		writeFileSync(join(paths.runsFor(e.cfg, "l"), "2025-06-30T00-00-00-000Z.json"), "{half");
		const runs = listRuns(e.cfg, "l");
		assert.equal(runs.length, 2);
		assert.ok(runs[0].startedAt > runs[1].startedAt);
	});
	test("running record with dead pid reads as crashed", () => {
		mkRun("cr", 0, "running", 1, 999999);
		assert.equal(listRuns(e.cfg, "cr")[0].status, "crashed");
	});
	test("running record with live pid stays running", () => {
		mkRun("lv", 0, "running", 1, process.pid);
		assert.equal(listRuns(e.cfg, "lv")[0].status, "running");
		assert.equal(effectiveStatus({ status: "running", pid: process.pid } as RunRecord), "running");
	});
	test("missing dir -> empty", () => assert.deepEqual(listRuns(e.cfg, "nope"), []));
});

describe("pruneRuns", () => {
	const ret = { days: 14, minRuns: 5, maxMB: 50 };
	test("deletes runs older than days, keeps recent", () => {
		for (const d of [1, 2, 3, 4, 5, 6, 20, 30]) mkRun("p", d);
		const r = pruneRuns(e.cfg, "p", ret, NOW);
		assert.equal(r.deleted.length, 2);
		assert.equal(listRuns(e.cfg, "p").length, 6);
	});
	test("minRuns keeps old runs of a job that stopped running", () => {
		for (const d of [100, 101, 102, 103, 104, 105, 106]) mkRun("old", d);
		pruneRuns(e.cfg, "old", ret, NOW);
		assert.equal(listRuns(e.cfg, "old").length, 5);
	});
	test("failures are kept twice as long", () => {
		for (let i = 0; i < 5; i++) mkRun("f", i * 0.01); // newest 5 protected by minRuns
		mkRun("f", 20, "failed"); // 20d < 28d -> kept
		mkRun("f", 20, "ok"); // 20d > 14d -> deleted
		mkRun("f", 30, "timeout"); // 30d > 28d -> deleted
		pruneRuns(e.cfg, "f", ret, NOW);
		const left = listRuns(e.cfg, "f").map((r) => r.status);
		assert.equal(left.length, 6);
		assert.equal(left.filter((s) => s === "failed").length, 1);
		assert.ok(!left.includes("timeout"));
	});
	test("size cap deletes oldest first, keeps at least one", () => {
		const mb = 1024 * 1024;
		for (const d of [5, 4, 3, 2, 1]) mkRun("s", d, "ok", mb);
		pruneRuns(e.cfg, "s", { days: 14, minRuns: 5, maxMB: 2 }, NOW);
		const left = listRuns(e.cfg, "s");
		assert.equal(left.length, 1, "size cap overrides minRuns");
		assert.equal(left[0].startedAt, new Date(NOW.getTime() - DAY).toISOString(), "newest kept");
		// A single run bigger than the cap is still kept.
		mkRun("big", 1, "ok", 3 * mb);
		pruneRuns(e.cfg, "big", { days: 14, minRuns: 1, maxMB: 1 }, NOW);
		assert.equal(listRuns(e.cfg, "big").length, 1);
	});
	test("running runs are never deleted", () => {
		for (let i = 0; i < 5; i++) mkRun("r", i * 0.01);
		mkRun("r", 60, "running", 10, process.pid);
		pruneRuns(e.cfg, "r", ret, NOW);
		assert.ok(listRuns(e.cfg, "r").some((x) => x.status === "running"));
	});
	test("orphan .md/.log without .json are pruned by age", () => {
		const dir = paths.runsFor(e.cfg, "o");
		for (let i = 0; i < 5; i++) mkRun("o", i * 0.01);
		const id = runIdFor(new Date(NOW.getTime() - 40 * DAY));
		writeFileSync(join(dir, `${id}.md`), "x");
		writeFileSync(join(dir, `${id}.log`), "x");
		pruneRuns(e.cfg, "o", ret, NOW);
		assert.equal(existsSync(join(dir, `${id}.md`)), false);
	});
	test("unrelated files left alone", () => {
		const dir = paths.runsFor(e.cfg, "u");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "notes.txt"), "keep");
		pruneRuns(e.cfg, "u", { days: 1, minRuns: 1, maxMB: 1 }, NOW);
		assert.ok(existsSync(join(dir, "notes.txt")));
	});
});

describe("unseenFailures (badge)", () => {
	test("latest failure since lastSeen counts", () => {
		mkRun("a", 0.5, "failed");
		assert.deepEqual(unseenFailures(e.cfg, ["a"], NOW).map((f) => f.job), ["a"]);
	});
	test("failure before lastSeen ignored", () => {
		mkRun("a", 0.5, "failed");
		markSeen(e.cfg, NOW);
		assert.deepEqual(unseenFailures(e.cfg, ["a"], NOW), []);
	});
	test("later success clears the failure", () => {
		mkRun("a", 0.5, "failed");
		mkRun("a", 0.1, "ok");
		assert.deepEqual(unseenFailures(e.cfg, ["a"], NOW), []);
	});
	test("skipped runs do not hide a failure", () => {
		mkRun("a", 0.5, "failed");
		mkRun("a", 0.1, "skipped-late");
		assert.equal(unseenFailures(e.cfg, ["a"], NOW).length, 1);
	});
	test("multiple jobs counted", () => {
		mkRun("a", 0.5, "failed");
		mkRun("b", 0.5, "timeout");
		mkRun("c", 0.5, "ok");
		assert.deepEqual(unseenFailures(e.cfg, ["a", "b", "c"], NOW).map((f) => f.job), ["a", "b"]);
	});
	test("without lastSeen only the last 7 days count", () => {
		mkRun("a", 8, "failed");
		assert.deepEqual(unseenFailures(e.cfg, ["a"], NOW), []);
	});
	test("corrupt state file is treated as never seen", () => {
		writeFileSync(paths.state(e.cfg), "nope");
		mkRun("a", 0.5, "failed");
		assert.equal(unseenFailures(e.cfg, ["a"], NOW).length, 1);
	});
});
