import type { AuditResult, Gap, QueryResult } from "../contract";

const STOPWORDS = new Set([
  "best", "top", "for", "the", "in", "near", "vs", "and", "or",
  "a", "an", "of", "to", "is", "what", "which", "should", "use", "2026",
]);

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 0 && !STOPWORDS.has(t))
  );
}

function overlapSize(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const item of a) {
    if (b.has(item)) count++;
  }
  return count;
}

function pageTargetsQuery(page: { url: string; title?: string }, queryTokens: Set<string>): boolean {
  const urlTokens = tokenize(page.url);
  if (overlapSize(queryTokens, urlTokens) >= 2) return true;

  if (page.title) {
    const titleTokens = tokenize(page.title);
    if (overlapSize(queryTokens, titleTokens) >= 2) return true;
  }

  return false;
}

export function computeGaps(
  queries: QueryResult[],
  audit: AuditResult,
  opts?: { limit?: number }
): Gap[] {
  const results: Gap[] = [];

  for (const q of queries) {
    if (q.citation_count <= 0) continue;
    if (q.client_cited) continue;

    const queryTokens = tokenize(q.query);

    let hasTargetingPage = false;
    for (const page of audit.pages) {
      if (pageTargetsQuery(page, queryTokens)) {
        hasTargetingPage = true;
        break;
      }
    }

    results.push({
      keyword: q.query,
      type: hasTargetingPage ? "thin_content" : "missing_page",
      citations: q.citation_count,
      competing_domains: q.cited_domains.slice(0, 5),
    });
  }

  results.sort((a, b) => {
    if (b.citations !== a.citations) return b.citations - a.citations;
    return a.keyword.localeCompare(b.keyword);
  });

  return results.slice(0, opts?.limit ?? 5);
}
