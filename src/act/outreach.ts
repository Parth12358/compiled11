import * as cheerio from "cheerio";
import type { OutreachTarget, QueryResult, Source, AuditResult, Client, CrustCompany } from "../contract";
import { crustdata } from "./adapters/crustdata";

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

const UA = "CITED-outreach/0.1";

function safeFetch(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function hostname(raw: string): string {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//, "").split(/[\/\?#]/)[0];
  }
}

function normalizeUrl(raw: string): string {
  if (!/^https?:\/\//i.test(raw)) {
    return `https://${raw}`;
  }
  return raw;
}

function isNeverCall(domain: string): boolean {
  const h = hostname(domain).replace(/^www\./, "");
  return NEVER_CALL.some(
    (d) => h === d || h.endsWith("." + d),
  );
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

  return "other";
}

// ---------------------------------------------------------------------------
// findPhone
// ---------------------------------------------------------------------------

const NA_PHONE_RE = /(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/;

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
  const body = $("body").text() || "";
  const lines = body.split("\n");
  const joined = lines.join(" ");
  const m = NA_PHONE_RE.exec(joined);
  if (!m) return null;
  const digits = `${m[1]}${m[2]}${m[3]}`;
  if (isObviousNonPhone(digits)) return null;
  return digits;
}

async function scrapePage(
  url: string,
): Promise<string | null> {
  let resp: Response;
  try {
    resp = await safeFetch(url, { headers: { "User-Agent": UA } }, 10_000);
  } catch {
    return null;
  }
  if (!resp.ok) return null;

  let html: string;
  try {
    html = await resp.text();
  } catch {
    return null;
  }

  const $ = cheerio.load(html);

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
  const base = normalizeUrl(domain);
  let origin: string;
  try {
    origin = new URL(base).origin;
  } catch {
    return null;
  }

  let phone = await scrapePage(base);
  if (phone) return phone;

  const subPaths = ["/contact", "/contact-us", "/about"];
  for (const path of subPaths) {
    phone = await scrapePage(`${origin}${path}`);
    if (phone) return phone;
  }

  return null;
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
      let company: CrustCompany | null = null;
      let name = c.domain;
      let companyId: number | null = null;

      try {
        company = await crustdata.enrichDomain(c.domain);
      } catch {
        /* fall back to domain */
      }

      if (company) {
        name = company.name || name;
        companyId = company.company_id ?? null;
      }

      let contactPerson: string | null = null;
      let contactTitle: string | null = null;

      if (company) {
        try {
          const contacts = await crustdata.findContacts(company, {
            titles: [
              "membership",
              "partnership",
              "director",
              "editor",
              "content",
              "marketing",
              "communications",
              "outreach",
              "owner",
              "president",
            ],
            limit: 3,
          });
          if (contacts.length > 0) {
            contactPerson = contacts[0].name ?? null;
            contactTitle = contacts[0].title ?? null;
          }
        } catch {
          /* leave null */
        }
      }

      let phone: string | null = null;
      try {
        phone = await findPhone(c.domain);
      } catch {
        /* leave null */
      }
      if (phone === null) return null;

      const category = classifyDomain(c.domain);

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
        contact_person: contactPerson,
        contact_title: contactTitle,
        why_relevant: whyRelevant,
        cited_by_engine: true,
        crustdata_company_id: companyId,
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
