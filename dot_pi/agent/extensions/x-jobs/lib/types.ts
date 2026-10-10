export type CalendarEntry = {
	Minute: number;
	Hour?: number;
	Day?: number;
	Weekday?: number;
	Month?: number;
};

export type Schedule = { calendar: CalendarEntry[] } | { intervalSeconds: number };

export type NotifyMode = "always" | "failure" | "output" | "never";

export type Retention = { days: number; minRuns: number; maxMB: number };

export type Job = {
	prompt: string;
	schedule: Schedule;
	model?: string;
	thinking?: string;
	tools?: string[];
	cwd?: string;
	timeoutSeconds: number;
	retries: number;
	notify: NotifyMode;
	/** Skip a scheduled run that starts more than this many minutes late. 0 = always run. */
	maxLateMinutes: number;
	retention: Retention;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
};

export type Registry = {
	version: 1;
	/** Captured once, so generated plists stay the same across shells. */
	env: { PATH: string };
	nodePath: string;
	jobs: Record<string, Job>;
};

export type RunStatus =
	| "running"
	| "ok"
	| "failed"
	| "timeout"
	| "killed"
	| "error"
	| "skipped-late"
	| "skipped-locked"
	| "crashed";

export const FAILURE_STATUSES: ReadonlySet<RunStatus> = new Set(["failed", "timeout", "killed", "error", "crashed"]);
export const isSkipped = (s: RunStatus) => s === "skipped-late" || s === "skipped-locked";
/** A run that actually ran and ended (not running, not skipped). */
export const isFinished = (s: RunStatus) => s !== "running" && !isSkipped(s);

export const DAY_MS = 86_400_000;

export type RunRecord = {
	job: string;
	runId: string;
	trigger: "schedule" | "manual";
	status: RunStatus;
	pid: number;
	attempts: number;
	exitCode: number | null;
	timedOut: boolean;
	startedAt: string;
	endedAt?: string;
	durationMs?: number;
	scheduledFor?: string;
	lateMinutes?: number;
	outputPath: string;
	logPath: string;
	outputBytes: number;
	errorTail?: string;
	message?: string;
};
