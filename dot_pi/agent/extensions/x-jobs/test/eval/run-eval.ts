// Does the model fill in the jobs tool correctly? Runs real `pi -p` calls in
// dry-run mode (nothing is scheduled) against a seeded registry and checks the
// tool calls. Costs model calls. Usage: node test/eval/run-eval.ts [repeats=3]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { paths } from "../../lib/config.ts";
import { emptyRegistry, saveRegistry } from "../../lib/registry.ts";
import type { CalendarEntry } from "../../lib/types.ts";
import { validateJob } from "../../lib/validate.ts";
import { makeEnv } from "../helpers.ts";

type Call = { args: Record<string, unknown>; isError: boolean };
type Case = { prompt: string; check: (calls: Call[]) => string | undefined };

const EXT = fileURLToPath(new URL("../..", import.meta.url));
const repeats = Number(process.argv[2] ?? 3);

/** Calendar entries -> sorted "weekday-HH:MM" slots (no Weekday = every day). */
function slots(cal: unknown): string[] {
	const out = new Set<string>();
	for (const e of (cal as CalendarEntry[]) ?? []) {
		const days = e.Weekday === undefined ? [0, 1, 2, 3, 4, 5, 6] : [e.Weekday % 7];
		for (const d of days) out.add(`${d}-${String(e.Hour).padStart(2, "0")}:${String(e.Minute).padStart(2, "0")}`);
	}
	return [...out].sort();
}
const grid = (days: number[], times: string[]) => days.flatMap((d) => times.map((t) => `${d}-${t}`)).sort();
const halfHours = (from: number, toIncl: number) => {
	const out: string[] = [];
	for (let m = from * 60; m <= toIncl; m += 30) out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
	return out;
};
const ok = (calls: Call[], action: string) => calls.filter((c) => c.args.action === action && !c.isError);
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const schedOf = (c: Call) => c.args.schedule as { calendar?: unknown; intervalSeconds?: number } | undefined;

function oneAdd(calls: Call[], want: (c: Call) => string | undefined): string | undefined {
	const adds = ok(calls, "add");
	if (adds.length !== 1) return `expected 1 successful add, got ${adds.length}`;
	return want(adds[0]);
}

const CASES: Case[] = [
	{
		prompt: "Every weekday at 8:45 summarize my open Linear issues.",
		check: (c) => oneAdd(c, (a) => (same(slots(schedOf(a)?.calendar), grid([1, 2, 3, 4, 5], ["08:45"])) ? undefined : `slots ${slots(schedOf(a)?.calendar)}`)),
	},
	{
		prompt: "Check my calendar every 30 minutes during work hours (9 to 6) on weekdays and tell me what's next.",
		check: (c) =>
			oneAdd(c, (a) => {
				const s = slots(schedOf(a)?.calendar);
				const end1730 = grid([1, 2, 3, 4, 5], halfHours(9, 17 * 60 + 30));
				const end1800 = grid([1, 2, 3, 4, 5], halfHours(9, 18 * 60));
				return same(s, end1730) || same(s, end1800) ? undefined : `got ${s.length} slots, first ${s[0]}, last ${s.at(-1)}`;
			}),
	},
	{
		prompt: "Build a GitHub notifications digest daily at 6pm.",
		check: (c) => oneAdd(c, (a) => (same(slots(schedOf(a)?.calendar), grid([0, 1, 2, 3, 4, 5, 6], ["18:00"])) ? undefined : `slots ${slots(schedOf(a)?.calendar)}`)),
	},
	{
		prompt: "Every 15 minutes, check for new PagerDuty incidents.",
		check: (c) => oneAdd(c, (a) => (schedOf(a)?.intervalSeconds === 900 ? undefined : `schedule ${JSON.stringify(schedOf(a))}`)),
	},
	{
		prompt: "Every 2 minutes, ping me with the time.",
		check: (c) => {
			const bad = ok(c, "add").find((a) => (schedOf(a)?.intervalSeconds ?? 300) < 300);
			return bad ? "scheduled an interval under the 300s minimum" : undefined;
		},
	},
	{
		prompt: "On the first Monday of every month at 9am, write a monthly report.",
		check: (c) => (ok(c, "add").length ? `approximated with ${JSON.stringify(schedOf(ok(c, "add")[0]))}` : undefined),
	},
	{
		prompt: "Pause the slack one.",
		check: (c) => (ok(c, "pause").some((x) => x.args.name === "slack-digest") ? undefined : `calls ${JSON.stringify(c.map((x) => x.args))}`),
	},
	{
		prompt: "Change standup to 9am instead.",
		check: (c) => {
			const u = ok(c, "update").find((x) => x.args.name === "standup");
			if (!u) return `no update of standup: ${JSON.stringify(c.map((x) => x.args))}`;
			if (u.args.prompt !== undefined) return "update also rewrote the prompt";
			return same(slots(schedOf(u)?.calendar), grid([1, 2, 3, 4, 5], ["09:00"])) ? undefined : `slots ${slots(schedOf(u)?.calendar)}`;
		},
	},
	{
		prompt: "Delete all my jobs.",
		check: (c) => (ok(c, "remove").length ? "removed without confirmation" : undefined),
	},
	{
		prompt: "Every Sunday at 7am write a weekly review.",
		check: (c) => oneAdd(c, (a) => (same(slots(schedOf(a)?.calendar), ["0-07:00"]) ? undefined : `slots ${slots(schedOf(a)?.calendar)}`)),
	},
	{
		prompt: "At noon and midnight every day, back up my notes summary.",
		check: (c) => oneAdd(c, (a) => (same(slots(schedOf(a)?.calendar), grid([0, 1, 2, 3, 4, 5, 6], ["00:00", "12:00"])) ? undefined : `slots ${slots(schedOf(a)?.calendar)}`)),
	},
	{
		prompt: "Show me the slack digest logs.",
		check: (c) => (ok(c, "logs").some((x) => x.args.name === "slack-digest") ? undefined : `calls ${JSON.stringify(c.map((x) => x.args))}`),
	},
];

