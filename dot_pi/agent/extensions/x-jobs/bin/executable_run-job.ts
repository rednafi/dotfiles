#!/usr/bin/env node
// launchd entrypoint: run-job <name>
import { loadConfig } from "../lib/config.ts";
import { runJob } from "../lib/runner.ts";

const name = process.argv[2];
if (!name) {
	console.error("usage: run-job <name>");
	process.exit(2);
}
try {
	const out = await runJob(loadConfig(), name, { handleSignals: true });
	// Run details live in runs/<name>/. The launchd log only gets failures.
	if (out.exitCode !== 0) console.error(`[${new Date().toISOString()}] ${name}: ${out.message}`);
	process.exit(out.exitCode);
} catch (err) {
	console.error(`[${new Date().toISOString()}] ${name}: runner crashed: ${(err as Error).stack ?? err}`);
	process.exit(3);
}
