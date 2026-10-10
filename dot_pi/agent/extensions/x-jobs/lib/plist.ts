import { execFileSync } from "node:child_process";
import { type Config, paths } from "./config.ts";
import type { Job, Registry } from "./types.ts";

export function xmlEscape(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

type PlistValue = string | number | boolean | PlistValue[] | { [k: string]: PlistValue };

function render(v: PlistValue, indent: string): string {
	const next = `${indent}\t`;
	if (typeof v === "string") return `${indent}<string>${xmlEscape(v)}</string>`;
	if (typeof v === "number") return `${indent}<integer>${v}</integer>`;
	if (typeof v === "boolean") return `${indent}<${v}/>`;
	if (Array.isArray(v)) return `${indent}<array>\n${v.map((x) => render(x, next)).join("\n")}\n${indent}</array>`;
	const keys = Object.keys(v);
	if (!keys.length) return `${indent}<dict/>`;
	const body = keys.map((k) => `${next}<key>${xmlEscape(k)}</key>\n${render(v[k], next)}`).join("\n");
	return `${indent}<dict>\n${body}\n${indent}</dict>`;
}

export function toPlist(dict: Record<string, PlistValue>): string {
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
		'<plist version="1.0">',
		render(dict, ""),
		"</plist>",
		"",
	].join("\n");
}

export function renderJobPlist(cfg: Config, reg: Registry, name: string, job: Job): string {
	const d: Record<string, PlistValue> = {
		Label: paths.label(cfg, name),
		ProgramArguments: [reg.nodePath, paths.runJobScript(cfg), name],
		EnvironmentVariables: { PATH: reg.env.PATH, ...cfg.passthroughEnv },
		WorkingDirectory: paths.work(cfg),
		StandardOutPath: paths.launchdLog(cfg, name),
		StandardErrorPath: paths.launchdLog(cfg, name),
		ProcessType: "Background",
		RunAtLoad: false,
	};
	if ("intervalSeconds" in job.schedule) d.StartInterval = job.schedule.intervalSeconds;
	else d.StartCalendarInterval = job.schedule.calendar.map((e) => ({ ...e }) as Record<string, PlistValue>);
	return toPlist(d);
}

/** Run `plutil -lint`. Returns an error message, or undefined if the file is valid. */
export function lintPlist(cfg: Config, file: string): string | undefined {
	try {
		execFileSync(cfg.plutil, ["-lint", file], { stdio: ["ignore", "pipe", "pipe"] });
		return undefined;
	} catch (err) {
		const e = err as { code?: string; stdout?: Buffer; stderr?: Buffer; message: string };
		// plutil only exists on macOS; on other systems skip linting.
		if (e.code === "ENOENT") return undefined;
		return `${e.stdout?.toString() ?? ""}${e.stderr?.toString() ?? ""}`.trim() || e.message;
	}
}
