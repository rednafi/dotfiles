import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { after, describe, test } from "node:test";
import { paths } from "../../lib/config.ts";
import { type DriftIssue, diffState, fixFor } from "../../lib/drift.ts";
import { tryLock, withLock } from "../../lib/fsutil.ts";
import { loadRegistry, migrate, RegistryError, saveRegistry } from "../../lib/registry.ts";
import { makeEnv } from "../helpers.ts";

const e = makeEnv();
after(() => e.cleanup());

describe("registry", () => {
	test("missing file -> empty registry with captured PATH and node", () => {
		const r = loadRegistry(e.cfg);
		assert.deepEqual(r.jobs, {});
		assert.ok(r.env.PATH);
		assert.ok(r.nodePath.endsWith("node"));
	});
	test("save then load round-trips", () => {
		const r = loadRegistry(e.cfg);
		r.jobs.x = { prompt: "p" } as never;
		saveRegistry(e.cfg, r);
		assert.equal(loadRegistry(e.cfg).jobs.x.prompt, "p");
		assert.deepEqual(
			readdirSync(e.root).filter((f) => f.includes(".tmp-")),
			[],
			"no temp files left",
		);
	});
	test("corrupt JSON is refused, never overwritten", () => {
		writeFileSync(paths.registry(e.cfg), "{not json");
		assert.throws(() => loadRegistry(e.cfg), RegistryError);
		assert.equal(readFileSync(paths.registry(e.cfg), "utf8"), "{not json");
	});
	test("v0 (no version) migrates", () => {
		const r = migrate({ jobs: { a: { prompt: "p" } } });
		assert.equal(r.version, 1);
		assert.ok(r.env.PATH);
		assert.equal(r.jobs.a.prompt as string, "p");
	});
	test("future version refused", () => assert.throws(() => migrate({ version: 99, jobs: {} }), /version 99/));
	test("non-object refused", () => {
		assert.throws(() => migrate([]), RegistryError);
		assert.throws(() => migrate({ jobs: [] }), RegistryError);
	});
	test("stored PATH/node are kept (stable plists across shells)", () => {
		const r = migrate({ version: 1, env: { PATH: "/x" }, nodePath: "/y/node", jobs: {} });
		assert.equal(r.env.PATH, "/x");
		assert.equal(r.nodePath, "/y/node");
	});
	test("atomic write: a killed writer leaves the old file intact", async () => {
		saveRegistry(e.cfg, { version: 1, env: { PATH: "/p" }, nodePath: "/n", jobs: {} });
		const before = readFileSync(paths.registry(e.cfg), "utf8");
		// A child that starts writing a huge registry then gets SIGKILLed mid-way.
		const script = `
			import { atomicWrite } from ${JSON.stringify(new URL("../../lib/fsutil.ts", import.meta.url).pathname)};
			atomicWrite(${JSON.stringify(paths.registry(e.cfg))}, "x".repeat(400*1024*1024));`;
		const child = spawn(process.execPath, ["--input-type=module", "-e", script], { stdio: "ignore" });
		await new Promise((r) => setTimeout(r, 150));
		child.kill("SIGKILL");
		await new Promise((r) => child.on("exit", r));
		assert.equal(readFileSync(paths.registry(e.cfg), "utf8"), before);
	});
});

describe("locks", () => {
	const f = `${e.root}/t.lock`;
	test("second tryLock fails while held, works after release", () => {
		const rel = tryLock(f);
		assert.ok(rel);
		assert.equal(tryLock(f), undefined);
		rel();
		const rel2 = tryLock(f);
		assert.ok(rel2);
		rel2();
	});
	test("lock owned by a dead pid is stolen", () => {
		writeFileSync(f, "999999");
		const rel = tryLock(f);
		assert.ok(rel);
		rel();
		assert.equal(existsSync(f), false);
	});
	test("withLock times out when held by a live pid", async () => {
		writeFileSync(f, String(process.ppid));
		await assert.rejects(withLock(f, async () => 1, 100), /timed out/);
		writeFileSync(f, "999999");
	});
	test("withLock serializes concurrent writers", async () => {
		const order: string[] = [];
		const job = (id: string) =>
			withLock(f, async () => {
				order.push(`${id}+`);
				await new Promise((r) => setTimeout(r, 30));
				order.push(`${id}-`);
			});
		await Promise.all([job("a"), job("b"), job("c")]);
		for (let i = 0; i < order.length; i += 2) assert.equal(order[i].slice(0, 1), order[i + 1].slice(0, 1), order.join());
	});
});

describe("diffState: every registry/disk/loaded combination", () => {
	const D = "<desired/>";
	type Case = [string, { inReg: boolean; enabled: boolean; disk: "none" | "same" | "stale"; loaded: boolean }, DriftIssue[]];
	const cases: Case[] = [];
	for (const inReg of [true, false])
		for (const enabled of inReg ? [true, false] : [false])
			for (const disk of ["none", "same", "stale"] as const)
				for (const loaded of [true, false]) {
					const expected: DriftIssue[] = [];
					if (inReg && enabled) {
						if (disk === "none") expected.push("missing-plist");
						if (disk === "stale") expected.push("stale-plist");
						if (!loaded) expected.push("not-loaded");
					} else if (inReg) {
						if (disk !== "none") expected.push("unexpected-plist");
						if (loaded) expected.push("unexpected-loaded");
					} else if (disk !== "none" || loaded) expected.push("orphan");
					cases.push([`reg=${inReg} enabled=${enabled} disk=${disk} loaded=${loaded}`, { inReg, enabled, disk, loaded }, expected]);
				}
	test("covers 18 combinations", () => assert.equal(cases.length, 18));
	for (const [label, c, expected] of cases) {
		test(label, () => {
			const registry = new Map<string, string | null>();
			if (c.inReg) registry.set("j", c.enabled ? D : null);
			const disk = new Map<string, string>();
			if (c.disk !== "none") disk.set("j", c.disk === "same" ? D : "<old/>");
			const loaded = new Set(c.loaded ? ["j"] : []);
			assert.deepEqual(diffState({ registry, disk, loaded }).get("j") ?? [], expected);
			const fix = fixFor(expected);
			if (!expected.length) assert.equal(fix, "none");
			else if (c.inReg && c.enabled) assert.equal(fix, "reload");
			else assert.equal(fix, "unload");
		});
	}
});
