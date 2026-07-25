Create and edit ONLY `src/act/outreach.ts`. Do not edit any other file.
Do NOT call external APIs and do NOT run a server. You MAY run `node --check src/act/outreach.ts`.

PURPOSE: this is the autonomous "find people to call" stage. Given the retrieval results and
the site audit, it decides WHICH third-party sites we should phone to ask for a listing/link,
finds a real phone number for each, and writes the call brief. It must work with zero human
input for any client we put into the system.

CONTEXT (study read-only, do not edit):
- `src/contract.ts` is FROZEN. Import: `import type { OutreachTarget, QueryResult, Source,
  AuditResult, Client, CrustCompany } from "../contract";`
  `OutreachTarget` fields: `name, domain, phone, category, contact_person, contact_title,
  why_relevant, cited_by_engine, crustdata_company_id`.
  `category` is exactly: `"chamber" | "directory" | "blog" | "listicle" | "association" | "other"`.
- `src/act/adapters/crustdata.ts` exports `crustdata` implementing `CrustDataAdapter`
  (`enrichDomain`, `findContacts`, `searchCompanies`). Another agent is writing it in parallel —
  just import and call it: `import { crustdata } from "./adapters/crustdata";`
- `src/act/audit.ts` has the fetch/parse patterns to MIRROR: its `safeFetch` (AbortController
  timeout) and its cheerio usage. Reuse that style; do not reimplement a fetch wrapper differently.
- `cheerio` is already a dependency: `import * as cheerio from "cheerio";`

CRITICAL FACT — verified live today: **CrustData cannot return phone numbers** (the contact-enrich
endpoint 403s on our plan). So CrustData is used ONLY to (a) confirm the org is real and get its
canonical name + `company_id`, and (b) get a named person + title to ask for. **The phone number
must be scraped from the target's own website.** For chambers, directories and associations the
public main line is the correct number to call anyway.

IMPLEMENT these exports:

1. `const NEVER_CALL: string[]` — platform domains we must never phone because there is no one to
   ask and it would be spam. Include at minimum: reddit.com, wikipedia.org, quora.com, youtube.com,
   facebook.com, x.com, twitter.com, linkedin.com, instagram.com, tiktok.com, medium.com,
   pinterest.com, amazon.com, google.com, apple.com, github.com, nytimes.com, forbes.com,
   wsj.com, bbc.com, cnn.com. Match on the registrable domain and on any subdomain of these.

2. `export function classifyDomain(domain: string, title?: string | null): OutreachTarget["category"]`
   Pure function, no network. Heuristics on the domain and optional page title:
   - contains "chamber" → "chamber"
   - contains "association" | "assoc" | "society" | "council" | "guild" → "association"
   - contains "directory" | "directories" | "listings" | "yellowpages" | "find" | "locator" → "directory"
   - title/domain matches /best|top \d|vs\.?|review|comparison|\d{1,2} best/i → "listicle"
   - contains "blog" | "news" | "magazine" | "journal" → "blog"
   - else "other"

3. `export async function findPhone(domain: string): Promise<string | null>`
   Scrape a phone number for the org. Steps, in order, stopping at the first hit:
   a. Fetch `https://<domain>/` (10s timeout, User-Agent "CITED-outreach/0.1").
   b. Look for `a[href^="tel:"]` — take the href, strip `tel:`, normalize.
   c. Else regex the page text for a North-American phone:
      `/(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/`
   d. Else repeat (a)-(c) for `/contact`, `/contact-us`, `/about` on the same origin.
   Normalize every result to E.164 `+1XXXXXXXXXX` when it is a 10-digit NANP number; return
   `null` if you cannot confidently normalize. Reject obvious non-phones (all-same digits,
   years, numbers inside a `[href^="http"]`). Never throw — return `null` on any error.

4. `export async function discoverTargets(input: { client: Client; queries: QueryResult[];
   sources: Source[]; audit: AuditResult; limit?: number }): Promise<OutreachTarget[]>`
   The autonomous pipeline:
   a. Collect candidate domains from `queries[]`: for every query where `client_cited === false`
      and `citation_count > 0`, take its `cited_domains`. Score each domain by how many such
      queries cite it, and keep the query text that best justifies it.
   b. Drop: the client's own domain, anything in `NEVER_CALL`, and anything already present in
      `audit.pages` as a link target. Deduplicate by registrable domain.
   c. Sort by score descending, then alphabetically. Take the top `limit ?? 5`.
   d. For each survivor, in PARALLEL (`Promise.all`), build one `OutreachTarget`:
      - `crustdata.enrichDomain(domain)` → `name` (fall back to the domain), `crustdata_company_id`.
      - `crustdata.findContacts(company, { titles: ["membership","partnership","director",
        "editor","content","marketing","communications","outreach","owner","president"], limit: 3 })`
        → take the first result for `contact_person` (their `name`) and `contact_title` (their `title`).
        Both are `null` when nothing is found.
      - `findPhone(domain)` → `phone`.
      - `category` ← `classifyDomain(domain)`.
      - `cited_by_engine` ← `true`.
      - `why_relevant` ← one sentence naming the actual query and count, e.g.
        `Cited for "<query>" and 2 other queries where <client name> does not appear.`
   e. Drop any target where `phone === null` (we cannot call it) and return the rest.
      Sort by score descending.

5. `export function buildCallBrief(target: OutreachTarget, client: Client): string`
   Pure function, no network, no LLM. Returns the natural-language instruction string handed to
   the voice agent. It MUST:
   - Say who is calling and that it is on behalf of `client.name`.
   - Name `target.contact_person` if present ("Ask for <name>, the <title>.").
   - State the specific ask, chosen by `target.category`:
     chamber/association → confirm membership and ask to be added to the online member directory
       with a link to `client.url`;
     directory → ask what is required to get `client.name` listed, including fees and timeline;
     blog/listicle → ask who handles editorial updates and whether `client.name` can be considered
       for inclusion in the relevant roundup;
     other → ask who handles website listings and how to be included.
   - Ask for the concrete next step and the expected timeline.
   - Explicitly instruct: be honest that this is an automated assistant calling on behalf of the
     client, never claim to be a person, accept "no" gracefully and end the call, and never offer
     payment or anything of value in exchange for a link.
   Keep it under 120 words.

REQUIREMENTS:
- Nothing in this file may throw. Every network path degrades to `null`/`[]`.
- No new dependencies. Use global `fetch` and the already-installed `cheerio`.
- Do not read `process.env` for API keys here — the adapters own that.

Finally run `node --check src/act/outreach.ts`, then `git --no-pager diff` and show it.
