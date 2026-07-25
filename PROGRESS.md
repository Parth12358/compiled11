# CITED — Progress Tracker

**Hackathon:** c0mpiled Startup School, 24 Jul 2026  
**Repo:** compiled11  

---

## Overall Status

| Person | Module | Status | Notes |
|--------|--------|--------|-------|
| **A** | `/src/retrieve` — queries, citation capture, aggregation | ✅ **done** | Delivers `score` + `sources`; CLI runner `npm run retrieve` |
| **B** | `/src/act` — audit, gap diff, generation, PR | 🔨 **in progress** | PRD-B codex-APPROVED (3 rounds); parallel build running now |
| **C** | `/src/ui` — dashboard, diff viewer, demo surface | ✅ **done** | Full demo UI live + deployed; PRD-C codex-APPROVED; verified in browser |

---

## Person C — Interface (DONE)

### What exists
- **Design:** "the machine's reading room" — paper-world hero → streaming query scan → ink-flood inversion → dark dashboard where citations glow amber. Fraunces / Instrument Sans / IBM Plex Mono, all vendored in `src/ui/fonts/` (zero network). Palette CVD-validated (diff green adjusted to `#2BA793`, deutan ΔE 9.8). Backgrounds generated with ChatGPT (`public/assets/beam.jpg`, `constellation.jpg`).
- **Flow:** `idle → scanning → revealed`. Scan runs ≥4s and races `GET /api/report` with a hard 3.5s abort → falls back to bundled fixture; the demo cannot stall on network.
- **Sections:** verdict headline + animated score arc (denominator explicit), ranked source leaderboard (amber = client present), gap keyword cards, diff viewer (rewrite diffs + generated-file mode, per-file tabs), ship panel (PR link / "Connect repo" ghost + IndexNow state), Hexclave $99/mo checkout card, close line.
- **Demo modes:**
  - `npm run dev:plain` → http://localhost:3000 — full interactive flow (standalone, no Hexclave).
  - **Pre-baked tab-2 spine: `http://localhost:3000/?fixture=1`** — zero network, straight to the reveal.
  - `npm run dev -- --fixture` also works (dev.js shim maps the flag).
  - `npm run dev` = Hexclave CLI wrapper (onboarding/link flow) around the same server.

### Integration seams for A + B
- **Contract:** `fixture.json` (values enriched, **shape unchanged**). Types in `src/ui/types.ts`.
- **Handoff:** write your merged output to **`report.json` at the repo root** — `/api/report` serves it and the UI renders it identically to the fixture. `pr_url` / `indexnow_submitted_at` light up the ship panel automatically.

