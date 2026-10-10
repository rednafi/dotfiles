import { existsSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";
import type { CalendarEntry, Job, NotifyMode, Retention, Schedule } from "./types.ts";

export class ValidationError extends Error {
	readonly problems: string[];
	constructor(problems: string[]) {
		super(`invalid job: ${problems.join("; ")}`);
		this.name = "ValidationError";
		this.problems = problems;
	}
}

// Shared with the tool schema in index.ts, so the model sees the same limits.
export const NOTIFY = ["always", "failure", "output", "never"] as const;
export const THINKING = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export const CAL_RANGES = { Minute: [0, 59], Hour: [0, 23], Day: [1, 31], Weekday: [0, 7], Month: [1, 12] } as const;
export const LIMITS = {
	timeoutSeconds: [1, 86400],
	retries: [0, 5],
	maxLateMinutes: [0, 10080],
	days: [1, 365],
	minRuns: [1, 1000],
	maxMB: [1, 10240],
} as const;
/** Job fields a caller may set. `enabled` is set through pause/resume. */
export const JOB_FIELDS = [
	"prompt",
	"schedule",
	"model",
	"thinking",
	"tools",
	"cwd",
	"timeoutSeconds",
	"retries",
	"notify",
	"maxLateMinutes",
	"retention",
] as const;
const JOB_KEYS = new Set<string>([...JOB_FIELDS, "enabled"]);

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const MAX_CALENDAR_ENTRIES = 200;
export const MAX_PROMPT_CHARS = 20_000;
const MAX_INTERVAL = 30 * 24 * 3600;

export const DEFAULTS = {
	timeoutSeconds: 600,
	retries: 2,
	notify: "always" as NotifyMode,
	maxLateMinutes: 120,
	retention: { days: 14, minRuns: 5, maxMB: 50 } as Retention,
};

export function validateName(name: unknown): string[] {
	if (typeof name !== "string") return ["name is required"];
	if (!NAME_RE.test(name)) {
		return [`name ${JSON.stringify(name)} must be 1-40 chars of a-z, 0-9 and '-', starting with a letter or digit`];
	}
	return [];
}

export function requireName(name: unknown): string {
	const p = validateName(name);
	if (p.length) throw new ValidationError(p);
	return name as string;
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

function intIn(problems: string[], label: string, v: unknown, [lo, hi]: readonly [number, number]): boolean {
	if (!isInt(v)) problems.push(`${label} must be an integer, got ${JSON.stringify(v)}`);
	else if (v < lo || v > hi) problems.push(`${label} must be between ${lo} and ${hi}, got ${v}`);
	else return true;
	return false;
}

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

function unknownKeys(problems: string[], where: string, o: Record<string, unknown>, allowed: Iterable<string>): void {
	const ok = new Set(allowed);
	const extra = Object.keys(o).filter((k) => !ok.has(k));
	if (extra.length) problems.push(`${where} has unknown keys: ${extra.join(", ")}`);
}

function entryKey(e: CalendarEntry): string {
	const wd = e.Weekday === 7 ? 0 : e.Weekday;
	return [e.Month, e.Day, wd, e.Hour, e.Minute].map((x) => x ?? "*").join("/");
}

function validateSchedule(raw: unknown, minInterval: number, problems: string[]): Schedule | undefined {
	if (!isObject(raw)) {
		problems.push("schedule must be an object with either 'calendar' or 'intervalSeconds'");
		return undefined;
	}
	unknownKeys(problems, "schedule", raw, ["calendar", "intervalSeconds"]);
	if ((raw.calendar === undefined) === (raw.intervalSeconds === undefined)) {
		problems.push("schedule needs exactly one of 'calendar' or 'intervalSeconds'");
		return undefined;
	}
	if (raw.intervalSeconds !== undefined) {
		return intIn(problems, "schedule.intervalSeconds", raw.intervalSeconds, [minInterval, MAX_INTERVAL])
			? { intervalSeconds: raw.intervalSeconds as number }
			: undefined;
	}
	if (!Array.isArray(raw.calendar) || raw.calendar.length === 0) {
		problems.push("schedule.calendar must be a non-empty array");
		return undefined;
	}
	const before = problems.length;
	const seen = new Map<string, CalendarEntry>();
	raw.calendar.forEach((e, i) => {
		const where = `schedule.calendar[${i}]`;
		if (!isObject(e)) {
			problems.push(`${where} must be an object`);
			return;
		}
		unknownKeys(problems, where, e, Object.keys(CAL_RANGES));
		// launchd treats a missing key as "every": {Hour: 9} fires every minute
		// from 09:00 to 09:59. Requiring Minute rules that out.
		if (e.Minute === undefined) problems.push(`${where} must set Minute (a missing Minute makes launchd fire every minute)`);
		const entry: Record<string, number> = {};
		for (const [key, range] of Object.entries(CAL_RANGES)) {
			if (e[key] !== undefined && intIn(problems, `${where}.${key}`, e[key], range)) entry[key] = e[key] as number;
		}
		const ce = entry as CalendarEntry;
		if (!seen.has(entryKey(ce))) seen.set(entryKey(ce), ce);
	});
	if (seen.size > MAX_CALENDAR_ENTRIES) {
		problems.push(`schedule.calendar has ${seen.size} distinct entries; the limit is ${MAX_CALENDAR_ENTRIES}`);
	}
	return problems.length === before ? { calendar: [...seen.values()] } : undefined;
}

function validateTools(raw: unknown, problems: string[]): string[] | undefined {
	if (!Array.isArray(raw) || raw.length === 0 || raw.some((t) => typeof t !== "string")) {
		problems.push("tools must be a non-empty array of tool names");
		return undefined;
	}
	const bad = raw.filter((t: string) => !/^[+-]?[A-Za-z0-9_*.-]+$/.test(t));
	if (bad.length) problems.push(`tools has invalid names: ${bad.join(", ")}`);
	const signed = raw.filter((t: string) => t.startsWith("+") || t.startsWith("-")).length;
	if (signed !== 0 && signed !== raw.length) problems.push("tools cannot mix plain names with +name/-name entries (pi rejects that)");
	return raw as string[];
}

export type ValidateOptions = {
	minInterval: number;
	now: Date;
	/** When set, `input` is a partial update applied on top of this job. */
	existing?: Job;
};

/** Validate a full job (add) or a partial update, returning the normalized job. */
export function validateJob(input: unknown, opts: ValidateOptions): Job {
	if (!isObject(input)) throw new ValidationError(["job must be an object"]);
	const i = input;
	const problems: string[] = [];
	const extra = Object.keys(i).filter((k) => !JOB_KEYS.has(k));
	if (extra.length) problems.push(`unknown fields: ${extra.join(", ")}`);

	const ex = opts.existing;
	const stamp = opts.now.toISOString();
	const job: Job = ex
		? { ...ex, retention: { ...ex.retention }, updatedAt: stamp }
		: {
				prompt: "",
				schedule: { intervalSeconds: 0 },
				timeoutSeconds: DEFAULTS.timeoutSeconds,
				retries: DEFAULTS.retries,
				notify: DEFAULTS.notify,
				maxLateMinutes: DEFAULTS.maxLateMinutes,
				retention: { ...DEFAULTS.retention },
				enabled: true,
				createdAt: stamp,
				updatedAt: stamp,
			};

	if (i.prompt !== undefined || !ex) {
		if (typeof i.prompt !== "string" || i.prompt.trim() === "") problems.push("prompt must be a non-empty string");
		else if (i.prompt.length > MAX_PROMPT_CHARS) problems.push(`prompt is longer than ${MAX_PROMPT_CHARS} characters`);
		else if (i.prompt.includes("\0")) problems.push("prompt must not contain NUL characters");
		else job.prompt = i.prompt;
	}
	if (i.schedule !== undefined || !ex) {
		const s = validateSchedule(i.schedule, opts.minInterval, problems);
		if (s) job.schedule = s;
	}
	// null clears an optional field on update.
	if (i.model === null) delete job.model;
	else if (i.model !== undefined) {
		if (typeof i.model === "string" && /^[A-Za-z0-9_.:/@-]{1,100}$/.test(i.model)) job.model = i.model;
		else problems.push(`model ${JSON.stringify(i.model)} is not a valid model pattern`);
	}
	if (i.thinking === null) delete job.thinking;
	else if (i.thinking !== undefined) {
		if ((THINKING as readonly unknown[]).includes(i.thinking)) job.thinking = i.thinking as string;
		else problems.push(`thinking must be one of ${THINKING.join(", ")}`);
	}
	if (i.tools === null) delete job.tools;
	else if (i.tools !== undefined) {
		const t = validateTools(i.tools, problems);
		if (t) job.tools = t;
	}
	if (i.cwd === null) delete job.cwd;
	else if (i.cwd !== undefined) {
		if (typeof i.cwd !== "string" || !isAbsolute(i.cwd)) problems.push("cwd must be an absolute path");
		else if (!existsSync(i.cwd) || !statSync(i.cwd).isDirectory()) problems.push(`cwd ${i.cwd} is not a directory`);
		else job.cwd = i.cwd;
	}
	for (const key of ["timeoutSeconds", "retries", "maxLateMinutes"] as const) {
		if (i[key] !== undefined && intIn(problems, key, i[key], LIMITS[key])) job[key] = i[key] as number;
	}
	if (i.notify !== undefined) {
		if ((NOTIFY as readonly unknown[]).includes(i.notify)) job.notify = i.notify as NotifyMode;
		else problems.push(`notify must be one of ${NOTIFY.join(", ")}`);
	}
	if (i.retention !== undefined) {
		if (!isObject(i.retention)) problems.push("retention must be an object");
		else {
			unknownKeys(problems, "retention", i.retention, ["days", "minRuns", "maxMB"]);
			for (const key of ["days", "minRuns", "maxMB"] as const) {
				const v = i.retention[key];
				if (v !== undefined && intIn(problems, `retention.${key}`, v, LIMITS[key])) job.retention[key] = v as number;
			}
		}
	}
	if (i.enabled !== undefined) {
		if (typeof i.enabled === "boolean") job.enabled = i.enabled;
		else problems.push("enabled must be a boolean");
	}
	if (problems.length) throw new ValidationError(problems);
	return job;
}
