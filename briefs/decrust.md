Edit ONLY `src/act/outreach.ts`. Do not create or edit any other file.
Do NOT call external APIs and do NOT run a server. You MAY run `node --check src/act/outreach.ts`.

This file ALREADY EXISTS and works. You are REMOVING two dependencies from it and tightening one
extraction rule. Preserve every existing export and signature: `NEVER_CALL`, `classifyDomain`,
`findPhone`, `fetchOrgIdentity`, `discoverTargets`, `buildCallBrief`. Do not restructure the file.

CHANGE 1 — remove CrustData entirely (product decision: we are not using that vendor).
- Delete the import `import { crustdata } from "./adapters/crustdata";` — **that file has been
  deleted from the repo, so leaving the import will break the build.**
- Delete `CrustCompany` from the `import type { ... } from "../contract";` line — **that type no
  longer exists in `src/contract.ts`.**
- The `crustdata_company_id` field has been REMOVED from the `OutreachTarget` interface. Delete
  the `crustdata_company_id: companyId` property from the object you build in `discoverTargets`.
- Delete the `company` / `crustResult` variable, the `crustdata.enrichDomain(...)` call, and the
  `crustdata.findContacts(...)` block. In the `Promise.all` that currently fetches CrustData and
  the org identity together, keep ONLY the identity + phone lookups.
- `OutreachTarget.name` now comes solely from `fetchOrgIdentity(domain).name`, falling back to the
  bare domain when that is null. `contact_person` and `contact_title` are now always `null` —
  keep the fields (they are still in the interface) and set them to `null`.

CHANGE 2 — remove the Firecrawl fallback (product decision: not using that vendor either).
- Delete the import of `firecrawlEnabled` / `scrapeHtml` from `./adapters/firecrawl` — **that file
  has been deleted from the repo.**
- Delete the `if (firecrawlEnabled())` last-resort block at the end of `findPhone`. When every
  candidate URL fails, `findPhone` simply returns `null`.

CHANGE 3 — tighten the visible-text phone regex (real defect, already diagnosed).
The current text regex produces FALSE POSITIVES on large sites. Measured examples that it wrongly
accepted as phone numbers: `2147483647` (a bare integer, INT_MAX), `885150.1447` (a decimal
number), and `304643-3030` (an id-like token). These would be dialled.

Fix it with a proximity requirement, applied ONLY to the visible-text regex fallback — do NOT
change the JSON-LD `telephone` or `href="tel:"` extractors, which are already precise and are
tried first:
- Before matching, collapse whitespace in the stripped text.
- Accept a regex match ONLY IF one of these keywords appears within 60 characters BEFORE the
  match, case-insensitive: `phone`, `tel`, `telephone`, `call us`, `call:`, `contact`, `toll`,
  `office`, `mobile`, `cell`, `fax` (treat a `fax` hit as a REJECT, not an accept — never dial a
  fax line).
- Additionally reject any candidate where the matched substring is immediately preceded or
  followed by a digit, a `.`, or a `-` joined to more digits (so `885150.1447` and `304643-3030`
  cannot match).
- Keep the existing E.164 normalization and all its existing rejection rules.

CONSTRAINTS:
- No new dependencies. `cheerio` is already imported — keep using it.
- Nothing in this file may throw.
- After your edits there must be NO remaining reference to `crust`, `Crust`, or `firecrawl`
  anywhere in the file. Grep for them before you finish.

Validate with `node --check src/act/outreach.ts`, then run `git --no-pager diff` and show it.
