// Run with a fixed TZ so local-time math is deterministic (set in package.json / Makefile).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { humanizeDuration, humanizeSchedule, humanizeWeekdays, lastSlot, nextRun, nextSlot } from "../../lib/schedule.ts";
import type { CalendarEntry } from "../../lib/types.ts";

const local = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);
const grid = (days: number[], fromH: number, toH: number, step: number): CalendarEntry[] =>
	days.flatMap((Weekday) => {
		const out: CalendarEntry[] = [];
		for (let t = fromH * 60; t < toH * 60; t += step) out.push({ Weekday, Hour: Math.floor(t / 60), Minute: t % 60 });
		return out;
	});

describe("lastSlot / nextSlot", () => {
	// 2025-06-02 is a Monday.
	const mon845 = [1].map((Weekday) => ({ Weekday, Hour: 8, Minute: 45 }));
	test("exactly on the slot", () => assert.deepEqual(lastSlot(mon845, local(2025, 6, 2, 8, 45)), local(2025, 6, 2, 8, 45)));
	test("just after", () => assert.deepEqual(lastSlot(mon845, local(2025, 6, 2, 11, 0)), local(2025, 6, 2, 8, 45)));
	test("before today's slot finds last week", () => assert.deepEqual(lastSlot(mon845, local(2025, 6, 2, 8, 44)), local(2025, 5, 26, 8, 45)));
	test("next slot is strictly after", () => assert.deepEqual(nextSlot(mon845, local(2025, 6, 2, 8, 45)), local(2025, 6, 9, 8, 45)));
	test("Weekday 7 is Sunday", () => assert.deepEqual(nextSlot([{ Weekday: 7, Hour: 7, Minute: 0 }], local(2025, 6, 2)), local(2025, 6, 8, 7, 0)));
	test("missing Hour = every hour", () => assert.deepEqual(nextSlot([{ Minute: 15 }], local(2025, 6, 2, 10, 20)), local(2025, 6, 2, 11, 15)));
	test("Day and Weekday: either matches (crontab OR)", () => {
		const e = [{ Day: 15, Weekday: 1, Hour: 9, Minute: 0 }];
		// From Tue Jun 3: next is Mon Jun 9 (weekday), then Sun Jun 15 (day).
		assert.deepEqual(nextSlot(e, local(2025, 6, 3)), local(2025, 6, 9, 9, 0));
		assert.deepEqual(nextSlot(e, local(2025, 6, 10)), local(2025, 6, 15, 9, 0));
	});
	test("Month restricts", () => assert.deepEqual(nextSlot([{ Month: 1, Day: 1, Hour: 0, Minute: 0 }], local(2025, 6, 2)), local(2026, 1, 1, 0, 0)));
	test("Feb 30 never fires", () => assert.equal(nextSlot([{ Month: 2, Day: 30, Hour: 0, Minute: 0 }], local(2025, 1, 1)), undefined));
	test("monthly lookback", () => assert.deepEqual(lastSlot([{ Day: 1, Hour: 9, Minute: 0 }], local(2025, 6, 20)), local(2025, 6, 1, 9, 0)));
	test("grid: weekday work hours", () => {
		const g = grid([1, 2, 3, 4, 5], 9, 18, 30);
		assert.equal(g.length, 90);
		assert.deepEqual(nextSlot(g, local(2025, 6, 6, 17, 30)), local(2025, 6, 9, 9, 0)); // Fri 17:30 -> Mon 09:00
		assert.deepEqual(lastSlot(g, local(2025, 6, 7, 12, 0)), local(2025, 6, 6, 17, 30)); // Sat -> Fri 17:30
	});
	test("year boundary", () => assert.deepEqual(nextSlot([{ Hour: 0, Minute: 0 }], local(2025, 12, 31, 23, 59)), local(2026, 1, 1, 0, 0)));
	test("leap day", () => assert.deepEqual(nextSlot([{ Month: 2, Day: 29, Hour: 12, Minute: 0 }], local(2025, 3, 1)), local(2028, 2, 29, 12, 0)));
});

