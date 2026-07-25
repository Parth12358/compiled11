import * as cheerio from "cheerio";
import type { OutreachTarget, QueryResult, Source, AuditResult, Client } from "../contract";


export const NEVER_CALL: string[] = [
  "reddit.com",
  "wikipedia.org",
  "quora.com",
  "youtube.com",
  "facebook.com",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "instagram.com",
  "tiktok.com",
  "medium.com",
  "pinterest.com",
  "amazon.com",
  "google.com",
  "apple.com",
  "github.com",
  "nytimes.com",
  "forbes.com",
  "wsj.com",
  "bbc.com",
  "cnn.com",
];

function hostname(raw: string): string {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//, "").split(/[\/\?#]/)[0];
  }
}

function isNeverCall(domain: string): boolean {
  const h = hostname(domain).replace(/^www\./, "");
  return NEVER_CALL.some(
    (d) => h === d || h.endsWith("." + d),
  );
}

// ---------------------------------------------------------------------------
// fetchHtml — shared browser-like fetcher
// ---------------------------------------------------------------------------

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const resp = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept": "text/html",
      },
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// candidateUrls
// ---------------------------------------------------------------------------

function candidateUrls(domain: string): string[] {
  const hosts = domain.startsWith("www.") ? [domain] : [domain, `www.${domain}`];
  const paths = ["", "/contact", "/contact-us", "/about", "/about-us", "/membership", "/join", "/advertise"];
  const urls: string[] = [];
  for (const host of hosts) {
    for (const path of paths) {
      urls.push(`https://${host}${path}`);
    }
  }
  return urls;
}

// ---------------------------------------------------------------------------
// classifyDomain
// ---------------------------------------------------------------------------

export function classifyDomain(
  domain: string,
  title?: string | null,
): OutreachTarget["category"] {
  const d = domain.toLowerCase();
  const t = (title ?? "").toLowerCase();

  if (d.includes("chamber")) return "chamber";

  if (
    d.includes("association") ||
    d.includes("assoc") ||
    d.includes("society") ||
    d.includes("council") ||
    d.includes("guild")
  ) {
    return "association";
  }

  if (
    d.includes("directory") ||
    d.includes("directories") ||
    d.includes("listings") ||
    d.includes("yellowpages") ||
    d.includes("find") ||
    d.includes("locator")
  ) {
    return "directory";
  }

  const listicleRe = /best|top \d|vs\.?|review|comparison|\d{1,2} best/i;
  if (listicleRe.test(d) || listicleRe.test(t)) {
    return "listicle";
  }

  if (
    d.includes("blog") ||
    d.includes("news") ||
    d.includes("magazine") ||
    d.includes("journal")
  ) {
    return "blog";
  }

  // title fallback when domain gave nothing
  if (t) {
    if (t.includes("chamber")) return "chamber";

    if (
      t.includes("association") ||
      t.includes("assoc") ||
      t.includes("society") ||
      t.includes("council") ||
      t.includes("guild") ||
      t.includes("board of") ||
      t.includes("institute") ||
      t.includes("academy")
    ) {
      return "association";
    }

    if (
      t.includes("directory") ||
      t.includes("directories") ||
      t.includes("listings") ||
      t.includes("yellowpages") ||
      t.includes("find") ||
      t.includes("locator") ||
      t.includes("find a") ||
      t.includes("search for a") ||
      t.includes("book a")
    ) {
      return "directory";
    }
  }

  return "other";
}

// ---------------------------------------------------------------------------
// findPhone
// ---------------------------------------------------------------------------

const NA_PHONE_RE = /(?:\+?1[\s.\-]?)?\(?([2-9]\d{2})\)?[\s.\-]?(\d{3})[\s.\-]?(\d{4})(?!\d)/;

function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && digits[0] !== "0" && digits[0] !== "1") {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `+${digits}`;
  }
  return null;
}

function isObviousNonPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return true;
  if (/^(\d)\1{9,}$/.test(digits)) return true;
  const num = parseInt(digits.slice(0, 10), 10);
  if (num >= 1900 && num <= 2100) return true;
  return false;
}

function extractTelHref($: cheerio.CheerioAPI): string | null {
  const href = $('a[href^="tel:"]').first().attr("href");
  if (!href) return null;
  return href.replace(/^tel:/i, "").trim();
}

