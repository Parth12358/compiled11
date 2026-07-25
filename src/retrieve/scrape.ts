// Fetch the client homepage and extract a category + keyword seed for queries.
// Best-effort: any failure falls back to a slug derived from the hostname.

export interface ScrapeResult {
  category: string;
  keywords: string[];
}

// On cached runs the homepage scrape is the only network call, so it sets the
// floor latency for every run. 5s is plenty for a live site; override if needed.
const FETCH_TIMEOUT_MS = parseInt(process.env.SCRAPE_TIMEOUT || "5000", 10);

/**
 * Scrape the homepage for <title>, meta description, meta keywords and OG tags,
 * returning a category string and a list of seed keywords. Never throws.
 */
export async function scrapeHomepage(clientUrl: string): Promise<ScrapeResult> {
  const url = normalizeUrl(clientUrl);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CITED-bot/0.1)" },
    });
    clearTimeout(timer);

    if (res.ok) {
      const html = await res.text();
      const parsed = parseMeta(html);
      if (parsed.category || parsed.keywords.length) return parsed;
    }
  } catch {
    // fall through to hostname fallback
  }
  return { category: hostnameSlug(url), keywords: [] };
}

function parseMeta(html: string): ScrapeResult {
  const metaKeywords = readMeta(html, "keywords");
  const description = readMeta(html, "description") ?? readMeta(html, "og:description");
  const title = readTitle(html) ?? readMeta(html, "og:title");

  const keywords = new Set<string>();
  if (metaKeywords) {
    for (const k of metaKeywords.split(",").map((s) => s.trim()).filter(Boolean)) {
      keywords.add(k.toLowerCase());
    }
  }

  let category = "";
  if (keywords.size) {
    category = [...keywords][0];
  } else if (title) {
    category = cleanTitle(title);
  } else if (description) {
    category = description.split(/[.,]/)[0].trim();
  }

  return { category: category.toLowerCase(), keywords: [...keywords] };
}

function readTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? decodeEntities(m[1].trim()) : null;
}

function readMeta(html: string, name: string): string | null {
  // Handle both attribute orders: name/property first, or content first.
  const attr = `(?:name|property)=["']${escapeRe(name)}["']`;
  const content = `content=["']([^"']*)["']`;
  const forward = html.match(new RegExp(`<meta[^>]+${attr}[^>]*${content}`, "i"));
  if (forward) return decodeEntities(forward[1].trim());
  const backward = html.match(new RegExp(`<meta[^>]+${content}[^>]*${attr}`, "i"));
  return backward ? decodeEntities(backward[1].trim()) : null;
}

/** Take the most useful category segment from a title, dropping taglines. */
function cleanTitle(title: string): string {
  const segments = title.split(/[|\-–—:•]/).map((s) => s.trim()).filter(Boolean);
  if (segments.length <= 1) return title.trim();
  // Prefer short segments (>= 2 chars) — brand/product names are short.
  // Long segments are typically taglines ("Source platform for everything user").
  const short = segments
    .filter((s) => s.length >= 2)
    .sort((a, b) => a.length - b.length);
  return short[0] ?? title.trim();
}

function normalizeUrl(url: string): string {
  return url.includes("://") ? url : `https://${url}`;
}

function hostnameSlug(url: string): string {
  try {
    const host = new URL(normalizeUrl(url)).hostname.replace(/^www\./, "");
    const label = host.split(".")[0] ?? host;
    return label.replace(/[-_]+/g, " ").trim();
  } catch {
    return url;
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
