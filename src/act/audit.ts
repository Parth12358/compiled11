import * as cheerio from "cheerio";
import type { AuditResult } from "../contract";

const AI_CRAWLER_NAMES = [
  "Google-Extended",
  "GPTBot",
  "OAI-SearchBot",
  "PerplexityBot",
  "ClaudeBot",
  "Claude-SearchBot",
] as const;

function normalizeUrl(raw: string): string {
  if (!/^https?:\/\//i.test(raw)) {
    return `https://${raw}`;
  }
  return raw;
}

function safeFetch(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

interface RobotsBlock {
  agents: string[];
  allow: string[];
  disallow: string[];
}

function parseRobotsBlocks(text: string): RobotsBlock[] {
  const blocks: RobotsBlock[] = [];
  let current: RobotsBlock = { agents: [], allow: [], disallow: [] };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;

    const lower = line.toLowerCase();
    if (lower.startsWith("user-agent:")) {
      if (current.agents.length > 0) {
        blocks.push(current);
        current = { agents: [], allow: [], disallow: [] };
      }
      current.agents.push(line.slice("user-agent:".length).trim());
    } else if (lower.startsWith("allow:")) {
      current.allow.push(line.slice("allow:".length).trim());
    } else if (lower.startsWith("disallow:")) {
      current.disallow.push(line.slice("disallow:".length).trim());
    }
  }
  if (current.agents.length > 0) blocks.push(current);
  return blocks;
}

function parseAiCrawlers(robotsTxt: string): string[] {
  const blocks = parseRobotsBlocks(robotsTxt);
  const allowed: string[] = [];

  for (const block of blocks) {
    for (const agent of block.agents) {
      if (!(AI_CRAWLER_NAMES as readonly string[]).includes(agent)) continue;

      const hasFullDisallow = block.disallow.some((d) => d === "/");
      const hasAllow = block.allow.length > 0;

      if (!hasFullDisallow || hasAllow) {
        allowed.push(agent);
      }
    }
  }

  return allowed;
}

function extractNapFromJsonLd(jsonLd: unknown[]): {
  name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  hasStreet: boolean;
} {
  let name: string | null = null;
  let phone: string | null = null;
  let city: string | null = null;
  let state: string | null = null;
  let hasStreet = false;

  for (const ld of jsonLd) {
    if (typeof ld !== "object" || ld === null) continue;
    const obj = ld as Record<string, unknown>;

    const types = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]];
    const typeStrings = types.filter((t): t is string => typeof t === "string");
    const isOrg = typeStrings.some(
      (t) => t === "Organization" || t === "LocalBusiness" || t.endsWith("Business") || t.endsWith("Organization")
    );
    if (!isOrg) continue;

    if (!name && typeof obj.name === "string") name = obj.name;
    if (!phone && typeof obj.telephone === "string") phone = obj.telephone;

    const addr = obj.address;
    if (addr && typeof addr === "object") {
      const a = addr as Record<string, unknown>;
      if (!city && typeof a.addressLocality === "string") city = a.addressLocality;
      if (!state && typeof a.addressRegion === "string") state = a.addressRegion;
      if (!hasStreet && typeof a.streetAddress === "string" && a.streetAddress.trim().length > 0) {
        hasStreet = true;
      }
    }

    if (name && phone && city && state && hasStreet) break;
  }

  return { name, phone, city, state, hasStreet };
}

function extractBusinessType(jsonLd: unknown[]): string | null {
  const skipTypes = new Set(["Organization", "LocalBusiness", "WebSite", "WebPage", "Thing", "ItemList", "BreadcrumbList"]);
  for (const ld of jsonLd) {
    if (typeof ld !== "object" || ld === null) continue;
    const obj = ld as Record<string, unknown>;
    const types = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]];
    for (const t of types) {
      if (typeof t === "string" && !skipTypes.has(t)) return t;
    }
  }
  return null;
}

