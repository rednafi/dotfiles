import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { DEFAULTS, MAX_PROMPT_CHARS, ValidationError, validateJob, validateName } from "../../lib/validate.ts";

const now = new Date("2025-06-02T12:00:00Z");
const opts = { minInterval: 300, now };
const ok = (over: Record<string, unknown> = {}) =>
	validateJob({ prompt: "p", schedule: { calendar: [{ Hour: 8, Minute: 45 }] }, ...over }, opts);
const problems = (input: unknown, o: Record<string, unknown> = {}): string[] => {
	try {
		validateJob(input, { ...opts, ...o });
	} catch (err) {
		assert.ok(err instanceof ValidationError, String(err));
		return err.problems;
	}
	assert.fail("expected validation to fail");
};
const bad = (over: Record<string, unknown>) => problems({ prompt: "p", schedule: { calendar: [{ Minute: 0 }] }, ...over });
const badCal = (entry: unknown) => bad({ schedule: { calendar: [entry] } });

describe("validateName", () => {
	for (const n of ["a", "slack-digest", "0day", "a".repeat(40), "a-b-c-1"]) {
		test(`accepts ${JSON.stringify(n)}`, () => assert.deepEqual(validateName(n), []));
	}
	for (const n of ["", "Upper", "has space", "../x", "a/b", "a".repeat(41), "-lead", "_maintenance", "a.b", "émoji", undefined, 3]) {
		test(`rejects ${JSON.stringify(n)}`, () => assert.equal(validateName(n).length, 1));
	}
});

describe("schedule: calendar boundaries", () => {
	const cases: [string, number, boolean][] = [
		["Weekday", -1, false],
		["Weekday", 0, true],
		["Weekday", 7, true],
		["Weekday", 8, false],
		["Hour", -1, false],
		["Hour", 0, true],
		["Hour", 23, true],
		["Hour", 24, false],
		["Minute", -1, false],
		["Minute", 0, true],
		["Minute", 59, true],
		["Minute", 60, false],
		["Day", 0, false],
		["Day", 1, true],
		["Day", 31, true],
		["Day", 32, false],
		["Month", 0, false],
		["Month", 1, true],
		["Month", 12, true],
		["Month", 13, false],
	];
	for (const [key, value, valid] of cases) {
		test(`${key}=${value} ${valid ? "ok" : "rejected"}`, () => {
			const entry = { Minute: 0, [key]: value };
			if (valid) assert.ok(ok({ schedule: { calendar: [entry] } }));
			else assert.match(badCal(entry).join(), new RegExp(`${key} must be between`));
		});
	}
	test("non-integer rejected", () => assert.match(badCal({ Minute: 1.5 }).join(), /must be an integer/));
	test("string number rejected", () => assert.match(badCal({ Minute: "5" }).join(), /must be an integer/));
	test("missing Minute rejected (would fire every minute)", () => assert.match(badCal({ Hour: 9 }).join(), /must set Minute/));
	test("empty entry rejected", () => assert.match(badCal({}).join(), /must set Minute/));
	test("unknown key rejected (typo)", () => assert.match(badCal({ Minute: 0, weekday: 1 }).join(), /unknown keys: weekday/));
	test("entry must be object", () => assert.match(badCal(5).join(), /must be an object/));
	test("empty calendar rejected", () => assert.match(bad({ schedule: { calendar: [] } }).join(), /non-empty array/));
	test("duplicates collapse; Weekday 7 == 0", () => {
		const j = ok({ schedule: { calendar: [{ Weekday: 0, Hour: 1, Minute: 0 }, { Weekday: 7, Hour: 1, Minute: 0 }, { Weekday: 0, Hour: 1, Minute: 0 }] } });
		assert.equal((j.schedule as { calendar: unknown[] }).calendar.length, 1);
	});
	test("200 distinct entries ok, 201 rejected", () => {
		const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ Hour: Math.floor(i / 60) % 24, Minute: i % 60, Day: 1 + Math.floor(i / 1440) }));
		assert.ok(ok({ schedule: { calendar: mk(200) } }));
		assert.match(bad({ schedule: { calendar: mk(201) } }).join(), /201 distinct entries/);
	});
	test("201 entries that dedupe to 200 is ok", () => {
		const entries = Array.from({ length: 200 }, (_, i) => ({ Hour: Math.floor(i / 60), Minute: i % 60 }));
		assert.ok(ok({ schedule: { calendar: [...entries, entries[0]] } }));
	});
});

describe("schedule: shape and interval", () => {
	test("both calendar and interval rejected", () =>
		assert.match(bad({ schedule: { calendar: [{ Minute: 0 }], intervalSeconds: 600 } }).join(), /exactly one/));
	test("neither rejected", () => assert.match(bad({ schedule: {} }).join(), /exactly one/));
	test("unknown schedule key", () => assert.match(bad({ schedule: { intervalSeconds: 600, cron: "x" } }).join(), /unknown keys: cron/));
	test("non-object schedule", () => assert.match(bad({ schedule: "daily" }).join(), /must be an object/));
	test("interval below minimum", () => assert.match(bad({ schedule: { intervalSeconds: 299 } }).join(), /between 300/));
	test("interval at minimum", () => assert.ok(ok({ schedule: { intervalSeconds: 300 } })));
	test("interval min is configurable", () =>
		assert.ok(validateJob({ prompt: "p", schedule: { intervalSeconds: 10 } }, { minInterval: 10, now })));
	test("interval above 30 days", () => assert.match(bad({ schedule: { intervalSeconds: 30 * 86400 + 1 } }).join(), /between/));
	test("fractional interval", () => assert.match(bad({ schedule: { intervalSeconds: 600.5 } }).join(), /integer/));
});

