// Aggregate citations by domain, detect client presence, compute score
import { EngineResult } from "./engine";

export interface SourceStats {
  domain: string;
  citation_count: number;
  client_present: boolean;
}

export function aggregate(
  results: EngineResult[],
  clientDomain: string
): { sources: SourceStats[]; score: { visibility: number; cited_queries: number; total_queries: number } } {
  const sources: SourceStats[] = [];
  const score = { visibility: 0, cited_queries: 0, total_queries: 0 };
  return { sources, score };
}
