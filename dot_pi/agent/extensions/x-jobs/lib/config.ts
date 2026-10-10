// Runtime configuration. Every external dependency is overridable through a
// PI_JOBS_* environment variable so tests can substitute fakes.
import { mkdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type Config = {
	root: string;
	agentsDir: string;
	launchctl: string;
	plutil: string;
	piBin: string;
	notify: string;
	labelPrefix: string;
	minInterval: number;
	dryRun: boolean;
	retryDelays: number[];
	killGraceMs: number;
	uid: number;
	appDir: string;
	now: () => Date;
	/** PI_JOBS_* variables the runner needs, copied into each plist. */
	passthroughEnv: Record<string, string>;
};

// Variables that change runner behaviour and therefore must reach launchd jobs.
const PASSTHROUGH = [
	"PI_JOBS_PI_BIN",
	"PI_JOBS_NOTIFY",
	"PI_JOBS_RETRY_DELAYS",
	"PI_JOBS_LABEL_PREFIX",
	"PI_JOBS_KILL_GRACE_MS",
];

const SELF_EXT = import.meta.url.endsWith(".js") ? ".js" : ".ts";

function appDir(): string {
	const here = dirname(fileURLToPath(import.meta.url));
	try {
		return realpathSync(resolve(here, ".."));
	} catch {
		return resolve(here, "..");
	}
}

function parseDelays(raw: string | undefined): number[] {
	if (raw === undefined) return [30, 120, 300, 600, 900];
	const out = raw
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s !== "")
		.map(Number);
	if (out.some((n) => !Number.isFinite(n) || n < 0)) {
		throw new Error(`PI_JOBS_RETRY_DELAYS must be comma-separated non-negative numbers, got ${JSON.stringify(raw)}`);
	}
	return out.length ? out : [0];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
	const root = resolve(env.PI_JOBS_ROOT ?? join(homedir(), ".pi", "jobs"));
	const fixedNow = env.PI_JOBS_NOW;
	if (fixedNow !== undefined && Number.isNaN(Date.parse(fixedNow))) {
		throw new Error(`PI_JOBS_NOW is not a valid date: ${fixedNow}`);
	}
	const passthroughEnv: Record<string, string> = { PI_JOBS_ROOT: root };
	for (const key of PASSTHROUGH) {
		const v = env[key];
		if (v !== undefined) passthroughEnv[key] = v;
	}
	const minInterval = Number(env.PI_JOBS_MIN_INTERVAL ?? 300);
	const killGraceMs = Number(env.PI_JOBS_KILL_GRACE_MS ?? 5000);
	return {
		root,
		agentsDir: resolve(env.PI_JOBS_AGENTS_DIR ?? join(homedir(), "Library", "LaunchAgents")),
		launchctl: env.PI_JOBS_LAUNCHCTL ?? "launchctl",
		plutil: env.PI_JOBS_PLUTIL ?? "plutil",
		piBin: env.PI_JOBS_PI_BIN ?? "pi",
		notify: env.PI_JOBS_NOTIFY ?? "osascript",
		labelPrefix: env.PI_JOBS_LABEL_PREFIX ?? "com.rednafi.pi.job",
		minInterval: Number.isFinite(minInterval) && minInterval > 0 ? minInterval : 300,
		dryRun: env.PI_JOBS_DRY_RUN === "1",
		retryDelays: parseDelays(env.PI_JOBS_RETRY_DELAYS),
		killGraceMs: Number.isFinite(killGraceMs) && killGraceMs >= 0 ? killGraceMs : 5000,
		uid: process.getuid ? process.getuid() : 0,
		appDir: appDir(),
		now: fixedNow ? () => new Date(fixedNow) : () => new Date(),
		passthroughEnv,
	};
}

/** Create the directories every action and run expects. */
export function ensureLayout(c: Config): void {
	for (const d of [c.root, paths.runs(c), paths.logs(c), paths.locks(c), paths.work(c), c.agentsDir]) mkdirSync(d, { recursive: true });
}

export const paths = {
	registry: (c: Config) => join(c.root, "jobs.json"),
	registryLock: (c: Config) => join(c.root, ".jobs.lock"),
	state: (c: Config) => join(c.root, "state.json"),
	sweepStamp: (c: Config) => join(c.root, ".last-sweep"),
	runs: (c: Config) => join(c.root, "runs"),
	runsFor: (c: Config, name: string) => join(c.root, "runs", name),
	logs: (c: Config) => join(c.root, "logs"),
	launchdLog: (c: Config, name: string) => join(c.root, "logs", `${name}.launchd.log`),
	locks: (c: Config) => join(c.root, "locks"),
	runLock: (c: Config, name: string) => join(c.root, "locks", `${name}.lock`),
	manualMarker: (c: Config, name: string) => join(c.root, "locks", `${name}.manual`),
	work: (c: Config) => join(c.root, "work"),
	label: (c: Config, name: string) => `${c.labelPrefix}.${name}`,
	plist: (c: Config, name: string) => join(c.agentsDir, `${c.labelPrefix}.${name}.plist`),
	/** Job name for one of our labels or plist file names, else undefined. */
	nameOf: (c: Config, labelOrFile: string) => {
		const m = labelOrFile.replace(/\.plist$/, "");
		return m.startsWith(`${c.labelPrefix}.`) ? m.slice(c.labelPrefix.length + 1) : undefined;
	},
	// Node will not strip types under node_modules, so npm installs run the
	// built dist/ copy (scripts/build.ts). appDir is that tree's root either way.
	runJobScript: (c: Config) => join(c.appDir, "bin", `run-job${SELF_EXT}`),
};