### Hexclave (sponsor)
- `@hexclave/next` installed; auth handler at `/handler/*`, sign-in button in the dashboard topbar, payments checkout card (`prod_pro_monthly`, create in dashboard → Apps → Payments), `deployments-alpha` configured in `hexclave.config.ts`.
- All Hexclave surfaces are env-gated: keyless runs render fallbacks and never construct the SDK (the demo can't be broken by a missing project).

---

## Person A — Retrieval (`src/retrieve/`) ✅ COMPLETE

### Files

| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | 32 | Shared interfaces: `Citation`, `EngineName`, `EngineResult`, `SourceStats`, `Score`, `RetrieveOutput` |
| `scrape.ts` | 111 | Fetches homepage, extracts title/meta/OG tags → `{category, keywords}`. Falls back to hostname slug. Timeout: 5s (env-overridable via `SCRAPE_TIMEOUT`). |
| `queries.ts` | 74 | 25 templates + keyword-driven queries → max 30 deduplicated queries. 8 generic fallback queries when no category. |
| `engine.ts` | 302 | Two engine adapters (OpenAI + DeepSeek), both via the OpenAI SDK. Concurrency-limited (`mapPool`, N=4 default). 45s timeout, retry on 5xx/429/timeout with exponential backoff + Retry-After. File-based cache. `search_context_size` configurable. OpenRouter disabled. |
| `aggregate.ts` | 81 | Merges engines per query, counts distinct domains per query, flags `client_present`, computes `visibility = cited_queries / total_queries` (4dp), top 20 sources. |
| `cache.ts` | 37 | File-based JSON cache (`cache/` dir, MD5-hashed filenames, TTL configurable via `RETRIEVE_CACHE_TTL`, default 1h). Never throws. |
| `index.ts` | 47 | Orchestrator: scrape → queries → engines (parallel) → aggregate. Returns `{score, sources}` matching `fixture.json` contract. |

Total: ~684 lines.

### Engine strategy (final)

| Engine | Transport | Citation method | Status |
|--------|-----------|-----------------|--------|
| **OpenAI** | OpenAI SDK (connection pool) | Responses API `web_search` tool → structured `url_citation` annotations | Primary |
| **DeepSeek** | OpenAI SDK (baseURL override) | `chat.completions.create` → regex URL extraction from text (no native web search; training-memory recall) | Secondary |
| **OpenRouter** | Raw `fetch()` (unused) | `:online` suffix → `url_citation` annotations | Disabled — slower than OpenAI |

### Performance

| Scenario | Time | What happens |
|----------|------|-------------|
| **Cold run** (2 engines, no cache) | ~30s | 25 queries × 4 concurrent rounds × ~3s + 5s scrape |
| **Warm run** (fully cached) | ~5s | Scrape only — all 50 API calls hit disk cache |
| **No keys** | <1ms | Returns `{visibility: 0, …}` immediately |

**Optimizations applied:**
- `mapPool` with `CONCURRENCY=4` (env-overridable) — 4× speedup vs sequential
- 5xx/429/timeout retry with exponential backoff (1s, 2s, 4s) + `Retry-After` header respect
- Both engines use OpenAI SDK (built-in connection pooling, no TLS-per-query)
- Scrape timeout reduced to 5s (`SCRAPE_TIMEOUT` env var)
- Cache TTL configurable (`RETRIEVE_CACHE_TTL`, default 3600000ms)
- `search_context_size` configurable (`OPENAI_SEARCH_CONTEXT_SIZE`, default `"low"`)
- OpenRouter disabled — added latency without better results

### Verification

- `npx tsc --noEmit` → clean.
- CLI runner: `npm run retrieve -- https://getknova.dev` → produces valid JSON matching `fixture.json` contract.
- Smoke test: `npm run retrieve -- --smoke "best project management tool"` → validates each engine individually.
- Offline/cached runs: cache populated from live runs, re-runs complete in ~5s.

---

## Person B — Action (`src/act/`) 🔨 IN PROGRESS

- **PRD-B.md** written and codex-APPROVED (gpt-5.6-sol max effort, 3 review rounds: 7 + 4 required changes applied, then APPROVED).
- Pipeline: `auditSite` → `deriveGaps` → `generateActions` (LLM w/ template fallback) → `openPr` (**direct / invite-accept / fork ladder** — the demo's "client invites the bot, bot accepts via API, PR opens live") → optional gated IndexNow → merge with A's output → `report.json`.
- CLI: `npm run act -- --url <site> --repo <owner/repo> [--dry-run] [--wait-invite <secs>] [--no-pr] [--indexnow]`.
- Rehearsal target: private repo `Kart-ing/cited-demo-site` (weak-SEO index.html baseline).
- Status: 4 modules being built by parallel agents against PRD-B frozen interfaces; integration + E2E next.

---

## Scripts (`scripts/`)

| File | Lines | Purpose |
|------|-------|---------|
| `retrieve.ts` | 139 | CLI test runner. Loads `.env`, lists available models (`--models`), smoke tests each engine (`--smoke`), runs full `retrieve()` pipeline on a URL, prints JSON + timing. |
| `dev.js` | 16 | Dev-server shim: maps `--fixture` flag → `NEXT_PUBLIC_FIXTURE=1`, spawns `next dev`. |

Usage:
```bash
npm run retrieve -- https://example.com          # run full retrieval pipeline
npm run retrieve -- --smoke "best car detailing"  # quick engine validation (1 query each)
npm run retrieve -- --models                      # list available models from all providers
```

---

## Configuration & Infrastructure

| Item | Status | Notes |
|------|--------|-------|
| `package.json` | ✅ | Next.js 14 + `openai` (A) + Hexclave (C) + `tsx` and `act`/`retrieve` scripts. |
| `tsconfig.json` | ✅ | Standard Next.js config with `@/*` path alias. |
| `fixture.json` | ✅ | Data contract with enriched example values (shape frozen). |
| `.env` | per-machine | Gitignored. A's machine has OpenAI/DeepSeek/OpenRouter/GitHub keys. This laptop: `gh` CLI supplies the GitHub token (B's code falls back to `gh auth token`); no LLM keys → generation uses template fallback. |
| `.env.example` | ✅ | Matches actual env var names used by code (incl. `ANTHROPIC_API_KEY`, `CITED_MODEL` for B). |
| `.gitignore` | ✅ | `node_modules/`, `.next/`, `.env`, `cache/`, `report.json`, `out/`. |
| `next.config` | — | Not needed; Next.js runs on defaults. |
| Pages/App dir | ✅ | `app/` created by C (dashboard + `/api/report` + Hexclave handler). |
| `next-env.d.ts` | ✅ | Present. |

---

## Updates

| Time | Who | What |
|------|-----|------|
| — | — | Repo scaffolded: dirs, fixture.json, package.json, empty modules |
| 20:15 | C | PRD-C written; codex (gpt-5.6-sol) review round 1: 3 required changes |
| 20:21 | C | Changes applied (fetch timeout, vendored fonts, fixture-mode mechanics); codex verdict: **APPROVED** |
| 20:30 | C | ChatGPT background images generated + optimized; components built (3 parallel agents) |
| 20:45 | C | Hexclave installed: auth + payments + deployments config; build green |
| 20:55 | C | Browser-verified: full flow + fixture path, zero console errors |
| 21:10 | C | Dragonfly-informed iteration: ASCII citation-graph hero, SEC—NN numbering, pill nav, giant closing wordmark |
| 21:25 | C | **DEPLOYED** via Hexclave deployments-alpha (project `5a7905b0`, service `web`): https://hxc-5a7905b0-ecf1-45a6-82cc-6ff9b480f830-web-7e3b3e5-fkffxfwij.vercel.app — fixture spine at `/?fixture=1`. Redeploy: `npx -y @hexclave/cli@latest deploy web --cloud-project-id 5a7905b0-ecf1-45a6-82cc-6ff9b480f830` |
| 24 Jul | A | `/src/retrieve` implemented end-to-end (scrape → queries → engines → aggregate → cache). `openai` added to deps. CLI runner in `scripts/retrieve.ts`. |
| 24 Jul | A | Concurrency via `mapPool` (N=4), 5xx/timeout retry with exponential backoff, Retry-After header support, HTTP keep-alive via SDK, scrape timeout reduced to 5s, cache TTL + search_context_size made configurable. |
| 24 Jul | A | DeepSeek migrated from raw `fetch()` to OpenAI SDK (baseURL override). OpenRouter disabled (too slow). Smoke command added. DeepSeek 404 double-path bug fixed. Live run against `getknova.dev` confirmed working. |
| 21:05 | B | PRD-B drafted; demo repo `Kart-ing/cited-demo-site` (private) created; tsx + `act` script wired |
| 21:37 | B | codex rounds 1–3 (7 + 4 required changes applied) → **APPROVED**; parallel module build started |
