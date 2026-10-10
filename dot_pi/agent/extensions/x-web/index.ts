import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { truncateHead, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const MAX_DOWNLOAD_BYTES = 5_000_000;
const FETCH_TIMEOUT_MS = 20_000;
const SEARCH_RESULT_LIMIT = 10;
const SEARCH_PROVIDER = "DuckDuckGo";
const DUCKDUCKGO_SEARCH_URL = "https://html.duckduckgo.com/html/";
const DUCKDUCKGO_URL = "https://duckduckgo.com";

type SearchResult = {
  title: string;
  url: string;
};

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function htmlToText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<(script|style|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url: URL, signal?: AbortSignal) {
  const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const response = await fetch(url, {
    signal: combinedSignal,
    headers: {
      Accept: "text/html, text/plain, application/json",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": "Mozilla/5.0 (compatible; Pi web tools)",
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (contentLength > MAX_DOWNLOAD_BYTES) {
    throw new Error("Response exceeds 5MB");
  }

  const body = await response.text();
  if (Buffer.byteLength(body) > MAX_DOWNLOAD_BYTES) {
    throw new Error("Response exceeds 5MB");
  }

  return { body, url: response.url };
}

function parseDuckDuckGoResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attributes = match[1];
    const content = match[2];
    if (!/class=["'][^"']*result__a/i.test(attributes)) continue;

    const href = attributes.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;

    const redirectUrl = new URL(decodeHtmlEntities(href), DUCKDUCKGO_URL);
    const resultUrl = redirectUrl.searchParams.get("uddg") ?? redirectUrl.href;
    results.push({ title: htmlToText(content), url: resultUrl });
  }

  return results;
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Search DuckDuckGo and return result titles and URLs.",
    promptSnippet: "Search the web for current information and sources",
    promptGuidelines: [
      "Use web_search to find sources, then use web_fetch on relevant results " +
        "before answering factual questions.",
    ],
    parameters: Type.Object({ query: Type.String({ description: "Search query" }) }),
    async execute(_id, { query }, signal) {
      const searchUrl = new URL(DUCKDUCKGO_SEARCH_URL);
      searchUrl.searchParams.set("q", query);

      const response = await fetchText(searchUrl, signal);
      const results = parseDuckDuckGoResults(response.body);
      if (results.length === 0) {
        throw new Error("No search results found");
      }

      const formattedResults = results
        .slice(0, SEARCH_RESULT_LIMIT)
        .map((result, index) => `${index + 1}. ${result.title}\n${result.url}`)
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `Provider: ${SEARCH_PROVIDER}\n\n${formattedResults}`,
          },
        ],
        details: { provider: SEARCH_PROVIDER, results },
      };
    },
  });

  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description:
      "Fetch an HTTP(S) URL and return readable text. Downloads at most 5MB and " +
      "returns at most 50KB or 2000 lines.",
    promptSnippet: "Read the contents of a web page",
    parameters: Type.Object({ url: Type.String({ description: "Full HTTP(S) URL" }) }),
    async execute(toolCallId, { url: input }, signal) {
      const url = new URL(input);
      if (!/^https?:$/.test(url.protocol)) {
        throw new Error("URL must use HTTP or HTTPS");
      }

      const response = await fetchText(url, signal);
      const output = `URL: ${response.url}\n\n${htmlToText(response.body)}`;
      const truncatedOutput = truncateHead(output);
      let resultText = truncatedOutput.content;

      if (truncatedOutput.truncated) {
        const outputPath = join(tmpdir(), `pi-web-${toolCallId}.txt`);
        await writeFile(outputPath, output);
        resultText += `\n\n[Output truncated. Full output: ${outputPath}]`;
      }

      return {
        content: [{ type: "text", text: resultText }],
        details: { url: response.url },
      };
    },
  });
}
