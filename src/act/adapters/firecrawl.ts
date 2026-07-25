// Optional Firecrawl adapter — last-resort page fetcher for sites that block plain fetch
// or render contact details with JavaScript.  Skipped entirely (zero API calls) when
// FIRECRAWL_API_KEY is not set.  The free fetch path already covers the callable target
// class (chambers, associations, niche directories) — this is only a fallback for large
// consumer platforms behind bot protection.

const BASE = "https://api.firecrawl.dev";

export function firecrawlEnabled(): boolean {
  const k = process.env.FIRECRAWL_API_KEY;
  return typeof k === "string" && k.length > 0;
}

function key(): string {
  return process.env.FIRECRAWL_API_KEY ?? "";
}

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" };
}

function safeFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function scrapeHtml(url: string, timeoutMs?: number): Promise<string | null> {
  if (!firecrawlEnabled()) return null;
  try {
    const res = await safeFetch(
      `${BASE}/v1/scrape`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ url, formats: ["html"] }),
      },
      timeoutMs ?? 20_000,
    );
    if (!res.ok) {
      console.error(`firecrawl scrapeHtml HTTP ${res.status} for ${url}`);
      return null;
    }
    const json: unknown = await res.json();
    if (typeof json !== "object" || json === null) return null;
    const body = json as Record<string, unknown>;
    if (body.success !== true) return null;
    const data = body.data;
    if (typeof data !== "object" || data === null) return null;
    const d = data as Record<string, unknown>;
    if (typeof d.html === "string" && d.html.length > 0) return d.html;
    if (typeof d.markdown === "string" && d.markdown.length > 0) return d.markdown;
    return null;
  } catch (err) {
    console.error(`firecrawl scrapeHtml failed for ${url}:`, err);
    return null;
  }
}

export async function scrapeMany(
  urls: string[],
  opts?: { concurrency?: number },
): Promise<Map<string, string>> {
  if (!firecrawlEnabled()) return new Map();
  const concurrency = opts?.concurrency ?? 2;
  const results = new Map<string, string>();
  const queue = [...urls];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;
      const html = await scrapeHtml(url);
      if (html !== null) {
        results.set(url, html);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());
  try {
    await Promise.all(workers);
  } catch {
    // scrapeHtml already catches internally — this is a safety net
  }
  return results;
}
