import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { paths } from "../../lib/config.ts";
import { lintPlist, renderJobPlist, xmlEscape } from "../../lib/plist.ts";
import type { Job, Registry } from "../../lib/types.ts";
import { validateJob } from "../../lib/validate.ts";
import { makeEnv } from "../helpers.ts";

const darwin = process.platform === "darwin";
const e = makeEnv();
after(() => e.cleanup());

// Root path with XML-hostile characters to prove escaping.
const hostile = makeEnv();
hostile.cfg.root = join(hostile.dir, `we<ird> & "root's"`);
hostile.cfg.passthroughEnv.PI_JOBS_ROOT = hostile.cfg.root;
after(() => hostile.cleanup());

const reg: Registry = { version: 1, env: { PATH: "/opt/homebrew/bin:/usr/bin:/bin" }, nodePath: "/opt/homebrew/bin/node", jobs: {} };
const job = (schedule: unknown): Job => validateJob({ prompt: "p", schedule }, { minInterval: 300, now: new Date() });

function toJson(xml: string): Record<string, unknown> {
	const f = join(e.dir, `p-${Math.random()}.plist`);
	writeFileSync(f, xml);
	return JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", f]).toString());
}

describe("xmlEscape", () => {
	test("escapes all five", () => assert.equal(xmlEscape(`&<>"'`), "&amp;&lt;&gt;&quot;&apos;"));
});

describe("renderJobPlist", { skip: !darwin && "needs plutil" }, () => {
	const schedules: [string, unknown][] = [
		["interval", { intervalSeconds: 1800 }],
		["single", { calendar: [{ Weekday: 1, Hour: 8, Minute: 45 }] }],
		["daily", { calendar: [{ Hour: 18, Minute: 0 }] }],
		[
			"grid",
			{ calendar: [1, 2, 3, 4, 5].flatMap((Weekday) => Array.from({ length: 18 }, (_, i) => ({ Weekday, Hour: 9 + Math.floor(i / 2), Minute: (i % 2) * 30 }))) },
		],
		["monthly", { calendar: [{ Day: 1, Month: 6, Hour: 0, Minute: 0 }] }],
	];
	for (const [label, schedule] of schedules) {
		test(`${label}: lints and round-trips`, () => {
			const j = job(schedule);
			const xml = renderJobPlist(e.cfg, reg, "daily-x", j);
			const f = join(e.dir, `${label}.plist`);
			writeFileSync(f, xml);
			assert.equal(lintPlist(e.cfg, f), undefined);
			const p = toJson(xml);
			assert.equal(p.Label, `${e.cfg.labelPrefix}.daily-x`);
			assert.deepEqual(p.ProgramArguments, [reg.nodePath, paths.runJobScript(e.cfg), "daily-x"]);
			assert.equal(p.RunAtLoad, false);
			assert.equal(p.ProcessType, "Background");
			assert.equal((p.EnvironmentVariables as Record<string, string>).PATH, reg.env.PATH);
			assert.equal((p.EnvironmentVariables as Record<string, string>).PI_JOBS_ROOT, e.cfg.root);
			if ("intervalSeconds" in j.schedule) {
				assert.equal(p.StartInterval, j.schedule.intervalSeconds);
				assert.equal(p.StartCalendarInterval, undefined);
			} else {
				assert.deepEqual(p.StartCalendarInterval, j.schedule.calendar);
				assert.equal(p.StartInterval, undefined);
			}
		});
	}
	test("rendering is deterministic", () => {
		const j = job({ intervalSeconds: 600 });
		assert.equal(renderJobPlist(e.cfg, reg, "a", j), renderJobPlist(e.cfg, reg, "a", j));
	});
	test("hostile paths are escaped and survive round trip", () => {
		const xml = renderJobPlist(hostile.cfg, reg, "x", job({ intervalSeconds: 600 }));
		const p = toJson(xml);
		assert.equal((p.EnvironmentVariables as Record<string, string>).PI_JOBS_ROOT, hostile.cfg.root);
		assert.ok((p.StandardOutPath as string).startsWith(hostile.cfg.root));
	});
	test("passthrough env reaches the plist", () => {
		const p = toJson(renderJobPlist(e.cfg, reg, "x", job({ intervalSeconds: 600 })));
		const env = p.EnvironmentVariables as Record<string, string>;
		assert.equal(env.PI_JOBS_PI_BIN, e.env.PI_JOBS_PI_BIN);
		assert.equal(env.PI_JOBS_NOTIFY, e.env.PI_JOBS_NOTIFY);
		assert.equal(env.PI_JOBS_DRY_RUN, undefined);
	});
	test("lint catches broken XML", () => {
		const f = join(e.dir, "broken.plist");
		writeFileSync(f, "<plist><dict><key>x</dict>");
		assert.ok(lintPlist(e.cfg, f));
	});
	test("missing plutil is skipped, not an error", () => {
		assert.equal(lintPlist({ ...e.cfg, plutil: "/nonexistent/plutil" }, "/tmp/x"), undefined);
	});
});
