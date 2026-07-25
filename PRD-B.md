# PRD-B — CITED / Person B: Action module (`src/act`)

**Parent:** PRD.md §3 steps 4–6, §6 row B, §8. **Deadline:** tonight (demo ~22:00, 24 Jul 2026). Speed > polish.

**Deliverable:** `gaps` + `actions` + `pr_url` (+ `indexnow_submitted_at`) merged into `report.json` at the repo root, which `/api/report` already serves to C's finished UI. The headline feature: the client invites our GitHub account to their repo, CITED **accepts the invitation via API and opens the PR** — closing the detect → fix → ship loop live.

---

## 1. Scope

### In
- `src/act/audit.ts` — fetch client homepage (+ llms.txt + sitemap), extract title / meta description / schema.org / content signals.
- `src/act/gaps.ts` — diff A's retrieval keywords against the audit → `Gap[]` (missing_page / thin_content).
- `src/act/generate.ts` — produce `Action[]`: metadata rewrite, `llms.txt`, one gap-targeting blog page. LLM via raw `fetch` (Anthropic → OpenAI fallback), deterministic template fallback when keyless — **the pipeline must never stall on a missing key** (same philosophy as C's fixture race).
- `src/act/github.ts` — token resolution, **repo-invitation accept flow**, branch + commits (contents API), open PR. Raw GitHub REST via `fetch`, zero new runtime deps.
- `src/act/indexnow.ts` — optional ping, records ISO timestamp.
- `src/act/index.ts` — orchestrator + CLI (`npm run act`), merges with A's output, writes `report.json`.
- Wiring: `tsx` devDependency + `"act"` script; `.env.example` + `.gitignore` additions; PROGRESS.md update.
- One **private** rehearsal repo under the authed account (`cited-demo-site`) with a minimal `index.html`, so the PR path is e2e-tested tonight without touching anyone else's repo.

### Out
- Anything that posts to third-party sites (parent §8 — hard no).
- Auto-merge of the PR; multi-page site crawls; retrieval itself (A's module untouched).
- Touching C's surfaces: `src/ui/**`, `app/**`, `public/**`.

## 2. Frozen interfaces (teams build in parallel against these)

Types `Client / Score / Source / Gap / Action / Report` come from `src/ui/types.ts` (the frozen contract). New types live in `src/act/types.ts`:

```ts
export interface SiteAudit {
  url: string; fetched_at: string; ok: boolean;
  title: string | null; meta_description: string | null;
  has_schema_org: boolean; schema_types: string[];
  has_llms_txt: boolean; llms_txt: string | null;
  sitemap_urls: string[];          // cap 200
  page_text: string;               // homepage visible text, cap 20k chars
  head_html: string;               // raw <head>, cap 20k chars
}
export interface RetrieveQuery { query: string; cited: boolean; citations: string[]; }
export interface RetrieveOutput { // A's seam: out/retrieve.json
  score: Score; sources: Source[]; queries?: RetrieveQuery[];
}
export interface PrResult {
  pr_url: string | null;
  mode: "direct" | "invite" | "fork" | "skipped";
  detail: string;                  // human-readable outcome for logs/demo
}
```

```ts
// audit.ts
export async function auditSite(url: string, opts?: { timeoutMs?: number }): Promise<SiteAudit>;
// gaps.ts
export function deriveGaps(client: Client, audit: SiteAudit, retrieve: RetrieveOutput): Gap[];
// generate.ts
export async function generateActions(client: Client, audit: SiteAudit, gaps: Gap[]): Promise<Action[]>;
// github.ts
export async function openPr(client: Client, score: Score, sources: Source[], gaps: Gap[],
  actions: Action[], opts?: { branch?: string; dryRun?: boolean; waitInviteSecs?: number }): Promise<PrResult>;
// indexnow.ts — verifies the key is publicly served before submitting (see §3.5)
export async function pingIndexNow(siteUrl: string, urls: string[]): Promise<string | null>;
```

Every module: 10s default fetch timeout via `AbortSignal.timeout`, failures degrade (return `ok:false` / empty / null), never throw out of the orchestrator.

## 3. Module specs

### 3.1 audit.ts
`GET url` (follow redirects). Parse with regex/cheap string ops (no HTML-parser dep): `<title>`, `meta[name=description]`, `application/ld+json` blocks (`@type` list), strip tags for `page_text`. Also `GET {origin}/llms.txt` and `{origin}/sitemap.xml` (parse `<loc>` values). Unreachable site → `ok:false` with nulls; pipeline continues (gaps fall back, generation uses client name).

### 3.2 gaps.ts
Keyword source ladder — **postcondition: always returns ≥1 gap**:
1. `retrieve.queries` present → uncited queries ranked by `citations.length` (desc), top 4–6.
2. If that yields **zero** (queries absent, empty array, or all cited) → fixture.json's `gaps`, logged as `[gaps] fallback: fixture`.
3. If fixture unreadable/empty → synthesize one from the `client` param: `{ keyword: "${client.name.toLowerCase()} alternatives", type: "missing_page", citations: 0 }`.

Classification per keyword: tokenize (lowercase, drop stopwords); if ≥60% of tokens appear in `page_text` or any `sitemap_urls` slug → `thin_content`, else `missing_page`. `citations` = count from A (or fixture value).

### 3.3 generate.ts
Always emits, in order:
1. `meta` action on `index.html` — `before` = actual audited `<title>` + meta description (or `(missing)` placeholders), `after` = rewritten title + description + one `SoftwareApplication`-style JSON-LD block.
2. `llms.txt` action — **decent** existing file (all three: ≥300 chars, ≥2 markdown links matching `](http`, first non-blank line starts with `#`) → skip entirely. Exists but fails any → rewrite action with `before` = existing content (truncated 2k). Absent → `new_page`, no `before`.
3. `new_page` blog post at `blog/{slugify(top-gap keyword)}.md` — **the path/slug is computed by us, never taken from the LLM** (`slugify` = lowercase, non-alphanumerics → `-`, collapse/trim `-`). ~350–500 words, honest comparison style like the fixture — competitors named fairly, no fabricated stats.

LLM ladder: `ANTHROPIC_API_KEY` → `POST api.anthropic.com/v1/messages` (model env `CITED_MODEL`, default `claude-sonnet-5`, max_tokens 3000); else `OPENAI_API_KEY` → `POST api.openai.com/v1/chat/completions` (`gpt-4o-mini`, JSON mode); else **template generator** seeded from audit + gaps (string templates in code, fixture-quality). 30s timeout on LLM calls.

**LLM output contract** (one call, strict JSON, extracted from first `{`..last `}`):
```json
{ "meta": { "title": "string", "description": "string", "jsonld": { "@context": "https://schema.org", "@type": "SoftwareApplication", "...": "..." } },
  "llms_txt": "markdown string",
  "blog": { "markdown": "string" } }
```
Validation (any miss → whole response drops to templates, never partial-merge): JSON parses; `meta.title` / `meta.description` / `llms_txt` / `blog.markdown` all present, strings, trimmed non-empty; `meta.title` ≤70 chars; `meta.description` ≤160 chars; `jsonld` a plain object whose serialization ≤4k; `llms_txt` ≥100 chars; `blog.markdown` ≥1500 chars and first line starts with `# `. No slug field — the blog path is always ours (see item 3 above).

**`Action.after` canonical serialization** (machine-readable; github.ts re-parses it): for `meta` actions, exactly three `\n`-joined segments — `<title>{title}</title>`, `<meta name="description" content="{escaped}">`, `<script type="application/ld+json">{JSON.stringify(jsonld)}</script>` — same shape as the fixture. Both serializer and parser are ours, so the round-trip is exact; github.ts splits on these anchored patterns to get `{title, description, jsonld}` for patching.

### 3.4 github.ts — the invite flow (headline)
Token ladder: `process.env.GITHUB_TOKEN` → `execFileSync("gh", ["auth","token"])` (trimmed, errors swallowed) → none ⇒ `{ pr_url:null, mode:"skipped", detail:"no token" }` (UI already renders the "Connect repo" ghost state).

Repo ref parsing: accept `owner/repo`, full `https://github.com/owner/repo(.git)` URLs.

Access ladder (all raw REST, headers `Authorization: Bearer`, `X-GitHub-Api-Version: 2022-11-28`):
1. **direct** — `GET /repos/{o}/{r}`; `permissions.push === true` → proceed.
2. **invite** — else poll `GET /user/repository_invitations` every 5s for up to `waitInviteSecs` (CLI `--wait-invite <secs>`, default **0** = single check); on a match of `repository.full_name` (case-insensitive) → `PATCH /user/repository_invitations/{id}` to accept → re-check access up to 5× / 3s. This makes the live-demo choreography executable: run with `--wait-invite 120`, teammate clicks "Invite" mid-scan, the tool sees it, accepts, ships.
3. **fork** — else if repo is public: `POST /repos/{o}/{r}/forks`, poll fork readiness up to 6× / 5s, commit to fork, PR cross-repo (`head: "{me}:{branch}"`).
4. **skipped** — else `pr_url:null` with reason. **Never** attempt writes against a repo we lack access to.

**`dryRun: true`** (CLI `--dry-run`) = strictly read-only: resolves token, parses repo ref, walks the access ladder **without mutating** (no accept, no fork, no refs, no commits, no PR); invitation match reports `mode:"invite", detail:"invitation found — would accept"`. Returns `pr_url:null` + the detected mode/plan. This is the rehearsal path for the invite flow tonight.

Ship steps (target = client repo or fork):
- Branch is **fixed**: `cited/visibility-fixes` (no timestamp — reruns must converge). `GET /repos/{t}/git/ref/heads/{branch}`: exists → reuse as-is; else create from default-branch head sha (`POST git/refs`; on 422 "already exists" race → treat as reuse).
- Per action, `PUT /repos/{t}/contents/{path}` (base64, `branch` param). **File SHAs are always fetched with `?ref={branch}`** (branch-current, not default-branch), so re-PUTs on a reused branch 200 instead of 409/422.
- `meta` action: `GET index.html?ref={branch}` (falls back to default branch copy if branch lacks it). Patch precondition is exactly one anchor: a literal `</head>`. Present → complete patch always succeeds: `<title>` replaced if present else inserted before `</head>`; description `<meta>` replaced if present else inserted before `</head>`; **JSON-LD upsert** — our block wrapped in `<!-- cited:jsonld --> … <!-- /cited:jsonld -->` markers, replaced in place when the marker exists, else inserted before `</head>`. `</head>` missing, or `index.html` absent → commit `seo/meta-recommendations.html` (add-only) containing `Action.after` instead. Never fabricate `index.html` where none exists.
- `new_page` actions commit verbatim (with branch-current `sha` when the file exists).
- PR reuse: `GET /repos/{o}/{r}/pulls?state=open&head={targetOwner}:{branch}` → exists → reuse its `html_url` (PATCH body to refresh). Else `POST /pulls` — title `CITED: AI-visibility fixes for {name}`, body = score line, top-sources summary (from `sources` param), gap list, per-file change table, and the disclosure line "Opened by CITED (hackathon demo) — review before merging." Not a draft (demo needs the green Open badge).
- Returns `html_url`.

### 3.5 indexnow.ts
An open PR does **not** mean anything is deployed, so IndexNow is never fired implicitly. It runs only with the explicit CLI flag `--indexnow` (a **post-deploy** step — parent PRD's "fire the ping at minute 10" against the live site). Gate before submitting: `INDEXNOW_KEY` set **and** `GET {origin}/{key}.txt` publicly returns 200 with body == key (10s timeout). Gate fails → log why, return `null`. Gate passes → `POST https://api.indexnow.org/indexnow` `{ host, key, urlList }` (site root + changed/added URLs); 200/202 → ISO now, else `null`. The PR still commits `{key}.txt` when the key is set, so the gate passes once merged + deployed. Default runs leave `indexnow_submitted_at: null` — the UI already renders that state.

### 3.6 index.ts orchestrator + CLI
```
npm run act -- --url https://site --repo owner/repo
  [--name "Client"] [--retrieve out/retrieve.json] [--out report.json]
  [--no-pr] [--dry-run] [--wait-invite <secs>] [--indexnow]
```
- **Env loading:** `tsx` loads nothing — at startup the orchestrator hand-parses `<cwd>/.env` (KEY=VALUE lines, `#` comments skipped, surrounding quotes stripped, existing `process.env` keys never overridden; file absent → skip silently). ~12 lines, no dotenv dep.
- **Client construction:** `url` = `--url` normalized (prepend `https://` if schemeless, strip trailing `/`); `repo` = `--repo` normalized to `owner/repo` (accepts full GitHub URL / `.git`); `name` = `--name` ?? audited `og:site_name` ?? first `<title>` segment (split on `|`/`—`/`-`) ?? capitalized hostname sans TLD.
- **Retrieve precedence:** `--retrieve` path (default `out/retrieve.json`, relative to cwd) if it exists, parses, and validates (`score` numbers + `sources` array) → else `<cwd>/fixture.json` (same validation) → else zero-score + `[]` with a loud warning. Malformed file at any rung → warn + next rung.
- **Flow:** load env → retrieve input → `auditSite` → `deriveGaps` → `generateActions` → `openPr` unless `--no-pr` (passes `--dry-run`/`--wait-invite` through) → `pingIndexNow` **only if `--indexnow`** → assemble `Report` → write `--out` (default `<cwd>/report.json`) → print summary (score, top gaps, actions, PR mode/URL). Exit 0 on degraded runs; nonzero only on unusable args (missing/invalid `--url` or `--repo`). Runner: `tsx` — Next's tsconfig untouched.

## 4. Env & wiring
- `.env.example` += `ANTHROPIC_API_KEY=` and `# CITED_MODEL=claude-sonnet-5` (GITHUB_TOKEN / INDEXNOW_KEY lines already exist).
- `.gitignore` += `report.json`, `out/`, `.env`.
- `package.json` += `"act": "tsx src/act/index.ts"`, devDep `tsx`. No runtime deps added.

## 5. Test plan (tonight)
1. `npx tsc --noEmit` green.
2. Unit-ish smoke: `auditSite("https://lumenanalytics.io")` degrade path (site may not exist → `ok:false`, pipeline continues) + a real site (e.g. the Next dev server / any live site).
3. E2E: create **private** repo `cited-demo-site` under the authed account (`gh repo create --private`) with a minimal `index.html`; run `npm run act -- --url <live-ish url> --repo Kart-ing/cited-demo-site`; verify PR opens (mode `direct`), `report.json` renders in C's UI (ship panel lights up), **rerun converges** (same branch, files re-PUT with branch SHAs, same PR reused).
4. Invite path rehearsal (executable, read-only): `--dry-run` against a repo we lack access to but hold a real pending invitation for (two exist right now) → expect `mode:"invite", detail:"invitation found — would accept"`, zero mutations. Live acceptance happens in the demo when the teammate invites (`--wait-invite 120`).
5. Keyless degrade: run with env stripped (`env -i PATH=...`) → template actions, `pr_url:null`, valid report.json.
6. IndexNow gate: without `--indexnow` → `null`; with flag but unverifiable key file → `null` + logged reason (no false timestamps).

## 6. Risks
| Risk | Mitigation |
|---|---|
| GitHub auth/invite eats the clock | Ladder degrades to fork, then to `pr_url:null` — UI's "Connect repo" ghost already handles it |
| LLM slow/down at demo time | 30s timeout → deterministic templates; pre-baked fixture tab is C's spine regardless |
| A's output not ready | fixture fallback for score/sources/keywords, clearly logged |
| Meta rewrite mangles a real index.html | regex ops are anchored + conservative; on no-match, falls back to `seo/meta-recommendations.html` add-only file |
| Concurrent session edits collide | B touches only `src/act/**`, `scripts` none, plus 3 append-only wiring files; C's surfaces untouched |

## 7. Changelog
- 2026-07-24 ~21:05 — drafted (B session).
- 2026-07-24 ~21:12 — codex (gpt-5.6-sol, max) round 1: **REQUIRED CHANGES ×7** — (1) `openPr` now takes `sources`; (2) gaps.ts postcondition ≥1 gap with 3-rung ladder; (3) exact LLM JSON contract + canonical `Action.after` serialization + missing-anchor → add-only fallback; (4) fixed branch name, branch-ref SHAs, marker-based JSON-LD upsert, PR-reuse by head; (5) IndexNow now explicit `--indexnow` post-deploy step gated on public key-file verification; (6) `--dry-run` defined read-only + `--wait-invite` polling makes invite rehearsal executable; (7) Client construction / fixture precedence / malformed-retrieve fallback / hand-rolled `.env` loading specified. All applied.
- 2026-07-24 ~21:28 — codex round 2: **REQUIRED CHANGES ×4** — (1) `deriveGaps` now takes `client` (name available for synthesized fallback gap); (2) llms.txt decent-vs-thin threshold defined (≥300 chars + ≥2 links + `#` heading); (3) LLM validation tightened (per-field length bounds; slug removed from LLM contract — blog path always computed by us); (4) meta patch matrix completed (`</head>` is the sole precondition; missing title/description tags are inserted, not skipped). All applied.
- 2026-07-24 ~21:37 — codex round 3 verdict: **APPROVED** (reviewer: codex/gpt-5.6-sol, max effort). Build started.
