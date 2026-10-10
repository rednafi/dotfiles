import { execFile } from "node:child_process";
import { type Config, paths } from "./config.ts";
import { sleep } from "./fsutil.ts";

type Exec = { code: number; stdout: string; stderr: string };

export class LaunchctlError extends Error {
	constructor(what: string, r: Exec) {
		super(`launchctl ${what} failed (exit ${r.code}): ${(r.stderr || r.stdout).trim()}`);
	}
}

function launchctl(cfg: Config, args: string[]): Promise<Exec> {
	return new Promise((resolve) => {
		execFile(cfg.launchctl, args, { timeout: 30_000 }, (err, stdout, stderr) => {
			const code = err ? (typeof err.code === "number" ? err.code : 1) : 0;
			resolve({ code, stdout, stderr: stderr || (err && typeof err.code !== "number" ? err.message : "") });
		});
	});
}

const domain = (cfg: Config) => `gui/${cfg.uid}`;
const target = (cfg: Config, label: string) => `${domain(cfg)}/${label}`;

async function isLoaded(cfg: Config, label: string): Promise<boolean> {
	return (await launchctl(cfg, ["print", target(cfg, label)])).code === 0;
}

/** Unload a job and wait until it is gone. Not being loaded counts as success. */
export async function bootout(cfg: Config, label: string): Promise<void> {
	if (!(await isLoaded(cfg, label))) return;
	const r = await launchctl(cfg, ["bootout", target(cfg, label)]);
	// 3 = ESRCH: already gone. 36 = EINPROGRESS: still stopping.
	if (r.code !== 0 && r.code !== 3 && r.code !== 36) throw new LaunchctlError("bootout", r);
	for (let i = 0; i < 50; i++) {
		if (!(await isLoaded(cfg, label))) return;
		await sleep(100);
	}
	throw new LaunchctlError("bootout (job still loaded after 5s)", r);
}

/** Load or reload a plist. Retries the EIO launchd returns right after a bootout. */
export async function bootstrap(cfg: Config, plistPath: string, label: string): Promise<void> {
	await bootout(cfg, label);
	let last: Exec = { code: 0, stdout: "", stderr: "" };
	for (let i = 0; i < 5; i++) {
		last = await launchctl(cfg, ["bootstrap", domain(cfg), plistPath]);
		if (last.code === 0) return;
		if (last.code !== 5 && last.code !== 37) break;
		await sleep(200 * (i + 1));
	}
	throw new LaunchctlError("bootstrap", last);
}

export async function kickstart(cfg: Config, label: string): Promise<void> {
	const r = await launchctl(cfg, ["kickstart", target(cfg, label)]);
	if (r.code !== 0) throw new LaunchctlError("kickstart", r);
}

/** Our loaded jobs: job name -> pid of the running process, or null when idle. */
export async function listLoaded(cfg: Config): Promise<Map<string, number | null>> {
	const r = await launchctl(cfg, ["list"]);
	if (r.code !== 0) throw new LaunchctlError("list", r);
	const out = new Map<string, number | null>();
	for (const line of r.stdout.split("\n").slice(1)) {
		const [pid, , label] = line.split("\t");
		const name = label && paths.nameOf(cfg, label);
		if (name) out.set(name, pid === "-" ? null : Number(pid));
	}
	return out;
}
