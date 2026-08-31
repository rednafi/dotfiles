import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	truncateHead,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const MAX_DOWNLOAD = 5_000_000;
const HTTP_TIMEOUT_MS = 20_000;

function decode(text: string) {
	return text
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function text(html: string) {
	return decode(
		html
			.replace(/<(script|style|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ")
			.replace(/<[^>]+>/g, " ")
			.replace(/&nbsp;|&#160;/gi, " "),
	)
		.replace(/\s+/g, " ")
		.trim();
}

async function get(url: URL, signal?: AbortSignal) {
	const response = await fetch(url, {
		signal: signal
			? AbortSignal.any([signal, AbortSignal.timeout(HTTP_TIMEOUT_MS)])
			: AbortSignal.timeout(HTTP_TIMEOUT_MS),
		headers: {
			Accept: "text/html, text/plain, application/json",
			"Accept-Language": "en-US,en;q=0.9",
			"User-Agent": "Mozilla/5.0 (compatible; Pi web tools)",
		},
	});
	if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
	if (Number(response.headers.get("content-length")) > MAX_DOWNLOAD) {
		throw new Error("Response exceeds 5MB");
	}
	const body = await response.text();
	if (Buffer.byteLength(body) > MAX_DOWNLOAD) throw new Error("Response exceeds 5MB");
	return { body, url: response.url };
}

function duckDuckGoResults(html: string) {
	const results: Array<{ title: string; url: string }> = [];
	for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
		if (!/class=["'][^"']*result__a/i.test(match[1])) continue;
		const href = match[1].match(/href=["']([^"']+)["']/i)?.[1];
		if (!href) continue;
		const redirect = new URL(decode(href), "https://duckduckgo.com");
		const url = redirect.searchParams.get("uddg") ?? redirect.href;
		results.push({ title: text(match[2]), url });
	}
	return results;
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "web_search",
		label: "Web Search",
		description: "Search DuckDuckGo and return result titles and URLs.",
		promptSnippet: "Search the web for current information and sources",
		promptGuidelines: ["Use web_search to find sources, then use web_fetch on relevant results before answering factual questions."],
		parameters: Type.Object({ query: Type.String({ description: "Search query" }) }),
		async execute(_id, { query }, signal) {
			const search = new URL("https://html.duckduckgo.com/html/");
			search.searchParams.set("q", query);
			const provider = "DuckDuckGo";
			const results = duckDuckGoResults((await get(search, signal)).body);
			if (!results.length) throw new Error("No search results found");

			const output = results.slice(0, 10).map((result, i) => `${i + 1}. ${result.title}\n${result.url}`).join("\n\n");
			return { content: [{ type: "text", text: `Provider: ${provider}\n\n${output}` }], details: { provider, results } };
		},
	});

	pi.registerTool({
		name: "web_fetch",
		label: "Web Fetch",
		description: "Fetch an HTTP(S) URL and return readable text. Downloads at most 5MB and returns at most 50KB or 2000 lines.",
		promptSnippet: "Read the contents of a web page",
		parameters: Type.Object({ url: Type.String({ description: "Full HTTP(S) URL" }) }),
		async execute(toolCallId, { url: input }, signal) {
			const url = new URL(input);
			if (!/^https?:$/.test(url.protocol)) throw new Error("URL must use HTTP or HTTPS");
			const response = await get(url, signal);
			const output = `URL: ${response.url}\n\n${text(response.body)}`;
			const truncated = truncateHead(output, { maxBytes: DEFAULT_MAX_BYTES, maxLines: DEFAULT_MAX_LINES });
			let result = truncated.content;
			if (truncated.truncated) {
				const path = join(tmpdir(), `pi-web-${toolCallId}.txt`);
				await writeFile(path, output);
				result += `\n\n[Output truncated. Full output: ${path}]`;
			}
			return { content: [{ type: "text", text: result }], details: { url: response.url } };
		},
	});
}