function regexPhoneFromHtml($: cheerio.CheerioAPI): string | null {
  $("script, style").remove();
  const body = $("body").text() || "";
  const lines = body.split("\n");
  const collapsed = lines.join(" ").replace(/\s+/g, " ").trim();

  const re = new RegExp(NA_PHONE_RE.source, "g");
  let m;
  while ((m = re.exec(collapsed)) !== null) {
    const matchStart = m.index;
    const matchEnd = matchStart + m[0].length;

    if (
      matchStart > 0 && /[\d.\-]/.test(collapsed[matchStart - 1])
    ) {
      continue;
    }
    if (matchEnd < collapsed.length && /[\d.\-]/.test(collapsed[matchEnd])) {
      continue;
    }

    const before = collapsed.slice(Math.max(0, matchStart - 60), matchStart).toLowerCase();
    const kw = /phone|tel(?:ephone)?|call us|call:|contact|toll|office|mobile|cell|fax/i;
    const kwMatch = before.match(kw);
    if (!kwMatch) continue;
    if (/^fax$/i.test(kwMatch[0])) continue;

    const digits = `${m[1]}${m[2]}${m[3]}`;
    if (isObviousNonPhone(digits)) continue;
    return digits;
  }

  return null;
}

function findTelephoneIn(obj: unknown): string | null {
  if (typeof obj === "string") return null;
  if (typeof obj !== "object" || obj === null) return null;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = findTelephoneIn(item);
      if (result) return result;
    }
    return null;
  }

  const rec = obj as Record<string, unknown>;
  if ("telephone" in rec && typeof rec.telephone === "string") {
    return rec.telephone;
  }

  for (const val of Object.values(rec)) {
    const result = findTelephoneIn(val);
    if (result) return result;
  }

  return null;
}

function extractJsonLdPhone($: cheerio.CheerioAPI): string | null {
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const el of scripts) {
    const text = $(el).html();
    if (!text) continue;
    try {
      const parsed = JSON.parse(text);
      const phone = findTelephoneIn(parsed);
      if (phone) return phone;
    } catch {
      continue;
    }
  }
  return null;
}

function tryExtractPhone(html: string): string | null {
  const $ = cheerio.load(html);

  const jsonLdPhone = extractJsonLdPhone($);
  if (jsonLdPhone) {
    const e164 = toE164(jsonLdPhone);
    if (e164) return e164;
  }

  const telRaw = extractTelHref($);
  if (telRaw && !isObviousNonPhone(telRaw)) {
    const e164 = toE164(telRaw);
    if (e164) return e164;
  }

  const digits = regexPhoneFromHtml($);
  if (digits) {
    const e164 = toE164(digits);
    if (e164) return e164;
  }

  return null;
}

export async function findPhone(domain: string): Promise<string | null> {
  for (const url of candidateUrls(domain)) {
    const html = await fetchHtml(url);
    if (!html) continue;
    const phone = tryExtractPhone(html);
    if (phone) return phone;
  }

  return null;
}

// ---------------------------------------------------------------------------
// fetchOrgIdentity
// ---------------------------------------------------------------------------

export async function fetchOrgIdentity(domain: string): Promise<{ name: string | null; title: string | null }> {
  const baseUrls = [`https://${domain}`];
  if (!domain.startsWith("www.")) {
    baseUrls.push(`https://www.${domain}`);
  }

  for (const url of baseUrls) {
    const html = await fetchHtml(url);
    if (!html) continue;

    const $ = cheerio.load(html);

    let name: string | null = $('meta[property="og:site_name"]').attr("content") ?? null;
    const rawTitle = $("title").text().trim() || null;

    if (!name && rawTitle) {
      name = rawTitle.replace(/\s*[|—–-]\s*.+$/, "").trim() || null;
    }

    return { name, title: rawTitle };
  }

  return { name: null, title: null };
}

// ---------------------------------------------------------------------------
// discoverTargets
// ---------------------------------------------------------------------------

function registrableDomain(domain: string): string {
  return hostname(domain).replace(/^www\./, "");
}

interface Candidate {
  domain: string;
  score: number;
  bestQuery: string;
}

