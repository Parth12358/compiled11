Edit ONLY `src/act/outreach.ts`. Do not create or edit any other file.
Do NOT call external APIs and do NOT run a server. You MAY run `node --check src/act/outreach.ts`.

This file ALREADY EXISTS and works. You are hardening three specific things in it. Preserve every
existing export and its signature: `NEVER_CALL`, `classifyDomain`, `findPhone`, `discoverTargets`,
`buildCallBrief`. Do not restructure the file or rename anything.

DIAGNOSIS (already measured live — do not re-derive):
- `findPhone` currently succeeds on 4/4 chambers and directories tested. Keep that behaviour.
- It fetches `https://<domain>` only. For `healthgrades.com` and `sfgate.com` the bare apex
  returns **HTTP 404** while `https://www.<domain>` returns **200**. A `www.` fallback is a real,
  cheap win that is currently missed.
- `yelp.com` and `zocdoc.com` return **HTTP 403** even with a browser User-Agent. These are not
  recoverable by plain fetch and are mostly domains we would never phone anyway.
- **CrustData is currently returning HTTP 402 (out of credits) for every endpoint.** So
  `crustdata.enrichDomain` returns `null`, and every target's `name` is falling back to the bare
  domain (e.g. `"sfchamber.com"` instead of `"San Francisco Chamber of Commerce"`), and
  `contact_person`/`contact_title` are always null. The call brief reads badly as a result.
  You must make the org NAME come from the target's own page when CrustData gives nothing.
- `classifyDomain("ada.org")` returns `"other"`; it should be `"association"` (American Dental
  Association). The domain string alone is not enough — the page title carries the signal.

MAKE THESE FOUR CHANGES:

1. Add a private `fetchHtml(url: string): Promise<string | null>` helper used by everything below:
   - `AbortController` timeout of 12s, `redirect: "follow"`.
   - Send a browser-like User-Agent:
     `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36`
     and `Accept: text/html`.
   - On a non-ok response or a thrown error, return `null`. Never throw.

2. Add a private `candidateUrls(domain: string): string[]` that yields, in order:
   `https://<domain>`, `https://www.<domain>` (skip if the domain already starts with `www.`),
   then for BOTH hosts the paths `/contact`, `/contact-us`, `/about`, `/about-us`, `/membership`,
   `/join`, `/advertise`.
   Order matters: try both apex and www roots BEFORE moving on to the sub-paths, because a
   homepage hit is the common case and the cheapest.

3. Rewrite the body of `findPhone(domain)` to walk `candidateUrls` via `fetchHtml`, stopping at
   the first confident hit, extracting in this precedence order per page:
   a. **JSON-LD `telephone`** — parse every `<script type="application/ld+json">` block and look
      for a `"telephone"` string anywhere in the parsed structure (recurse into nested objects and
      arrays). Highest precision.
   b. **`href="tel:..."`** link.
   c. **Visible-text regex** on the HTML with `<script>`/`<style>` blocks stripped and tags
      removed: `/(?:\+?1[\s.\-]?)?\(?([2-9]\d{2})\)?[\s.\-]?(\d{3})[\s.\-]?(\d{4})(?!\d)/`
   Keep the existing E.164 normalization and its rejection rules (must be 10 NANP digits after
   stripping a leading 1, area code must start 2-9, reject all-identical digits). Return `null`
   when nothing normalizes. Never throw.
   FINALLY: if every candidate URL failed AND the module `src/act/adapters/firecrawl.ts` reports
   itself enabled, retry the domain root through it as a last resort:
   `import { firecrawlEnabled, scrapeHtml } from "./adapters/firecrawl";`
   — call `scrapeHtml("https://" + domain)` and run the same three extractors over the returned
   HTML. Guard the whole thing with `if (firecrawlEnabled())` so it is a no-op without a key.
   (Another agent is creating that file in parallel; just import those two names.)

4. Add and export `export async function fetchOrgIdentity(domain: string):
   Promise<{ name: string | null; title: string | null }>`
   - One `fetchHtml` call against the first working candidate root (apex then www).
   - `name` ← `<meta property="og:site_name">` content, else the `<title>` text with any trailing
     ` | ...`, ` - ...`, ` — ...` suffix stripped, trimmed; `null` if neither is usable.
   - `title` ← the raw `<title>` text or null.
   - Never throw.

   Then wire it into `discoverTargets`: for each candidate domain, call `fetchOrgIdentity` in the
   same parallel block as `findPhone`. Use its `name` for `OutreachTarget.name` **whenever
   CrustData returned nothing** (which is the current reality), falling back to the bare domain
   only if both sources fail. Pass its `title` into `classifyDomain(domain, title)`.

5. Extend `classifyDomain(domain, title?)` so the optional `title` participates: run the SAME
   keyword rules against `title` when the domain alone yields `"other"`. Add "dental association",
   "chamber of commerce", "board of", "institute", "academy" → `"association"`, and
   "directory", "find a", "search for a", "book a" → `"directory"`. Keep every existing rule and
   the existing return type.

CONSTRAINTS:
- Do not change `buildCallBrief`'s signature, but DO make it read naturally when `contact_person`
  is null (no dangling "Ask for null").
- No new dependencies. `cheerio` is already available and already imported — use it for the
  HTML parsing rather than hand-rolling regex for tags where practical.
- Nothing in this file may throw.

Finally run `node --check src/act/outreach.ts`, then `git --no-pager diff` and show it.
