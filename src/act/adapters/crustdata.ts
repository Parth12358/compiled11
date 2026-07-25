import type { CrustDataAdapter, CrustCompany, CrustPerson } from "../../contract";

const BASE = "https://api.crustdata.com";

function key(): string {
  const k = process.env.CRUSTDATA_API_KEY;
  if (!k) throw new Error("CRUSTDATA_API_KEY is not set");
  return k;
}

function headers(): Record<string, string> {
  return { Authorization: `Token ${key()}`, "Content-Type": "application/json" };
}

function safeFetch(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function hasKey(): boolean {
  return !!process.env.CRUSTDATA_API_KEY;
}

function looksLikeDomain(s: string): boolean {
  return s.includes(".") && !s.includes(" ");
}

export const crustdata: CrustDataAdapter = {
  async enrichDomain(domain) {
    if (!hasKey()) return null;
    try {
      const res = await safeFetch(
        `${BASE}/screener/company?company_domain=${encodeURIComponent(domain)}`,
        { headers: headers() },
      );
      if (!res.ok) return null;
      const json: unknown = await res.json();
      if (!Array.isArray(json) || json.length === 0) return null;
      const raw = json[0];
      if (typeof raw !== "object" || raw === null) return null;
      const r = raw as Record<string, unknown>;

      const company: CrustCompany = {
        company_id: typeof r.company_id === "number" ? r.company_id : null,
        name: typeof r.company_name === "string" ? r.company_name : "",
        domain: typeof r.company_website_domain === "string" ? r.company_website_domain : domain,
        linkedin_url: typeof r.linkedin_profile_url === "string" ? r.linkedin_profile_url : null,
        phone: null, // phones come from site-scraping instead — see src/act/outreach.ts
        hq_city: typeof r.hq_city === "string" ? r.hq_city : null,
        hq_region: typeof r.hq_region === "string" ? r.hq_region : null,
      };
      return company;
    } catch {
      return null;
    }
  },

  async findContacts(company, opts) {
    if (!hasKey()) return [];
    if (!company.domain) return [];
    try {
      const body = JSON.stringify({
        filters: [{ filter_type: "CURRENT_COMPANY", type: "in", value: [company.domain] }],
        page: 1,
      });
      const res = await safeFetch(`${BASE}/screener/person/search`, {
        method: "POST",
        headers: headers(),
        body,
      });
      if (!res.ok) return [];
      const json: unknown = await res.json();
      if (typeof json !== "object" || json === null) return [];
      const obj = json as Record<string, unknown>;
      if (!Array.isArray(obj.profiles)) return [];

      const limit = opts?.limit ?? 5;
      const titles = opts?.titles;

      interface RawProfile {
        name: string;
        title: string | null;
        linkedin: string | null;
        headline: string | null;
        decisionMaker: boolean;
      }

      const profiles: RawProfile[] = [];
      for (const p of obj.profiles) {
        if (typeof p !== "object" || p === null) continue;
        const r = p as Record<string, unknown>;
        profiles.push({
          name: typeof r.name === "string" ? r.name : "",
          title: typeof r.default_position_title === "string" ? r.default_position_title : null,
          linkedin:
            (typeof r.flagship_profile_url === "string" ? r.flagship_profile_url : null) ??
            (typeof r.linkedin_profile_url === "string" ? r.linkedin_profile_url : null),
          headline: typeof r.headline === "string" ? r.headline : null,
          decisionMaker: r.default_position_is_decision_maker === true,
        });
      }

      if (titles && titles.length > 0) {
        const lowerTitles = titles.map((t) => t.toLowerCase());
        profiles.sort((a, b) => {
          const aMatch = lowerTitles.some(
            (t) =>
              (a.title?.toLowerCase().includes(t)) ||
              (a.headline?.toLowerCase().includes(t)),
          );
          const bMatch = lowerTitles.some(
            (t) =>
              (b.title?.toLowerCase().includes(t)) ||
              (b.headline?.toLowerCase().includes(t)),
          );
          if (aMatch !== bMatch) return aMatch ? -1 : 1;
          if (a.decisionMaker !== b.decisionMaker) return a.decisionMaker ? -1 : 1;
          return 0;
        });
      } else {
        profiles.sort((a, b) => {
          if (a.decisionMaker !== b.decisionMaker) return a.decisionMaker ? -1 : 1;
          return 0;
        });
      }

      const people: CrustPerson[] = profiles.slice(0, limit).map((p) => ({
        name: p.name,
        title: p.title,
        linkedin_url: p.linkedin,
        email: null,
        phone: null, // phones come from site-scraping instead — see src/act/outreach.ts
      }));

      return people;
    } catch {
      return [];
    }
  },

  async searchCompanies(filters) {
    if (!hasKey()) return [];
    const kw = filters.keyword;
    // We have no verified company-discovery endpoint on this plan.
    // Company search only works when the keyword looks like a domain.
    if (kw && looksLikeDomain(kw)) {
      const company = await this.enrichDomain(kw);
      return company ? [company] : [];
    }
    return [];
  },
};