export async function discoverTargets(input: {
  client: Client;
  queries: QueryResult[];
  sources: Source[];
  audit: AuditResult;
  limit?: number;
}): Promise<OutreachTarget[]> {
  const { client, queries, audit, limit } = input;

  const clientHost = (() => {
    try {
      return new URL(client.url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();

  const auditPageDomains = new Set(
    audit.pages.map((p) => {
      try {
        return new URL(p.url).hostname.toLowerCase();
      } catch {
        return "";
      }
    }),
  );

  const candMap = new Map<string, { score: number; bestQuery: string; bestCount: number }>();

  for (const q of queries) {
    if (q.client_cited) continue;
    if (q.citation_count <= 0) continue;
    for (const domain of q.cited_domains) {
      const key = registrableDomain(domain);
      const existing = candMap.get(key);
      const newScore = (existing?.score ?? 0) + 1;
      const hasBetterQuery =
        !existing || q.citation_count > existing.bestCount;
      candMap.set(key, {
        score: newScore,
        bestQuery: hasBetterQuery ? q.query : existing!.bestQuery,
        bestCount: hasBetterQuery ? q.citation_count : existing!.bestCount,
      });
    }
  }

  const candidates: Candidate[] = [];
  for (const [domain, data] of candMap) {
    if (domain === clientHost) continue;
    if (domain === "") continue;
    if (isNeverCall(domain)) continue;
    if (auditPageDomains.has(domain)) continue;
    candidates.push({
      domain,
      score: data.score,
      bestQuery: data.bestQuery,
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));
  const top = candidates.slice(0, limit ?? 5);

  const results = await Promise.all(
    top.map(async (c): Promise<OutreachTarget | null> => {
      const identityResult = await fetchOrgIdentity(c.domain).catch(() => ({ name: null, title: null }));
      const name = identityResult.name ?? c.domain;

      let phone: string | null = null;
      try {
        phone = await findPhone(c.domain);
      } catch {
        /* leave null */
      }
      if (phone === null) return null;

      const category = classifyDomain(c.domain, identityResult.title);

      let whyRelevant: string;
      if (c.score === 1) {
        whyRelevant = `Cited for "${c.bestQuery}" where ${client.name} does not appear.`;
      } else {
        whyRelevant = `Cited for "${c.bestQuery}" and ${c.score - 1} other quer${c.score - 1 === 1 ? "y" : "ies"} where ${client.name} does not appear.`;
      }

      return {
        name,
        domain: c.domain,
        phone,
        category,
        contact_person: null,
        contact_title: null,
        why_relevant: whyRelevant,
        cited_by_engine: true,
      };
    }),
  );

  const valid = results.filter((r): r is OutreachTarget => r !== null);

  return valid;
}

// ---------------------------------------------------------------------------
// buildCallBrief
// ---------------------------------------------------------------------------

export function buildCallBrief(target: OutreachTarget, client: Client): string {
  const parts: string[] = [];

  parts.push(`You are calling on behalf of ${client.name}.`);

  if (target.contact_person) {
    const title = target.contact_title ? `, the ${target.contact_title}` : "";
    parts.push(`Ask for ${target.contact_person}${title}.`);
  }

  const domainStr = target.domain ? ` ${target.domain}` : "";

  switch (target.category) {
    case "chamber":
    case "association":
      parts.push(
        `Confirm ${client.name} membership and ask to be added to the online member directory with a link to ${client.url}.`,
      );
      break;
    case "directory":
      parts.push(
        `Ask what is required to get ${client.name} listed on${domainStr}, including any fees and the timeline.`,
      );
      break;
    case "blog":
    case "listicle":
      parts.push(
        `Ask who handles editorial updates and whether ${client.name} can be considered for inclusion in the relevant roundup on${domainStr}.`,
      );
      break;
    default:
      parts.push(
        `Ask who handles website listings and how ${client.name} can be included on${domainStr}.`,
      );
      break;
  }

  parts.push(
    "Ask for the concrete next step and the expected timeline.",
  );
  parts.push(
    "Be honest that you are an automated assistant calling on behalf of the client, never claim to be a person, accept \"no\" gracefully and end the call, and never offer payment or anything of value in exchange for a link.",
  );

  return parts.join(" ");
}
