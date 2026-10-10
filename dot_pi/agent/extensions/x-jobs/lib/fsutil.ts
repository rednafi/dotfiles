import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readSync, renameSync, rmSync, statSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

export { sleep };

export const sizeOf = (file: string): number => statSync(file, { throwIfNoEntry: false })?.size ?? 0;
export const errMsg = (err: unknown): string => (err instanceof Error ? err.message : String(err));

let counter = 0;

/**
 * Write through a temp file, fsync, then rename, so readers never see a
 * partial file. `check` runs on the temp file before the rename and returns
 * an error message to abort.
 */
export function atomicWrite(file: string, data: string, check?: (tmp: string) => string | undefined): void {
	mkdirSync(dirname(file), { recursive: true });
	const tmp = `${file}.tmp-${process.pid}-${counter++}`;
	const fd = openSync(tmp, "w", 0o644);
	try {
		writeSync(fd, data);
		fsyncSync(fd);
	} finally {
		closeSync(fd);
	}
	const problem = check?.(tmp);
	if (problem) {
		rmSync(tmp, { force: true });
		throw new Error(problem);
	}
	renameSync(tmp, file);
}

export function readJson<T>(file: string): T | undefined {
	if (!existsSync(file)) return undefined;
	return JSON.parse(readFileSync(file, "utf8")) as T;
}

export function writeJson(file: string, value: unknown): void {
	atomicWrite(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function pidAlive(pid: number): boolean {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (err) {
		return (err as NodeJS.ErrnoException).code === "EPERM";
	}
}

/**
 * A lock is stale when its owner pid is dead. An empty file means the owner
 * may be between open and write, so it only counts as stale after 10s.
 */
export function lockIsStale(file: string): boolean {
	let owner = Number.NaN;
	try {
		owner = Number(readFileSync(file, "utf8").trim());
	} catch {
		return false; // gone already
	}
	if (Number.isNaN(owner) || owner === 0) {
		return Date.now() - (statSync(file, { throwIfNoEntry: false })?.mtimeMs ?? 0) > 10_000;
	}
	return !pidAlive(owner);
}

/** Exclusive lock file holding our pid. Returns a release function, or undefined if held. */
export function tryLock(file: string): (() => void) | undefined {
	mkdirSync(dirname(file), { recursive: true });
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const fd = openSync(file, "wx", 0o644);
			writeSync(fd, String(process.pid));
			closeSync(fd);
			return () => {
				try {
					if (readFileSync(file, "utf8").trim() === String(process.pid)) rmSync(file, { force: true });
				} catch {}
			};
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
			if (!lockIsStale(file)) return undefined;
			rmSync(file, { force: true });
		}
	}
	return undefined;
}

/** Wait (up to timeoutMs) for the lock, then run fn. */
export async function withLock<T>(file: string, fn: () => Promise<T>, timeoutMs = 10_000): Promise<T> {
	const deadline = Date.now() + timeoutMs;
	let release = tryLock(file);
	while (!release) {
		if (Date.now() > deadline) throw new Error(`timed out waiting for lock ${file}`);
		await sleep(25);
		release = tryLock(file);
	}
	try {
		return await fn();
	} finally {
		release();
	}
}

function readAt(file: string, maxBytes: number, fromEnd: boolean): string {
	const size = sizeOf(file);
	const len = Math.min(size, maxBytes);
	if (len <= 0) return "";
	const fd = openSync(file, "r");
	try {
		const buf = Buffer.alloc(len);
		const n = readSync(fd, buf, 0, len, fromEnd ? size - len : 0);
		return buf.subarray(0, n).toString("utf8");
	} finally {
		closeSync(fd);
	}
}

export const readHead = (file: string, maxBytes: number) => readAt(file, maxBytes, false);
export const readTail = (file: string, maxBytes: number) => readAt(file, maxBytes, true);
