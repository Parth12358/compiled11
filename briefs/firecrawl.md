Create and edit ONLY `src/act/adapters/firecrawl.ts`. Do not edit any other file.
Do NOT call external APIs and do NOT run a server. You MAY run `node --check src/act/adapters/firecrawl.ts`.

PURPOSE: an OPTIONAL last-resort page fetcher for sites that block plain `fetch` or render their
contact details with JavaScript. It must be completely inert when no API key is configured — the
system works today without it and must keep working.

CONTEXT (study read-only, do not edit):
- `src/act/adapters/voygr.ts` and `src/act/adapters/crustdata.ts` are the house adapter style.
  MIRROR them: module-level `BASE`, a `hasKey()` guard, a `headers()` helper, defensive parsing,
  never throw.
- `src/contract.ts` is FROZEN — you do not need to add anything to it. Define your own local
  types in this file.

MEASURED CONTEXT (why this exists): a plain `fetch` phone scrape already succeeds on the target
class we actually phone (chambers, associations, niche directories) — 6/6 in live testing. It
fails only on large consumer platforms behind bot protection (yelp.com, zocdoc.com return HTTP
403 even with a browser User-Agent). Those are mostly domains we would never call anyway, so this
adapter is a fallback, NOT the primary path.

API FACTS (Firecrawl v1):
- Base URL: `https://api.firecrawl.dev`
- Auth: `Authorization: Bearer ${process.env.FIRECRAWL_API_KEY}`
- Scrape: `POST /v1/scrape` with JSON body `{ "url": "<url>", "formats": ["html"] }`
- Response: `{ success: boolean, data: { html?: string, markdown?: string, metadata?: {...} } }`
- Non-2xx or `success:false` means failure.

IMPLEMENT:

1. `export function firecrawlEnabled(): boolean` — true only when `process.env.FIRECRAWL_API_KEY`
   is a non-empty string.

2. `export async function scrapeHtml(url: string, timeoutMs?: number): Promise<string | null>`
   - Return `null` IMMEDIATELY (no fetch at all) when `firecrawlEnabled()` is false. This is the
     default state today and must be zero-cost.
   - Otherwise POST to `/v1/scrape` as above with an `AbortController` timeout
     (`timeoutMs ?? 20000` — Firecrawl renders pages, so it is slower than a plain fetch).
   - Return `data.html` when present and non-empty, else `data.markdown` when present, else `null`.
   - Catch everything. **Never throw.** Log failures with `console.error` only.

3. `export async function scrapeMany(urls: string[], opts?: { concurrency?: number }):
    Promise<Map<string, string>>`
   - Returns a map of url → html for the ones that succeeded; omits failures entirely.
   - Returns an EMPTY map immediately when `firecrawlEnabled()` is false.
   - Use a simple worker pool with concurrency `opts?.concurrency ?? 2`. Do NOT use
     `Promise.all` over the whole list — Firecrawl is rate-limited and metered.

REQUIREMENTS:
- No new dependencies. Use global `fetch`.
- Nothing in this file may throw under any circumstance.
- Add a short header comment stating this adapter is optional, is skipped entirely without
  `FIRECRAWL_API_KEY`, and that the free path already covers the callable target class.

Finally run `node --check src/act/adapters/firecrawl.ts`, then `git --no-pager diff` and show it.
