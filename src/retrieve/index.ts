// Retrieval orchestrator — query → engine → parse → aggregate → output
// Person A (Retrieval) entry point. Delivers score + sources.

export async function retrieve(clientUrl: string) {
  return {
    score: { visibility: 0, cited_queries: 0, total_queries: 0 },
    sources: [],
  };
}
