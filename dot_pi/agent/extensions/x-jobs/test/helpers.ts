import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Config, loadConfig } from "../lib/config.ts";

export const FAKES = join(dirname(fileURLToPath(import.meta.url)), "fakes");

export type Env = {
	dir: string;
	root: string;
	agents: string;
	env: Record<string, string>;
	cfg: Config;
	fakePi: (vars: Record<string, string | number>) => void;
	notifications: () => string[];
	launchctlState: () => { loaded: Record<string, { plist: string; pid: number | null }>; calls: string[][] };
	cleanup: () => void;
};

/** Isolated root + fakes. `extra` overrides any PI_JOBS_* variable. */
export function makeEnv(extra: Record<string, string> = {}): Env {
	const dir = mkdtempSync(join(tmpdir(), "pi-jobs-test-"));
	const root = join(dir, "root");
	const agents = join(dir, "LaunchAgents");
	mkdirSync(root, { recursive: true });
	mkdirSync(agents, { recursive: true });
	const state = join(dir, "launchctl.json");
	const env: Record<string, string> = {
		PATH: process.env.PATH ?? "/usr/bin:/bin",
		PI_JOBS_ROOT: root,
		PI_JOBS_AGENTS_DIR: agents,
		PI_JOBS_LAUNCHCTL: join(FAKES, "fake-launchctl"),
		PI_JOBS_PI_BIN: join(FAKES, "fake-pi"),
		PI_JOBS_NOTIFY: join(FAKES, "fake-notify"),
		PI_JOBS_RETRY_DELAYS: "0",
		PI_JOBS_KILL_GRACE_MS: "300",
		...extra,
	};
	// The fake launchctl runs as a child process and reads this from the environment.
	process.env.FAKE_LAUNCHCTL_STATE = state;
	delete process.env.FAKE_LAUNCHCTL_FAIL;
	const cfg = loadConfig(env);
	return {
		dir,
		root,
		agents,
		env,
		cfg,
		fakePi: (vars) =>
			writeFileSync(
				join(root, "fake-pi.env"),
				Object.entries(vars)
					.map(([k, v]) => `${k}=${v}`)
					.join("\n"),
			),
		notifications: () =>
			existsSync(join(root, "notify.log")) ? readFileSync(join(root, "notify.log"), "utf8").trim().split("\n").filter(Boolean) : [],
		launchctlState: () => (existsSync(state) ? JSON.parse(readFileSync(state, "utf8")) : { loaded: {}, calls: [] }),
		cleanup: () => rmSync(dir, { recursive: true, force: true }),
	};
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitFor<T>(fn: () => T | undefined | false, timeoutMs = 10_000, stepMs = 50): Promise<T> {
	const end = Date.now() + timeoutMs;
	while (Date.now() < end) {
		const v = fn();
		if (v) return v;
		await sleep(stepMs);
	}
	throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

export const baseJob = (over: Record<string, unknown> = {}) => ({
	prompt: "say hi",
	schedule: { calendar: [{ Weekday: 1, Hour: 8, Minute: 45 }] },
	...over,
});
