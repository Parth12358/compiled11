Edit ONLY `src/act/outreach.ts`. Do not create or edit any other file.
Do NOT call external APIs and do NOT run a server. You MAY run `node --check src/act/outreach.ts`.

This file ALREADY EXISTS and works. Preserve every existing export and signature: `NEVER_CALL`,
`classifyDomain`, `findPhone`, `fetchOrgIdentity`, `discoverTargets`, `buildCallBrief`.

THE BUG (found in a real end-to-end run — this is the priority fix):
Client = BR Gutter Pros, a gutter company in Baton Rouge. `discoverTargets` returned these four
call targets, and ALL FOUR ARE THE CLIENT'S DIRECT COMPETITORS:
  - LeafFilter Gutter Protection  (leaffilter.com)        category "other"
  - Gutter Contractor             (2croofing.com etc.)    category "other"
  - Faithful Gutters              (faithfulgutters.com)   category "other"
  - Geaux Pro Gutters             (geauxprogutters.com)   category "other"
Phoning a rival business to ask them to link to you is nonsense. Meanwhile the LEGITIMATE targets
in the same citation set — `angi.com`, `gutters.promatcher.com`, `homeyou.com`, `homeblue.com`
(all contractor directories) — were never selected, because ranking is purely by citation count
and the competitors outranked them.

Root cause: we filter out platforms via `NEVER_CALL`, but we never filter out *competitors*.
A competing local business almost always classifies as `"other"`, because its domain and title
contain the client's own service words.

FIX 1 — only call link-granting categories.
In `discoverTargets`, after computing each target's `category`, DROP any target whose category is
`"other"`. Keep only `"chamber" | "directory" | "association" | "listicle" | "blog"`.
These are the categories that can actually publish a link to a third party. Add a brief comment
explaining that `"other"` is overwhelmingly a competing business and must never be dialled.

FIX 2 — explicit competitor detection, independent of category.
Add and export:
`export function isLikelyCompetitor(domain: string, title: string | null, clientCategoryHint: string | null, clientName: string): boolean`
Return true when the target looks like another business in the client's own line of work:
  - Derive "service words" from `clientCategoryHint` and `clientName`: lowercase, split on
    non-alphanumerics, drop tokens shorter than 4 chars and drop generic tokens
    (`the`,`and`,`pros`,`pro`,`services`,`service`,`company`,`inc`,`llc`,`best`,`near`).
  - If ANY service word appears in the target's registrable domain, return true.
    (e.g. client hint "gutter" → `faithfulgutters.com`, `geauxprogutters.com` → competitor.)
  - If the target's `title` contains a service word AND the title does NOT contain any of
    `directory`, `find a`, `compare`, `reviews of`, `top 10`, `best of`, `chamber`, `association`,
    `marketplace`, `quotes`, `contractors near` → return true.
    (That exception keeps genuine directories and roundups, which legitimately mention the trade.)
  - Return false otherwise. Pure function, no network, never throws.
Call it in `discoverTargets` and drop matches, INDEPENDENTLY of the category filter — a competitor
that happens to classify as `"blog"` must still be dropped.
`clientCategoryHint` comes from `audit.category_hint`; `clientName` from `client.name`.

FIX 3 — widen the candidate pool so real directories survive.
Currently the pool is truncated to the top `limit ?? 5` domains BEFORE the phone lookup and
before these new filters, so competitors consume all the slots. Reorder `discoverTargets` to:
  a. build and score ALL candidate domains,
  b. apply the client-domain / `NEVER_CALL` drops,
  c. take the top **20** by score as a working pool,
  d. resolve identity + category for that pool (in parallel, as today),
  e. apply the category filter (FIX 1) and `isLikelyCompetitor` (FIX 2),
  f. THEN resolve phones (in parallel) for the survivors and drop the ones with no phone,
  g. finally sort by score and truncate to `limit ?? 5`.
Note the reorder: identity/category comes BEFORE phone lookup, so we never waste a network round
trip scraping a phone for a competitor we are about to discard.

FIX 4 — rank link-granting categories above the rest.
When sorting the survivors, sort by a tuple: first a category weight
(`chamber` 3, `association` 3, `directory` 3, `listicle` 2, `blog` 1), then citation score
descending, then domain alphabetically. A chamber with 2 citations is a better call than a
listicle with 4.

CONSTRAINTS:
- No new dependencies. `cheerio` is already imported.
- Nothing in this file may throw.
- Do not change `buildCallBrief`'s signature.

Validate with `node --check src/act/outreach.ts`, then `git --no-pager diff` and show it.