describe("job fields", () => {
	test("defaults applied", () => {
		const j = ok();
		assert.equal(j.timeoutSeconds, DEFAULTS.timeoutSeconds);
		assert.equal(j.retries, DEFAULTS.retries);
		assert.equal(j.notify, "always");
		assert.equal(j.maxLateMinutes, 120);
		assert.deepEqual(j.retention, { days: 14, minRuns: 5, maxMB: 50 });
		assert.equal(j.enabled, true);
		assert.equal(j.createdAt, now.toISOString());
	});
	test("missing prompt", () => assert.match(problems({ schedule: { intervalSeconds: 600 } }).join(), /prompt must be/));
	test("blank prompt", () => assert.match(bad({ prompt: "   " }).join(), /prompt must be/));
	test("huge prompt", () => assert.match(bad({ prompt: "x".repeat(MAX_PROMPT_CHARS + 1) }).join(), /longer than/));
	test("NUL in prompt", () => assert.match(bad({ prompt: "a\0b" }).join(), /NUL/));
	test("hostile prompt is kept verbatim", () => {
		const p = `"; rm -rf ~ $(whoami) \`id\` 'q' \n🎉 & <x>`;
		assert.equal(ok({ prompt: p }).prompt, p);
	});
	test("unknown field (typo) rejected", () => assert.match(bad({ timeout: 5 }).join(), /unknown fields: timeout/));
	test("timeout range", () => {
		assert.match(bad({ timeoutSeconds: 0 }).join(), /timeoutSeconds/);
		assert.match(bad({ timeoutSeconds: 86401 }).join(), /timeoutSeconds/);
	});
	test("retries range", () => {
		assert.match(bad({ retries: -1 }).join(), /retries/);
		assert.match(bad({ retries: 6 }).join(), /retries/);
		assert.equal(ok({ retries: 0 }).retries, 0);
	});
	test("notify enum", () => assert.match(bad({ notify: "sometimes" }).join(), /notify must be/));
	test("maxLateMinutes 0 allowed", () => assert.equal(ok({ maxLateMinutes: 0 }).maxLateMinutes, 0));
	test("retention partial merge", () => assert.deepEqual(ok({ retention: { days: 3 } }).retention, { days: 3, minRuns: 5, maxMB: 50 }));
	test("retention bad key and ranges", () => {
		const p = bad({ retention: { days: 0, minRuns: 0, maxMB: 0, keep: 1 } }).join();
		for (const s of ["retention.days", "retention.minRuns", "retention.maxMB", "unknown keys: keep"]) assert.ok(p.includes(s), s);
	});
	test("tools: valid list", () => assert.deepEqual(ok({ tools: ["read", "codemode", "mcp__slack__*"] }).tools, ["read", "codemode", "mcp__slack__*"]));
	test("tools: +/- list", () => assert.ok(ok({ tools: ["+codemode", "-write"] })));
	test("tools: mixing plain and signed rejected", () => assert.match(bad({ tools: ["read", "-write"] }).join(), /cannot mix/));
	test("tools: empty / bad names", () => {
		assert.match(bad({ tools: [] }).join(), /non-empty/);
		assert.match(bad({ tools: ["rm -rf"] }).join(), /invalid names/);
	});
	test("model pattern", () => {
		assert.equal(ok({ model: "anthropic/claude-sonnet-4:high" }).model, "anthropic/claude-sonnet-4:high");
		assert.match(bad({ model: "a b" }).join(), /model/);
	});
	test("thinking enum", () => assert.match(bad({ thinking: "huge" }).join(), /thinking/));
	test("cwd must exist and be absolute", () => {
		assert.match(bad({ cwd: "relative" }).join(), /absolute/);
		assert.match(bad({ cwd: "/definitely/not/here" }).join(), /not a directory/);
		const d = mkdtempSync(join(tmpdir(), "cwd-"));
		assert.equal(ok({ cwd: d }).cwd, d);
	});
	test("all problems reported together", () => assert.ok(problems({ prompt: "", schedule: {}, retries: 9 }).length >= 3));
	test("non-object input", () => assert.deepEqual(problems(null), ["job must be an object"]));
});

describe("partial updates", () => {
	const existing = ok({ model: "sonnet", tools: ["read"] });
	const later = new Date("2025-06-03T00:00:00Z");
	test("prompt-only update keeps schedule and createdAt", () => {
		const j = validateJob({ prompt: "new" }, { minInterval: 300, now: later, existing });
		assert.equal(j.prompt, "new");
		assert.deepEqual(j.schedule, existing.schedule);
		assert.equal(j.createdAt, existing.createdAt);
		assert.equal(j.updatedAt, later.toISOString());
	});
	test("null clears optional fields", () => {
		const j = validateJob({ model: null, tools: null }, { minInterval: 300, now: later, existing });
		assert.equal(j.model, undefined);
		assert.equal(j.tools, undefined);
	});
	test("update does not mutate the existing job", () => {
		validateJob({ retention: { days: 1 } }, { minInterval: 300, now: later, existing });
		assert.equal(existing.retention.days, 14);
	});
	test("invalid update rejected", () => assert.ok(problems({ schedule: { intervalSeconds: 1 } }, { existing }).length));
});
