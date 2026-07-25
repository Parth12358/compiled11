Create and edit ONLY `src/act/adapters/crustdata.ts`. Do not edit any other file.
Do NOT call external APIs and do NOT run a server. You MAY run `node --check src/act/adapters/crustdata.ts`.

CONTEXT (study read-only, do not edit):
- `src/contract.ts` is FROZEN. It already declares the exact interfaces you must implement:
  `CrustDataAdapter`, `CrustCompany`, `CrustPerson`. Import them with
  `import type { CrustDataAdapter, CrustCompany, CrustPerson } from "../../contract";`
- `src/act/adapters/voygr.ts` is the house adapter style — MIRROR IT exactly: a module-level
  `BASE` const, a `key()` helper that throws if the env var is missing, a `headers()` helper,
  small pure normalize helpers, and a single exported `const` object implementing the interface.

API FACTS — these were verified live against the real API today. Do NOT invent endpoints,
do NOT "improve" these paths, and do NOT use any endpoint not listed here.

Base URL: `https://api.crustdata.com`
Auth header for every call below: `Authorization: Token ${process.env.CRUSTDATA_API_KEY}`
(the literal word `Token`, NOT `Bearer`).

1. Company enrichment by domain — VERIFIED WORKING
   `GET /screener/company?company_domain=<domain>`
   Returns a JSON **array**; the record is element [0]. Real fields observed:
   `company_id` (number), `company_name` (string), `company_website_domain` (string),
   `company_website` (string), `linkedin_profile_url` (string),
   `employee_count_range` (string e.g. "11-50"), `largest_headcount_country` (string),
   `hq_city` / `hq_region` (BOTH OFTEN null — treat as optional).
   There is NO phone field. Never map a phone from this response.

2. People at a company — VERIFIED WORKING
   `POST /screener/person/search`
   Body: `{"filters":[{"filter_type":"CURRENT_COMPANY","type":"in","value":[<domain>]}],"page":1}`
   Returns `{"profiles":[...]}`. Real fields observed per profile:
   `name`, `location`, `linkedin_profile_url`, `flagship_profile_url`,
   `default_position_title`, `default_position_is_decision_maker` (boolean), `headline`, `summary`.
   There is NO phone and NO email field on this response.

3. Person enrichment — VERIFIED WORKING
   `GET /screener/person/enrich?linkedin_profile_url=<url>`
   Returns a JSON **array**; element [0] has `name`, `linkedin_profile_url`, `email`
   (the `email` field EXISTS but is frequently `null`).

HARD CONSTRAINT — DO NOT USE THESE (verified unavailable on our key):
- `/person/contact/enrich` returns HTTP 403 `permission_error`. Our plan cannot access it.
- Therefore **CrustData can never supply a phone number.** `CrustCompany.phone` and
  `CrustPerson.phone` MUST always be set to `null` in your mappers. Add a short comment
  saying phones come from site-scraping instead, in `src/act/outreach.ts`.

IMPLEMENT `export const crustdata: CrustDataAdapter` with these three methods:

- `enrichDomain(domain)`: call endpoint 1. Map to `CrustCompany`:
  `company_id`←`company_id`, `name`←`company_name`, `domain`←`company_website_domain` (fall
  back to the input domain), `linkedin_url`←`linkedin_profile_url`, `phone`←`null`,
  `hq_city`←`hq_city ?? null`, `hq_region`←`hq_region ?? null`.
  Return `null` when the array is empty or the request fails.

- `findContacts(company, opts)`: call endpoint 2 using `company.domain`. Return `CrustPerson[]`
  mapped as `name`←`name`, `title`←`default_position_title`, `linkedin_url`←`flagship_profile_url
  ?? linkedin_profile_url`, `email`←`null`, `phone`←`null`.
  If `opts.titles` is provided, rank profiles whose `default_position_title` or `headline`
  case-insensitively contains any of those substrings FIRST, then everyone else. Prefer
  `default_position_is_decision_maker === true` as a secondary sort key. Apply `opts.limit`
  (default 5) AFTER ranking. Return `[]` on any failure.

- `searchCompanies(filters)`: call endpoint 1 when `filters.keyword` looks like a domain
  (contains a dot and no spaces) and wrap the single result in an array. Otherwise return `[]`
  — we have no verified company-discovery endpoint, so do NOT guess one. Add a comment saying so.

REQUIREMENTS FOR ALL METHODS:
- 10s timeout via `AbortController` (mirror the `safeFetch` helper in `src/act/audit.ts`).
- Wrap every fetch in try/catch. **These methods must NEVER throw** — return `null`/`[]` on
  failure, exactly like `src/act/audit.ts` degrades to defaults.
- If `CRUSTDATA_API_KEY` is unset, return `null`/`[]` immediately without any fetch.
- Type all JSON responses as `unknown` then narrow defensively; no `any` casts on whole objects.
- Do not add dependencies. Use global `fetch`.

Finally run `node --check src/act/adapters/crustdata.ts`, then `git --no-pager diff` and show it.
