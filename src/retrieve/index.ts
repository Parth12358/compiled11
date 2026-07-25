// Retrieval orchestrator — scrape → queries → engines → aggregate → output.
// Person A (Retrieval) entry point. Delivers score + sources per fixture.json.

import { RetrieveOutput } from "./types";
import { scrapeHomepage } from "./scrape";
import { buildQueries } from "./queries";
import { runOpenAI, runOpenRouter } from "./engine";
import { aggregate, extractDomain } from "./aggregate";

const EMPTY: RetrieveOutput = {
  score: { visibility: 0, cited_queries: 0, total_queries: 0 },
  sources: [],
};

/**
 * Run the full retrieval pipeline for a client URL. Available engines
 * (OpenAI, OpenRouter) run in parallel; missing keys are skipped. Never throws.
 */
export async function retrieve(clientUrl: string): Promise<RetrieveOutput> {
  const clientDomain = extractDomain(clientUrl);

  const { category, keywords } = await scrapeHomepage(clientUrl);
  const queries = buildQueries(category, keywords);

  const tasks: Promise<import("./types").EngineResult[]>[] = [];
  if (process.env.OPENAI_API_KEY) tasks.push(runOpenAI(queries));
  if (process.env.OPENROUTER_API_KEY) tasks.push(runOpenRouter(queries));

  if (tasks.length === 0) return EMPTY;

  const combined = (await Promise.all(tasks)).flat();
  return aggregate(combined, clientDomain);
}

export type { RetrieveOutput, Score, SourceStats } from "./types";
