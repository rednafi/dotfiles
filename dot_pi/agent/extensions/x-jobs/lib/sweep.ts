// Cleanup after a run. The job that ran is pruned every time. Once a day the
// sweep also covers what that misses: paused and removed jobs, stale locks,
// and old manual markers.
import { existsSync, readdirSync, rmdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Config, paths } from "./config.ts";
import { lockIsStale } from "./fsutil.ts";
import { pruneRuns } from "./runs.ts";
import { DAY_MS, type Registry } from "./types.ts";
import { DEFAULTS } from "./validate.ts";

export function sweep(cfg: Config, reg: Registry, now: Date, ranJob?: string): void {
	const retention = (name: string) => reg.jobs[name]?.retention ?? DEFAULTS.retention;
	if (ranJob) pruneRuns(cfg, ranJob, retention(ranJob), now);

	const stamp = paths.sweepStamp(cfg);
	const last = statSync(stamp, { throwIfNoEntry: false })?.mtimeMs ?? 0;
	if (now.getTime() - last < DAY_MS) return;
	if (!existsSync(stamp)) writeFileSync(stamp, "");
	utimesSync(stamp, now, now);

	const runsRoot = paths.runs(cfg);
	for (const name of existsSync(runsRoot) ? readdirSync(runsRoot) : []) {
		const dir = join(runsRoot, name);
		if (!statSync(dir).isDirectory()) continue;
		pruneRuns(cfg, name, retention(name), now);
		if (!reg.jobs[name] && readdirSync(dir).length === 0) rmdirSync(dir);
	}
	const locks = paths.locks(cfg);
	for (const f of existsSync(locks) ? readdirSync(locks) : []) {
		const file = join(locks, f);
		if (f.endsWith(".lock") && lockIsStale(file)) rmSync(file, { force: true });
		const mtime = statSync(file, { throwIfNoEntry: false })?.mtimeMs;
		if (f.endsWith(".manual") && mtime !== undefined && now.getTime() - mtime > DAY_MS) rmSync(file, { force: true });
	}
}