export async function auditSite(url: string): Promise<AuditResult> {
  const defaults: AuditResult = {
    url,
    title: null,
    meta_description: null,
    canonical: null,
    json_ld: [],
    has_llms_txt: false,
    robots_txt: null,
    ai_crawlers_allowed: [],
    nap: { name: null, phone: null, city: null, state: null, has_street: false },
    pages: [],
    category_hint: null,
  };

  url = normalizeUrl(url);
  defaults.url = url;

  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return defaults;
  }

  const ua = { headers: { "User-Agent": "CITED-audit/0.1" } };

  // Fire all four fetches in parallel — robots.txt, llms.txt, and sitemap.xml
  // have zero dependency on the HTML parse.
  const [htmlResp, robotsResp, llmsResp, sitemapResp] = await Promise.allSettled([
    safeFetch(url, ua),
    safeFetch(`${origin}/robots.txt`, ua),
    safeFetch(`${origin}/llms.txt`, ua),
    safeFetch(`${origin}/sitemap.xml`, ua),
  ]);

  // 1. Parse homepage HTML
  if (htmlResp.status === "fulfilled" && htmlResp.value.ok) {
    try {
      const html = await htmlResp.value.text();
      const $ = cheerio.load(html);

      defaults.title = $("title").first().text().trim() || null;
      defaults.meta_description = $('meta[name="description"]').attr("content")?.trim() || null;

      const canonicalHref = $('link[rel="canonical"]').attr("href");
      if (canonicalHref) {
        try { defaults.canonical = new URL(canonicalHref, url).href; }
        catch { defaults.canonical = canonicalHref; }
      }

      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const text = $(el).text().trim();
          if (text) defaults.json_ld.push(JSON.parse(text));
        } catch { /* skip malformed */ }
      });

      const napData = extractNapFromJsonLd(defaults.json_ld);
      defaults.nap.name = napData.name;
      defaults.nap.phone = napData.phone;
      defaults.nap.city = napData.city;
      defaults.nap.state = napData.state;
      defaults.nap.has_street = napData.hasStreet;

      if (!defaults.nap.name) {
        const ogSiteName = $('meta[property="og:site_name"]').attr("content")?.trim();
        if (ogSiteName) defaults.nap.name = ogSiteName;
        else defaults.nap.name = defaults.title;
      }

      if (!defaults.nap.phone) {
        const telHref = $('a[href^="tel:"]').first().attr("href");
        if (telHref) defaults.nap.phone = telHref.replace(/^tel:/i, "").trim();
      }

      defaults.category_hint = extractBusinessType(defaults.json_ld);
      if (!defaults.category_hint) {
        const kwContent = $('meta[name="keywords"]').attr("content");
        if (kwContent) {
          const term = kwContent.split(",").map((s) => s.trim()).filter(Boolean)[0];
          if (term) defaults.category_hint = term;
        }
      }
    } catch { /* return defaults */ }
  }

  // 2. Parse robots.txt
  if (robotsResp.status === "fulfilled" && robotsResp.value.ok) {
    try {
      const text = await robotsResp.value.text();
      defaults.robots_txt = text;
      defaults.ai_crawlers_allowed = parseAiCrawlers(text);
    } catch { /* leave null */ }
  }

  // 3. Check llms.txt
  if (llmsResp.status === "fulfilled" && llmsResp.value.ok) {
    defaults.has_llms_txt = true;
  }

  // 4. Parse sitemap
  if (sitemapResp.status === "fulfilled" && sitemapResp.value.ok) {
    try {
      const xml = await sitemapResp.value.text();
      const pages: { url: string; title?: string }[] = [];
      const locRe = /<loc>([^<]+)<\/loc>/g;
      let m: RegExpExecArray | null;
      while ((m = locRe.exec(xml)) !== null && pages.length < 50) {
        pages.push({ url: m[1].trim() });
      }
      defaults.pages = pages;
    } catch { /* leave empty */ }
  }

  return defaults;
}
