// pi extension: manage scheduled pi jobs that launchd runs.
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { ACTIONS, type ActionParams, executeAction } from "./lib/actions.ts";
import { loadConfig } from "./lib/config.ts";
import { Service } from "./lib/service.ts";
import { CAL_RANGES, LIMITS, NOTIFY, THINKING } from "./lib/validate.ts";

const int = ([minimum, maximum]: readonly [number, number], description?: string) => Type.Integer({ minimum, maximum, description });

const CalendarEntry = Type.Object({
	Minute: int(CAL_RANGES.Minute, "Required. Without Minute launchd fires every minute."),
	Hour: Type.Optional(int(CAL_RANGES.Hour, "Omit for every hour")),
	Weekday: Type.Optional(int(CAL_RANGES.Weekday, "0 and 7 are Sunday, 1 Monday ... 6 Saturday. Omit for every day.")),
	Day: Type.Optional(int(CAL_RANGES.Day, "Day of month. If Weekday is also set, either one matching fires.")),
	Month: Type.Optional(int(CAL_RANGES.Month)),
});

const Params = Type.Object({
	action: StringEnum(ACTIONS),
	name: Type.Optional(Type.String({ description: "Job name: 1-40 chars of a-z, 0-9, '-'" })),
	prompt: Type.Optional(Type.String({ description: "Prompt the job sends to `pi -p` on every run" })),
	schedule: Type.Optional(
		Type.Object(
			{
				calendar: Type.Optional(
					Type.Array(CalendarEntry, { description: "Local-time slots. One entry per (weekday, hour, minute); expand ranges into entries." }),
				),
				intervalSeconds: Type.Optional(Type.Integer({ description: "Run every N seconds (minimum 300)" })),
			},
			{ description: "Exactly one of calendar or intervalSeconds" },
		),
	),
	model: Type.Optional(Type.String({ description: "Model pattern for the job, e.g. sonnet" })),
	thinking: Type.Optional(StringEnum(THINKING)),
	tools: Type.Optional(
		Type.Array(Type.String(), { description: "Tool allowlist for pi --tools. MCP tools stay callable unless an entry starts with mcp__" }),
	),
	cwd: Type.Optional(Type.String({ description: "Absolute working directory for the job" })),
	timeoutSeconds: Type.Optional(int(LIMITS.timeoutSeconds, "Per-attempt timeout, default 600")),
	retries: Type.Optional(int(LIMITS.retries, "Retries after a failed attempt, default 2")),
	notify: Type.Optional(
		StringEnum(NOTIFY, { description: "always (default); failure: only failures; output: failures or non-empty output; never" }),
	),
	maxLateMinutes: Type.Optional(
		int(LIMITS.maxLateMinutes, "Skip a scheduled run that starts this late (e.g. after sleep). 0 = always run. Default 120"),
	),
	retention: Type.Optional(
		Type.Object({
			days: Type.Optional(int(LIMITS.days)),
			minRuns: Type.Optional(int(LIMITS.minRuns)),
			maxMB: Type.Optional(int(LIMITS.maxMB)),
		}),
	),
	purge: Type.Optional(Type.Boolean({ description: "remove: also delete run history" })),
	count: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, description: "logs: number of runs, default 5" })),
	wait: Type.Optional(Type.Boolean({ description: "run: wait for the run to finish and return its result" })),
});

export default function (pi: ExtensionAPI) {
	// Jobs run `pi -p`, which would load this extension too. A job must not manage jobs.
	if (process.env.PI_JOBS_CHILD === "1") return;

	const svc = () => new Service(loadConfig());

	pi.registerTool({
		name: "jobs",
		label: "Jobs",
		description:
			"Manage scheduled background pi jobs that macOS launchd runs, even when pi is closed. " +
			`Actions: ${ACTIONS.join(", ")}. ` +
			"Each run executes `pi -p <prompt>` and stores its output under ~/.pi/jobs/runs/<name>/.",
		promptSnippet: "Schedule, inspect and control background pi jobs (launchd)",
		promptGuidelines: [
			"For jobs: call list first when the user refers to an existing job loosely, and use the exact name.",
			"For jobs: calendar entries are local time; Weekday 0/7=Sun, 1=Mon..6=Sat; every entry needs Minute. Expand 'every 30m 9-6 on weekdays' into one entry per slot.",
			"For jobs: launchd cannot express rules like 'first Monday of the month' or 'last day'; say so instead of approximating silently.",
			"For jobs: set only the fields the user asked for; leave cwd, tools, model and timeouts unset unless requested. On update, send only the fields that change.",
			"For jobs: confirm with the user before remove, and before purge (which deletes history).",
		],
		parameters: Params,
		annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
		outputSchema: Type.Object({ isError: Type.Boolean(), data: Type.Unknown() }),
		executionMode: "sequential",
		async execute(_id, params, signal) {
			const r = await executeAction(svc(), params as ActionParams, signal);
			return {
				content: [{ type: "text", text: r.text }],
				details: undefined,
				structuredContent: JSON.parse(JSON.stringify({ isError: r.isError, data: r.data ?? null })),
				isError: r.isError,
			};
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		const f = svc().failures();
		const names = f.map((x) => x.job).join(", ");
		ctx.ui.setStatus("jobs", f.length ? `⚠ ${f.length} job${f.length > 1 ? "s" : ""} failed: ${names}` : undefined);
	});

	pi.registerCommand("x-jobs", {
		description: "Show scheduled pi jobs; /x-jobs <name> shows a job's recent runs and latest output",
		getArgumentCompletions: (prefix) =>
			svc()
				.names()
				.filter((n) => n.startsWith(prefix.trim()))
				.map((n) => ({ value: n, label: n })),
		handler: async (args, ctx) => {
			const s = svc();
			const name = args.trim();
			const r = await executeAction(s, name ? { action: "logs", name, count: 5 } : { action: "list" });
			if (!r.isError) {
				s.markSeen();
				ctx.ui.setStatus("jobs", undefined);
			}
			ctx.ui.notify(r.text, r.isError ? "error" : "info");
		},
	});
}
