// Aggregate engine results into a source leaderboard + visibility score.
import { EngineResult, RetrieveOutput, SourceStats } from "./types";
import { QueryResult } from "../contract";

const MAX_SOURCES = 20;

/** Normalize a hostname: lowercase, strip a www. prefix and trailing slashes. */
export function normalizeDomain(host: string): string {
  return host.toLowerCase().replace(/^www\./, "").replace(/\/+$/, "");
}

/** Extract a normalized domain from a full URL or bare host. */
export function extractDomain(url: string): string {
  try {
    const u = new URL(url.includes("://") ? url : `https://${url}`);
    return normalizeDomain(u.hostname);
  } catch {
    return normalizeDomain(url);
  }
}

function urlToDomain(url: string): string | null {
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return null;
  }
}

/**
 * Group results by query (merging engines), count per-domain presence, mark the
 * client, and score visibility = queries citing the client / queries with results.
 */
export function aggregate(results: EngineResult[], clientDomain: string): RetrieveOutput {
  const client = normalizeDomain(clientDomain);

  // Merge every engine's URLs for the same query text.
  const urlsByQuery = new Map<string, string[]>();
  for (const r of results) {
    urlsByQuery.set(r.query, (urlsByQuery.get(r.query) ?? []).concat(r.urls));
  }

  const domainCounts = new Map<string, number>();
  let citedQueries = 0;
  let totalQueries = 0;
  const queries: QueryResult[] = [];

  for (const [query, urls] of urlsByQuery) {
    const seenUrls = new Set<string>();
    const cited_urls: string[] = [];
    for (const u of urls) {
      if (!seenUrls.has(u)) {
        seenUrls.add(u);
        cited_urls.push(u);
      }
    }
    const citedDomainsMap = new Map<string, true>();
    const cited_domains: string[] = [];
    for (const u of cited_urls) {
      const d = extractDomain(u);
      if (!citedDomainsMap.has(d)) {
        citedDomainsMap.set(d, true);
        cited_domains.push(d);
      }
    }
    queries.push({
      query,
      cited_urls,
      cited_domains,
      client_cited: citedDomainsMap.has(client),
      citation_count: cited_urls.length,
    });

    const domains = new Set<string>();
    for (const u of urls) {
      const d = urlToDomain(u);
      if (d) domains.add(d);
    }
    if (domains.size === 0) continue;

    totalQueries++;
    for (const d of domains) {
      domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1);
    }
    if (domains.has(client)) citedQueries++;
  }

  const sources: SourceStats[] = [...domainCounts.entries()]
    .map(([domain, citation_count]) => ({
      domain,
      citation_count,
      client_present: domain === client,
    }))
    .sort((a, b) => b.citation_count - a.citation_count)
    .slice(0, MAX_SOURCES);

  const visibility = totalQueries === 0 ? 0 : round(citedQueries / totalQueries);

  return {
    score: { visibility, cited_queries: citedQueries, total_queries: totalQueries },
    sources,
    queries,
  };
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