function seed(): Record<string, string> {
	const e = makeEnv({ PI_JOBS_DRY_RUN: "1" });
	const reg = emptyRegistry();
	const now = new Date();
	reg.jobs["slack-digest"] = validateJob({ prompt: "Digest my Slack", schedule: { calendar: [{ Hour: 18, Minute: 0 }] } }, { minInterval: 300, now });
	reg.jobs.standup = validateJob(
		{ prompt: "Build my standup", schedule: { calendar: [1, 2, 3, 4, 5].map((Weekday) => ({ Weekday, Hour: 8, Minute: 45 })) } },
		{ minInterval: 300, now },
	);
	saveRegistry(e.cfg, reg);
	const loaded = Object.fromEntries(Object.keys(reg.jobs).map((n) => [paths.label(e.cfg, n), { plist: "", pid: null }]));
	writeFileSync(process.env.FAKE_LAUNCHCTL_STATE as string, JSON.stringify({ loaded, calls: [] }));
	return { ...e.env, FAKE_LAUNCHCTL_STATE: process.env.FAKE_LAUNCHCTL_STATE as string };
}

function runPi(prompt: string, env: Record<string, string>): Promise<Call[]> {
	return new Promise((resolve) => {
		const p = spawn("pi", ["-ne", "-e", EXT, "--no-session", "--no-mcp", "--tools", "jobs", "--mode", "json", "-p", prompt], {
			env: { ...process.env, ...env },
			cwd: join(env.PI_JOBS_ROOT, ".."),
			stdio: ["ignore", "pipe", "ignore"], // pi reads a piped stdin as extra input and would wait for EOF
		});
		let buf = "";
		p.stdout.on("data", (d) => (buf += d));
		p.on("exit", () => {
			const starts = new Map<string, Record<string, unknown>>();
			const calls: Call[] = [];
			for (const line of buf.split("\n")) {
				let ev: { type?: string; toolName?: string; toolCallId?: string; args?: Record<string, unknown>; isError?: boolean };
				try {
					ev = JSON.parse(line);
				} catch {
					continue;
				}
				if (ev.toolName !== "jobs") continue;
				if (ev.type === "tool_execution_start") starts.set(ev.toolCallId as string, ev.args ?? {});
				if (ev.type === "tool_execution_end") calls.push({ args: starts.get(ev.toolCallId as string) ?? {}, isError: ev.isError === true });
			}
			resolve(calls);
		});
	});
}

const env = seed();
const jobs = CASES.flatMap((c) => Array.from({ length: repeats }, (_, i) => ({ c, i })));
const results = new Map<string, string[]>();
const queue = [...jobs];
await Promise.all(
	Array.from({ length: 4 }, async () => {
		for (let j = queue.shift(); j; j = queue.shift()) {
			const problem = j.c.check(await runPi(j.c.prompt, env));
			const list = results.get(j.c.prompt) ?? [];
			list.push(problem ?? "ok");
			results.set(j.c.prompt, list);
			process.stdout.write(problem ? "F" : ".");
		}
	}),
);
console.log("\n");
let passed = 0;
for (const c of CASES) {
	const r = results.get(c.prompt) ?? [];
	const good = r.filter((x) => x === "ok").length;
	passed += good;
	console.log(`${good === repeats ? "PASS" : "FAIL"} ${good}/${repeats}  ${c.prompt}`);
	for (const x of r) if (x !== "ok") console.log(`      - ${x}`);
}
const total = CASES.length * repeats;
console.log(`\n${passed}/${total} (${Math.round((100 * passed) / total)}%)`);
process.exit(passed / total >= 0.95 ? 0 : 1);
