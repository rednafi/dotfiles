import type { JobSummary } from "./service.ts";
import type { RunRecord } from "./types.ts";

export function ago(iso: string | undefined, now: Date): string {
	if (!iso) return "never";
	const s = Math.round((now.getTime() - Date.parse(iso)) / 1000);
	const fut = s < 0;
	const a = Math.abs(s);
	const v = a < 60 ? `${a}s` : a < 3600 ? `${Math.round(a / 60)}m` : a < 86400 ? `${Math.round(a / 3600)}h` : `${Math.round(a / 86400)}d`;
	return fut ? `in ${v}` : `${v} ago`;
}

const ICON: Record<string, string> = {
	ok: "✓",
	failed: "✗",
	timeout: "✗",
	killed: "✗",
	error: "✗",
	crashed: "✗",
	running: "…",
	"skipped-late": "↷",
	"skipped-locked": "↷",
};

export function formatList(jobs: JobSummary[], orphans: string[], now: Date): string {
	if (!jobs.length && !orphans.length) return "No jobs. Add one with the jobs tool (action: add).";
	const rows = jobs.map((j) => {
		const last = j.lastRun ? `${ICON[j.lastRun.status] ?? "?"} ${j.lastRun.status} ${ago(j.lastRun.endedAt ?? j.lastRun.startedAt, now)}` : "never run";
		const state = j.running ? "running" : j.enabled ? "enabled" : "paused";
		const next = j.nextRun ? ago(j.nextRun, now) : "-";
		const drift = j.drift.length ? `  ⚠ drift: ${j.drift.join(", ")}` : "";
		return [j.name, state, j.schedule, last, next, drift];
	});
	const header = ["NAME", "STATE", "SCHEDULE", "LAST RUN", "NEXT"];
	const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
	const line = (r: string[]) =>
		r
			.slice(0, 5)
			.map((c, i) => c.padEnd(widths[i]))
			.join("  ")
			.trimEnd() + (r[5] ?? "");
	const out = [line(header), ...rows.map(line)];
	if (orphans.length) out.push("", `⚠ orphaned launchd jobs/plists (not in jobs.json): ${orphans.join(", ")}. Run sync to remove.`);
	return out.join("\n");
}

export function formatRun(r: RunRecord, now: Date): string {
	const bits = [`${ICON[r.status] ?? "?"} ${r.runId} ${r.status}`, `trigger=${r.trigger}`, `attempts=${r.attempts}`];
	if (r.exitCode !== null) bits.push(`exit=${r.exitCode}`);
	if (r.durationMs !== undefined) bits.push(`${Math.round(r.durationMs / 1000)}s`);
	bits.push(ago(r.endedAt ?? r.startedAt, now));
	let s = bits.join("  ");
	if (r.message) s += `\n    ${r.message}`;
	if (r.errorTail) s += `\n    error tail:\n${r.errorTail.trimEnd().split("\n").slice(-15).map((l) => `      ${l}`).join("\n")}`;
	return s;
}
