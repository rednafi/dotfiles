import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";
import { type Config, paths } from "./config.ts";
import { readJson, writeJson } from "./fsutil.ts";
import type { Registry } from "./types.ts";

export const REGISTRY_VERSION = 1;

export class RegistryError extends Error {}

function findOnPath(bin: string, pathVar: string): string | undefined {
	for (const dir of pathVar.split(delimiter)) {
		if (!dir) continue;
		const p = join(dir, bin);
		try {
			accessSync(p, constants.X_OK);
			return p;
		} catch {}
	}
	return undefined;
}

/** Node binary that runs jobs. A PATH lookup is stabler than process.execPath. */
function resolveNode(pathVar: string): string {
	return findOnPath("node", pathVar) ?? process.execPath;
}

const currentPath = () => process.env.PATH || "/usr/bin:/bin:/usr/sbin:/sbin";

export function emptyRegistry(): Registry {
	const PATH = currentPath();
	return { version: REGISTRY_VERSION, env: { PATH }, nodePath: resolveNode(PATH), jobs: {} };
}

/** Upgrade older on-disk shapes. Unknown future versions are refused. */
export function migrate(raw: unknown): Registry {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		throw new RegistryError("jobs.json is not a JSON object");
	}
	const r = raw as Record<string, unknown>;
	const version = r.version ?? 0;
	if (typeof version !== "number" || version > REGISTRY_VERSION) {
		throw new RegistryError(`jobs.json has version ${String(version)}; this build understands up to ${REGISTRY_VERSION}`);
	}
	const jobs = (r.jobs ?? {}) as Registry["jobs"];
	if (typeof jobs !== "object" || Array.isArray(jobs)) throw new RegistryError("jobs.json 'jobs' must be an object");
	const PATH = (r.env as Registry["env"] | undefined)?.PATH || currentPath();
	const nodePath = typeof r.nodePath === "string" && r.nodePath ? r.nodePath : resolveNode(PATH);
	return { version: REGISTRY_VERSION, env: { PATH }, nodePath, jobs };
}

export function loadRegistry(cfg: Config): Registry {
	const file = paths.registry(cfg);
	let raw: unknown;
	try {
		raw = readJson(file);
	} catch (err) {
		// Never overwrite a corrupt registry: it is the source of truth.
		throw new RegistryError(`jobs.json is not valid JSON (${(err as Error).message}); fix or move ${file}`);
	}
	return raw === undefined ? emptyRegistry() : migrate(raw);
}

export function saveRegistry(cfg: Config, reg: Registry): void {
	writeJson(paths.registry(cfg), reg);
}
