// Retrieval orchestrator — scrape → queries → engines → aggregate → output.
// Person A (Retrieval) entry point. Delivers score + sources per fixture.json.

import { RetrieveOutput } from "./types";
import { scrapeHomepage } from "./scrape";
import { buildQueries } from "./queries";
import { runOpenAI, runDeepSeek } from "./engine";
// import { runOpenRouter } from "./engine";  // slower than OpenAI — disabled
import { aggregate, extractDomain } from "./aggregate";

const EMPTY: RetrieveOutput = {
  score: { visibility: 0, cited_queries: 0, total_queries: 0 },
  sources: [],
};

/**
 * Run the full retrieval pipeline for a client URL. Primary engine: OpenAI
 * Responses API (web_search tool, structured citations). DeepSeek runs through
 * the OpenAI SDK (OpenAI-compatible API, prompting for URLs from training data).
 * OpenRouter is disabled — adds latency without better results.
 * Missing keys are skipped. Never throws.
 */
export async function retrieve(clientUrl: string): Promise<RetrieveOutput> {
  const clientDomain = extractDomain(clientUrl);

  const { category, keywords } = await scrapeHomepage(clientUrl);
  const queries = buildQueries(category, keywords);

  if (process.env.RETRIEVE_VERBOSE || process.env.RETRIEVE_DEBUG) {
    console.error(
      `[retrieve] domain=${clientDomain} category="${category}" ` +
        `keywords=[${keywords.join(", ")}] queries=${queries.length}`
    );
  }

  const tasks: Promise<import("./types").EngineResult[]>[] = [];
  if (process.env.OPENAI_API_KEY) tasks.push(runOpenAI(queries));
  // if (process.env.OPENROUTER_API_KEY) tasks.push(runOpenRouter(queries));  // slower — disabled
  if (process.env.DEEPSEEK_API_KEY) tasks.push(runDeepSeek(queries));

  if (tasks.length === 0) return EMPTY;

  const combined = (await Promise.all(tasks)).flat();
  return aggregate(combined, clientDomain);
}

export type { RetrieveOutput, Score, SourceStats } from "./types";
