// Maps tool parameters to Service calls and renders the model-facing text.
import { formatList, formatRun } from "./format.ts";
import { errMsg } from "./fsutil.ts";
import { RegistryError } from "./registry.ts";
import { JobError, type Service } from "./service.ts";
import { JOB_FIELDS, ValidationError } from "./validate.ts";

export const ACTIONS = ["list", "add", "update", "remove", "pause", "resume", "run", "logs", "sync"] as const;

export type ActionParams = {
	action: (typeof ACTIONS)[number];
	name?: string;
	purge?: boolean;
	count?: number;
	wait?: boolean;
} & Partial<Record<(typeof JOB_FIELDS)[number], unknown>>;

export type ActionResult = { text: string; data: unknown; isError: boolean };

function jobFields(p: ActionParams): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const k of JOB_FIELDS) if (p[k] !== undefined) out[k] = p[k];
	return out;
}

const result = (text: string, data: unknown, isError = false): ActionResult => ({ text, data, isError });

export async function executeAction(svc: Service, p: ActionParams, signal?: AbortSignal): Promise<ActionResult> {
	// Read the clock when formatting: `run --wait` can take minutes.
	const now = () => svc.cfg.now();
	const dry = svc.cfg.dryRun ? " [dry run: nothing changed]" : "";
	try {
		switch (p.action) {
			case "list": {
				const r = await svc.list();
				return result(formatList(r.jobs, r.orphans, now()), r);
			}
			case "add": {
				const r = await svc.add(p.name, jobFields(p));
				return result(`added ${r.name}: ${r.schedule}${dry}`, r);
			}
			case "update": {
				const r = await svc.update(p.name, jobFields(p));
				const how = r.reload ? "schedule reloaded in launchd" : "registry only, no reload needed";
				return result(`updated ${r.name} (${how}): ${r.schedule}${dry}${r.warning ? `\nwarning: ${r.warning}` : ""}`, r);
			}
			case "pause": {
				const r = await svc.pause(p.name);
				return result(`paused ${r.name}${dry}`, r);
			}
			case "resume": {
				const r = await svc.resume(p.name);
				return result(`resumed ${r.name}: ${r.schedule}${dry}`, r);
			}
			case "remove": {
				const r = await svc.remove(p.name, p.purge === true);
				return result(`removed ${r.name}${r.purged ? " and deleted its run history" : " (run history kept)"}${dry}`, r);
			}
			case "run": {
				const r = await svc.run(p.name, { wait: p.wait === true, signal });
				if (r.record) return result(`${formatRun(r.record, now())}\noutput: ${r.record.outputPath}`, r, r.record.status !== "ok");
				return result(`started ${r.name}${dry}${r.note ? ` (${r.note})` : ""}`, r);
			}
			case "logs": {
				const r = await svc.logs(p.name, p.count ?? 5);
				const text = [
					r.runs.length ? r.runs.map((x) => formatRun(x, now())).join("\n") : "no runs yet",
					r.latestOutputPath ? `\nlatest output (${r.latestOutputPath}):\n${r.latestOutput || "(empty)"}` : "",
					`\nlaunchd log: ${r.launchdLog}`,
				].join("\n");
				return result(text, r);
			}
			case "sync": {
				const r = await svc.sync();
				const lines = (o: Record<string, string>) => Object.entries(o).map(([n, a]) => `  ${n}: ${a}`);
				const fixed = lines(r.fixed);
				const errs = lines(r.errors);
				const text = [fixed.length ? `fixed:\n${fixed.join("\n")}` : "everything in sync", errs.length ? `errors:\n${errs.join("\n")}` : ""];
				return result(text.filter(Boolean).join("\n"), r, errs.length > 0);
			}
			default:
				throw new JobError(`unknown action ${String(p.action)}; use one of ${ACTIONS.join(", ")}`);
		}
	} catch (err) {
		if (err instanceof ValidationError) return result(`invalid input:\n${err.problems.map((x) => `- ${x}`).join("\n")}`, { error: err.problems }, true);
		const known = err instanceof JobError || err instanceof RegistryError;
		const text = known ? errMsg(err) : `jobs ${p.action} failed: ${errMsg(err)}`;
		return result(text, { error: errMsg(err) }, true);
	}
}
