Edit ONLY `src/act/outreach.ts`. Do not create or edit any other file.
Do NOT call external APIs and do NOT run a server. You MAY run `node --check src/act/outreach.ts`.

This file ALREADY EXISTS and works. You are replacing its brittle string-matching filters with
LLM verdicts. Preserve these exports and signatures: `NEVER_CALL`, `findPhone`, `fetchOrgIdentity`,
`discoverTargets`, `buildCallBrief`.

WHY: the deterministic `classifyDomain` / `isLikelyCompetitor` heuristics measurably fail.
`gutters.promatcher.com` (a directory) was flagged a competitor because of its subdomain;
`angi.com` and `bbb.org` (a directory and an association) fell through to "other" and were dropped.
Semantic judgment cannot be done with substring rules.

NEW DEPENDENCY (another agent is creating this file in parallel — just import it):
`import { classifyCandidates, type TargetVerdict } from "./classify";`
`classifyCandidates(client, candidates)` where
  `client` = `{ name: string; trade: string | null; locality: string | null }`
  `candidates` = `{ domain: string; title: string | null; description: string | null }[]`
returns `Promise<Map<string, TargetVerdict>>`, keyed by the candidate domain.
`TargetVerdict` = `{ domain, category, is_competitor, callable, reason }`.
It returns an EMPTY map when `OPENROUTER_API_KEY` is missing or the call fails.

MAKE THESE CHANGES:

1. Add `export function extractLocality(audit: AuditResult): string | null`
   Return a human-readable locality for the client, best-effort:
   - `audit.nap.city` + `", "` + `audit.nap.state` when both present;
   - else match the FIRST `City, ST` pattern (`/([A-Z][A-Za-z.\- ]+),\s*([A-Z]{2})\b/`) in
     `audit.title` then `audit.meta_description`, returning `"City, ST"`;
   - else null. Pure, never throws.
   (Verified: the client's title is `"Gutter Cleaning in Baton Rouge, LA | BR Gutter Pros"`, and
   `nap.city`/`nap.state` are both null — so the title path is the one that must work.)

2. Add `export function inferTrade(audit: AuditResult, client: Client): string | null`
   Return a short trade phrase: `audit.category_hint` when set, else the first 4 words of
   `audit.title` with any trailing `" | ..."`/`" - ..."` segment removed, else `client.name`.
   Pure, never throws.

3. REWRITE the filtering inside `discoverTargets` to use the classifier:
   a. Build and score all candidate domains, drop the client's own domain and `NEVER_CALL`
      entries (keep this cheap deterministic pre-filter — no reason to spend tokens on
      reddit.com or wikipedia.org).
   b. Take the top **20** by score as the working pool.
   c. Resolve `fetchOrgIdentity` for the pool IN PARALLEL to get each one's `name` and `title`.
   d. Call `classifyCandidates` ONCE for the whole pool, passing
      `{ name: client.name, trade: inferTrade(audit, client), locality: extractLocality(audit) }`
      and candidates built from the domain + identity title (use the identity `name` as
      `description` when no better text is available).
   e. Keep a candidate ONLY when its verdict has `callable === true` AND `is_competitor === false`.
      Set `OutreachTarget.category` from `verdict.category`, and append the verdict's `reason` to
      `why_relevant` so the UI can show why we are calling them.
   f. **Fallback when the map has no verdict for a domain** (empty map / model omitted it):
      fall back to the existing deterministic `classifyDomain` result and keep the candidate only
      if that category is not `"other"`. Keep `classifyDomain` in the file for exactly this
      purpose — do NOT delete it.
   g. THEN resolve phones in parallel for the survivors, drop those without a phone.
   h. Sort by category weight (`chamber` 3, `association` 3, `directory` 3, `listicle` 2,
      `blog` 1), then score descending, then domain; truncate to `limit ?? 5`.
   Ordering matters: classification happens BEFORE the phone lookup so we never scrape a phone
   for a competitor we are about to discard.

4. DELETE the `isLikelyCompetitor` export and all its call sites — the LLM now owns that call.

5. In `buildCallBrief`, use the client's real display name. It currently renders
   `"on behalf of brgutterpros"`. Prefer `client.name` verbatim when it contains a space or an
   uppercase letter; otherwise leave as-is. Do not change the signature.

CONSTRAINTS:
- No new dependencies. `cheerio` is already imported.
- Nothing in this file may throw; if `classifyCandidates` rejects, treat it as an empty map.
- Do not change `findPhone`'s extraction logic or its proximity guard — that is already correct.

Validate with `node --check src/act/outreach.ts`, then `git --no-pager diff` and show it.
