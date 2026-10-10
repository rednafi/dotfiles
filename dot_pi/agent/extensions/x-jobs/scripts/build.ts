// Emit dist/ with types stripped. Only needed for npm tarballs: Node will not
// strip types from files under node_modules, and launchd runs bin/run-job
// with plain node. Git and local installs run the .ts sources directly.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
for (const dir of ["lib", "bin"]) {
	mkdirSync(join(dist, dir), { recursive: true });
	for (const f of readdirSync(join(root, dir)).filter((f) => f.endsWith(".ts"))) {
		const js = stripTypeScriptTypes(readFileSync(join(root, dir, f), "utf8"))
			// Relative .ts specifiers -> .js
			.replace(/(from\s+["'])(\.{1,2}\/[^"']+)\.ts(["'])/g, "$1$2.js$3");
		writeFileSync(join(dist, dir, f.replace(/\.ts$/, ".js")), js);
	}
}
console.log(`built ${dist}`);
