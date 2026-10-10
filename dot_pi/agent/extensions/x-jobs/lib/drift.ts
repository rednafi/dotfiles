// Compare the registry (source of truth) with plists on disk and jobs loaded
// in launchd. Pure so every combination can be table-tested.

export type DriftIssue =
	| "missing-plist" // enabled, no plist on disk
	| "stale-plist" // enabled, plist differs from what the registry renders
	| "not-loaded" // enabled, launchd does not have it
	| "unexpected-plist" // paused, plist still on disk (would load at next login)
	| "unexpected-loaded" // paused, still loaded
	| "orphan"; // plist or launchd job with no registry entry

export type DriftInput = {
	/** name -> desired plist content (enabled jobs) or null (paused jobs) */
	registry: Map<string, string | null>;
	/** name -> plist content on disk */
	disk: Map<string, string>;
	/** names loaded in launchd */
	loaded: Set<string>;
};

export type Drift = Map<string, DriftIssue[]>;

export function diffState({ registry, disk, loaded }: DriftInput): Drift {
	const out: Drift = new Map();
	const add = (name: string, issue: DriftIssue) => out.set(name, [...(out.get(name) ?? []), issue]);
	for (const [name, desired] of registry) {
		const onDisk = disk.get(name);
		if (desired !== null) {
			if (onDisk === undefined) add(name, "missing-plist");
			else if (onDisk !== desired) add(name, "stale-plist");
			if (!loaded.has(name)) add(name, "not-loaded");
		} else {
			if (onDisk !== undefined) add(name, "unexpected-plist");
			if (loaded.has(name)) add(name, "unexpected-loaded");
		}
	}
	for (const name of new Set([...disk.keys(), ...loaded])) {
		if (!registry.has(name)) add(name, "orphan");
	}
	return out;
}

export function fixFor(issues: DriftIssue[]): "reload" | "unload" | "none" {
	if (!issues.length) return "none";
	if (issues.some((i) => i === "missing-plist" || i === "stale-plist" || i === "not-loaded")) return "reload";
	return "unload";
}
