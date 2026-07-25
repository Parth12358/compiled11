// LLM answer-engine adapters. Each runs the full query list and returns the URLs
// the engine cited per query. Primary: OpenAI Responses API (web_search tool,
// structured url_citation annotations). Fallback: OpenRouter :online.
//
// Both engines cache per-query results to disk and never throw — a failed query
// yields an empty url list rather than aborting the run.

import OpenAI from "openai";
import { EngineResult } from "./types";
import { getCache, setCache } from "./cache";

const OPENAI_MODEL = "gpt-5.6";
// :online models do not exist on OpenRouter; Sonar returns citations natively.
const OPENROUTER_MODEL = "perplexity/sonar";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const QUERY_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DEBUG = !!process.env.RETRIEVE_DEBUG;
function debug(...args: unknown[]): void {
  if (DEBUG) console.error("[retrieve]", ...args);
}

function prompt(query: string): string {
  return `${query}\n\nList the most authoritative sources and cite their URLs.`;
}

export async function runOpenAI(queries: string[]): Promise<EngineResult[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];
  const client = new OpenAI({ apiKey });

  const results: EngineResult[] = [];
  for (const query of queries) {
    const urls = await cached("openai", query, () => openAIQuery(client, query));
    results.push({ query, urls, source: "openai" });
  }
  return results;
}

export async function runOpenRouter(queries: string[]): Promise<EngineResult[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return [];

  const results: EngineResult[] = [];
  for (const query of queries) {
    const urls = await cached("openrouter", query, () => openRouterQuery(apiKey, query));
    results.push({ query, urls, source: "openrouter" });
  }
  return results;
}

/** Cache wrapper: reuse a fresh cached url list, else run and cache non-empty results. */
async function cached(
  engine: string,
  query: string,
  run: () => Promise<string[]>
): Promise<string[]> {
  const key = `${engine}:${query}`;
  const hit = await getCache(key);
  if (Array.isArray(hit)) return hit as string[];

  const urls = await run();
  if (urls.length) await setCache(key, urls);
  return urls;
}

async function openAIQuery(client: OpenAI, query: string): Promise<string[]> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.responses.create(
        {
          model: OPENAI_MODEL,
          input: prompt(query),
          tools: [{ type: "web_search", search_context_size: "low" } as any],
        },
        { timeout: QUERY_TIMEOUT_MS }
      );
      return dedupe(extractOpenAICitations(response));
    } catch (err: any) {
      if (err?.status === 429 && attempt < MAX_RETRIES) {
        await sleep(1000);
        continue;
      }
      debug(`openai "${query}" failed:`, err?.status ?? "", err?.message ?? err);
      return [];
    }
  }
  return [];
}

async function openRouterQuery(apiKey: string, query: string): Promise<string[]> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://cited.dev",
          "X-Title": "CITED",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [{ role: "user", content: prompt(query) }],
        }),
      });
      clearTimeout(timer);

      if (res.status === 429 && attempt < MAX_RETRIES) {
        await sleep(1000);
        continue;
      }
      if (!res.ok) {
        debug(`openrouter "${query}" HTTP ${res.status}:`, (await res.text()).slice(0, 200));
        return [];
      }
      return dedupe(extractOpenRouterCitations(await res.json()));
    } catch (err: any) {
      clearTimeout(timer);
      debug(`openrouter "${query}" failed:`, err?.message ?? err);
      return [];
    }
  }
  return [];
}

function extractOpenAICitations(response: any): string[] {
  const urls: string[] = [];
  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      for (const ann of content?.annotations ?? []) {
        if (ann?.type === "url_citation" && ann?.url) urls.push(ann.url);
      }
    }
  }
  return urls;
}

function extractOpenRouterCitations(data: any): string[] {
  const urls: string[] = [];
  if (Array.isArray(data?.citations)) {
    for (const c of data.citations) {
      if (typeof c === "string" && c) urls.push(c);
    }
  }
  for (const ann of data?.choices?.[0]?.message?.annotations ?? []) {
    const url = ann?.url_citation?.url ?? ann?.url;
    if (typeof url === "string" && url) urls.push(url);
  }
  return urls;
}

function dedupe(urls: string[]): string[] {
  return [...new Set(urls)];
}
