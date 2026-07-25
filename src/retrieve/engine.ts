// LLM engine interface — calls OpenAI / OpenRouter APIs
// Prompts for links, parses URLs from text responses

export interface EngineResult {
  query: string;
  urls: string[];
}

export async function runQuery(query: string): Promise<EngineResult> {
  return { query, urls: [] };
}

export async function runAllQueries(queries: string[]): Promise<EngineResult[]> {
  return [];
}