describe("DST (America/New_York)", { skip: process.env.TZ !== "America/New_York" ? "needs TZ=America/New_York" : false }, () => {
	test("spring-forward 02:30 does not exist and is skipped", () => {
		// 2025-03-09 02:00 -> 03:00
		assert.deepEqual(nextSlot([{ Hour: 2, Minute: 30 }], local(2025, 3, 9, 0, 0)), local(2025, 3, 10, 2, 30));
	});
	test("fall-back day still has one 01:30 slot found", () => {
		const t = nextSlot([{ Hour: 1, Minute: 30 }], local(2025, 11, 2, 0, 0));
		assert.ok(t);
		assert.equal(t.getHours(), 1);
		assert.equal(t.getDate(), 2);
	});
});

describe("nextRun", () => {
	test("interval needs a last start", () => assert.equal(nextRun({ intervalSeconds: 600 }, new Date()), undefined));
	test("interval rolls forward past now", () => {
		const last = new Date("2025-06-02T10:00:00Z");
		const now = new Date("2025-06-02T10:25:00Z");
		assert.equal(nextRun({ intervalSeconds: 600 }, now, last)?.toISOString(), "2025-06-02T10:30:00.000Z");
	});
});

describe("humanize", () => {
	test("durations", () => {
		assert.equal(humanizeDuration(1800), "30m");
		assert.equal(humanizeDuration(5400), "1h30m");
		assert.equal(humanizeDuration(86400), "1d");
		assert.equal(humanizeDuration(45), "45s");
	});
	test("weekday sets", () => {
		assert.equal(humanizeWeekdays([1, 2, 3, 4, 5]), "Mon–Fri");
		assert.equal(humanizeWeekdays([0, 6]), "Sat, Sun");
		assert.equal(humanizeWeekdays([0, 1, 2, 3, 4, 5, 6]), "daily");
		assert.equal(humanizeWeekdays([1, 2, 3, 5]), "Mon–Wed, Fri");
		assert.equal(humanizeWeekdays([7, 1]), "Sun, Mon");
	});
	test("interval", () => assert.equal(humanizeSchedule({ intervalSeconds: 1800 }), "every 30m"));
	test("weekday single time", () =>
		assert.equal(humanizeSchedule({ calendar: [1, 2, 3, 4, 5].map((Weekday) => ({ Weekday, Hour: 8, Minute: 45 })) }), "Mon–Fri 08:45"));
	test("daily (no weekday)", () => assert.equal(humanizeSchedule({ calendar: [{ Hour: 18, Minute: 0 }] }), "daily 18:00"));
	test("grid", () => assert.equal(humanizeSchedule({ calendar: grid([1, 2, 3, 4, 5], 9, 18, 30) }), "Mon–Fri every 30m 09:00–17:30"));
	test("two times", () => assert.equal(humanizeSchedule({ calendar: [{ Hour: 0, Minute: 0 }, { Hour: 12, Minute: 0 }] }), "daily 00:00, 12:00"));
	test("hourly", () => assert.equal(humanizeSchedule({ calendar: [{ Minute: 5 }] }), "daily hourly at :05"));
	test("monthly single", () => assert.equal(humanizeSchedule({ calendar: [{ Day: 1, Hour: 9, Minute: 0 }] }), "day 1 09:00"));
	test("custom", () => assert.match(humanizeSchedule({ calendar: [{ Day: 1, Hour: 9, Minute: 0 }, { Day: 15, Hour: 9, Minute: 0 }] }), /custom \(2 slots\)/));
	test("Sunday via 7", () => assert.equal(humanizeSchedule({ calendar: [{ Weekday: 7, Hour: 7, Minute: 0 }] }), "Sun 07:00"));
});
