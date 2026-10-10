// Calendar math that mirrors launchd's StartCalendarInterval semantics:
// missing keys are wildcards, Weekday 0 and 7 are Sunday, and when both Day
// and Weekday are set either one matching is enough (crontab rules).
import type { CalendarEntry, Schedule } from "./types.ts";

// About 4 years: far enough to reach the next Feb 29.
const SEARCH_DAYS = 1470;
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayMatches(e: CalendarEntry, d: Date): boolean {
	if (e.Month !== undefined && d.getMonth() + 1 !== e.Month) return false;
	const wd = e.Weekday === undefined ? undefined : e.Weekday % 7;
	if (e.Day !== undefined && wd !== undefined) return d.getDate() === e.Day || d.getDay() === wd;
	if (e.Day !== undefined) return d.getDate() === e.Day;
	if (wd !== undefined) return d.getDay() === wd;
	return true;
}

/** Slots for one entry on the local calendar day containing `day`. */
function slotsOnDay(e: CalendarEntry, day: Date): Date[] {
	if (!dayMatches(e, day)) return [];
	const hours = e.Hour === undefined ? [...Array(24).keys()] : [e.Hour];
	const out: Date[] = [];
	for (const h of hours) {
		const t = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, e.Minute, 0, 0);
		// Skip times that do not exist locally (DST spring-forward shifts them).
		if (t.getHours() === h && t.getMinutes() === e.Minute) out.push(t);
	}
	return out;
}

function startOfDay(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Nearest slot at or before `at` (dir -1) or strictly after it (dir 1). */
function findSlot(entries: CalendarEntry[], at: Date, dir: 1 | -1): Date | undefined {
	const start = startOfDay(at);
	const t = at.getTime();
	for (let i = 0; i <= SEARCH_DAYS; i++) {
		let best: Date | undefined;
		for (const e of entries) {
			for (const slot of slotsOnDay(e, addDays(start, i * dir))) {
				const ok = dir === 1 ? slot.getTime() > t : slot.getTime() <= t;
				if (ok && (!best || (dir === 1 ? slot < best : slot > best))) best = slot;
			}
		}
		if (best) return best;
	}
	return undefined;
}

export const lastSlot = (entries: CalendarEntry[], now: Date) => findSlot(entries, now, -1);
export const nextSlot = (entries: CalendarEntry[], from: Date) => findSlot(entries, from, 1);

export function nextRun(schedule: Schedule, from: Date, lastStart?: Date): Date | undefined {
	if ("intervalSeconds" in schedule) {
		if (!lastStart) return undefined;
		let t = lastStart.getTime() + schedule.intervalSeconds * 1000;
		while (t <= from.getTime()) t += schedule.intervalSeconds * 1000;
		return new Date(t);
	}
	return nextSlot(schedule.calendar, from);
}

// ---------- humanize ----------

export function humanizeDuration(seconds: number): string {
	const parts: string[] = [];
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (d) parts.push(`${d}d`);
	if (h) parts.push(`${h}h`);
	if (m) parts.push(`${m}m`);
	if (s) parts.push(`${s}s`);
	return parts.join("") || "0s";
}

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export function humanizeWeekdays(days: number[]): string {
	const set = [...new Set(days.map((d) => d % 7))].sort((a, b) => a - b);
	if (set.length === 7) return "daily";
	if (set.join() === "1,2,3,4,5") return "Mon–Fri";
	if (set.join() === "0,6") return "Sat, Sun";
	// Collapse consecutive runs, e.g. 1,2,3,5 -> Mon–Wed, Fri.
	const out: string[] = [];
	let i = 0;
	while (i < set.length) {
		let j = i;
		while (j + 1 < set.length && set[j + 1] === set[j] + 1) j++;
		out.push(j - i >= 2 ? `${WD[set[i]]}–${WD[set[j]]}` : set.slice(i, j + 1).map((d) => WD[d]).join(", "));
		i = j + 1;
	}
	return out.join(", ");
}

function humanizeTimes(mins: number[]): string {
	const t = [...new Set(mins)].sort((a, b) => a - b);
	if (t.length >= 3) {
		const step = t[1] - t[0];
		if (t.every((v, k) => k === 0 || v - t[k - 1] === step)) {
			return `every ${humanizeDuration(step * 60)} ${hhmm(t[0])}–${hhmm(t[t.length - 1])}`;
		}
	}
	return t.map(hhmm).join(", ");
}

export function humanizeSchedule(schedule: Schedule): string {
	if ("intervalSeconds" in schedule) return `every ${humanizeDuration(schedule.intervalSeconds)}`;
	const entries = schedule.calendar;
	const simple = entries.every((e) => e.Day === undefined && e.Month === undefined && e.Hour !== undefined);
	if (!simple) {
		if (entries.length === 1) return describeEntry(entries[0]);
		if (entries.every((e) => e.Hour === undefined && e.Day === undefined && e.Month === undefined && e.Weekday === undefined)) {
			return `hourly at ${entries.map((e) => `:${pad(e.Minute)}`).join(", ")}`;
		}
		return `custom (${entries.length} slots)`;
	}
	// time-of-day (minutes) -> weekday set
	const byTime = new Map<number, Set<number>>();
	for (const e of entries) {
		const t = (e.Hour as number) * 60 + e.Minute;
		const set = byTime.get(t) ?? new Set<number>();
		if (e.Weekday === undefined) for (let d = 0; d < 7; d++) set.add(d);
		else set.add(e.Weekday % 7);
		byTime.set(t, set);
	}
	// group times sharing the same weekday set
	const groups = new Map<string, { days: number[]; times: number[] }>();
	for (const [t, days] of byTime) {
		const sorted = [...days].sort((a, b) => a - b);
		const key = sorted.join();
		const g = groups.get(key) ?? { days: sorted, times: [] };
		g.times.push(t);
		groups.set(key, g);
	}
	const parts = [...groups.values()]
		.sort((a, b) => Math.min(...a.times) - Math.min(...b.times))
		.map((g) => `${humanizeWeekdays(g.days)} ${humanizeTimes(g.times)}`);
	return parts.length > 3 ? `custom (${entries.length} slots)` : parts.join("; ");
}

function describeEntry(e: CalendarEntry): string {
	const bits: string[] = [];
	if (e.Month !== undefined) bits.push(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][e.Month - 1]);
	if (e.Day !== undefined) bits.push(`day ${e.Day}`);
	if (e.Weekday !== undefined) bits.push((e.Day !== undefined ? "or " : "") + WD[e.Weekday % 7]);
	if (e.Day === undefined && e.Weekday === undefined && e.Month === undefined) bits.push("daily");
	bits.push(e.Hour === undefined ? `hourly at :${pad(e.Minute)}` : hhmm(e.Hour * 60 + e.Minute));
	return bits.join(" ");
}

