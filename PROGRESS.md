# CITED — Progress Tracker

**Hackathon:** c0mpiled Startup School, 24 Jul 2026  
**Repo:** compiled11  

---

## Overall Status

| Module | Person | Status | Files with code | Stub files |
|--------|--------|--------|-----------------|------------|
| `src/retrieve/` | **A** | ✅ **DONE** | 7 | 0 |
| `src/act/` | **B** | ✅ **DONE** | 6 | 0 |
| `src/ui/` | **C** | ✅ **DONE** | 2 | 0 |
| `scripts/` | — | ✅ **DONE** | 2 | 0 |

---

## Person A — Retrieval (`src/retrieve/`) ✅ COMPLETE

### Files

| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | 37 | Shared interfaces: `Citation`, `EngineName`, `EngineResult`, `SourceStats`, `Score`, `RetrieveOutput` |
| `scrape.ts` | 111 | Fetches homepage, extracts title/meta/OG tags → `{category, keywords}`. Falls back to hostname slug. Timeout: 5s (env-overridable via `SCRAPE_TIMEOUT`). |
| `queries.ts` | 74 | 25 templates + keyword-driven queries → max 30 deduplicated queries. 8 generic fallback queries when no category. |
| `engine.ts` | 302 | Two engine adapters (OpenAI + DeepSeek), both via the OpenAI SDK. Concurrency-limited (`mapPool`, N=4 default). 45s timeout, retry on 5xx/429/timeout with exponential backoff + Retry-After. File-based cache. `search_context_size` configurable. OpenRouter disabled. |
| `aggregate.ts` | 94 | Merges engines per query, counts distinct domains per query, flags `client_present`, computes `visibility = cited_queries / total_queries` (4dp), top 20 sources. Also builds `QueryResult[]` for Person B. |
| `cache.ts` | 38 | File-based JSON cache (`cache/` dir, MD5-hashed filenames, TTL configurable via `RETRIEVE_CACHE_TTL`, default 1h). Never throws. |
| `index.ts` | 85 | Orchestrator: scrape → queries → engines (parallel, 90s hard deadline) → aggregate. Returns `{score, sources, queries}`. Never throws. |

### Engine strategy (final)

| Engine | Transport | Citation method | Status |
|--------|-----------|-----------------|--------|
| **OpenAI** | OpenAI SDK (connection pool) | Responses API `web_search` tool → structured `url_citation` annotations | Primary |
| **DeepSeek** | OpenAI SDK (baseURL override) | `chat.completions.create` → regex URL extraction from text (no native web search; training-memory recall) | Secondary |
| **OpenRouter** | Raw `fetch()` (unused) | `:online` suffix → `url_citation` annotations | Disabled — slower than OpenAI |

### Performance

| Scenario | Time | What happens |
|----------|------|-------------|
| **Cold run** (2 engines, no cache) | ~90s (capped) | 25 queries × 4 concurrent rounds × ~3s, hard deadline at 90s |
| **Warm run** (fully cached) | ~5s | Scrape only — all API calls hit disk cache |
| **No keys** | <1ms | Returns `{visibility: 0, …}` immediately |

**Optimizations applied:**
- `mapPool` with `CONCURRENCY=4` (env-overridable) — 4× speedup vs sequential
- 5xx/429/timeout retry with exponential backoff (1s, 2s, 4s) + `Retry-After` header respect
- Both engines use OpenAI SDK (built-in connection pooling, no TLS-per-query)
- Scrape timeout reduced to 5s (`SCRAPE_TIMEOUT` env var)
- Hard deadline at 90s (`RETRIEVE_TIMEOUT` env var) — drops unfinished engine work, aggregates partial results
- Cache TTL configurable (`RETRIEVE_CACHE_TTL`, default 3600000ms)
- `search_context_size` configurable (`OPENAI_SEARCH_CONTEXT_SIZE`, default `"low"`)
- OpenRouter disabled — added latency without better results

### Verification

- `npx tsc --noEmit` → clean.
- CLI runner: `npm run retrieve -- https://getknova.dev` → produces valid JSON.
- Smoke test: `npm run retrieve -- --smoke "best project management tool"` → validates each engine individually.
- Contract bridge: `queries: QueryResult[]` in retrieve output feeds `computeGaps()` in act module.

---

## Person B — Action (`src/act/`) ✅ DONE

### Files

| File | Lines | Status | Purpose |
|------|-------|--------|---------|
| `audit.ts` | 249 | ✅ done | Full site audit: 4 parallel HTTP fetches (HTML, robots.txt, llms.txt, sitemap). Extracts title/meta/canonical/JSON-LD, parses robots.txt for AI crawler access, fetches sitemap (up to 50 pages), extracts NAP data. |
| `gaps.ts` | 72 | ✅ done | Gap analyzer: tokenizes queries, checks if client pages target each keyword (≥2 token overlap), classifies as `missing_page` or `thin_content`. |
| `generate.ts` | 240 | ✅ done | Content generator: 4 parallel DeepSeek-v4-pro calls (via OpenAI SDK). Produces: metadata rewrite (`MetaAction`), landing page (`NewPageAction`), `llms.txt`, `robots.txt` fix. |
| `pr.ts` | 154 | ✅ done | GitHub PR creator: uses `@octokit/rest`. Decoupled from pipeline — use standalone if PR creation needed. |
| `index.ts` | 41 | ✅ done | Orchestrator: `act(input)` wires audit → gaps → generate. PR step decoupled. Output: keyword gaps + downloadable metadata. |
| `adapters/voygr.ts` | 73 | ✅ done | Voygr telephony adapter: `placeCall`, `getCall`, `getUsage`, `awaitCall` with polling. |

### Pipeline

```
act({ client, queries, sources, live })
  │
  ├─ 1. auditSite(client.url)          → AuditResult (4 parallel HTTP fetches)
  ├─ 2. computeGaps(queries, audit)    → Gap[] (missing_page | thin_content)
  └─ 3. generateActions(gaps, audit)   → Action[] (4 parallel LLM calls)
       │
       └─ Output: keyword list + cited-metadata.txt for download
```

PR creation (`pr.ts`) is decoupled — available standalone if repo write access is available.

### Output

| Artifact | Format | Where |
|----------|--------|-------|
| Keyword gaps | Ranked list with citations + competing domains | Terminal output |
| Updated metadata | Before/after title + description diff | `./cited-metadata.txt` |
| New content page | Markdown landing page for top gap keyword | In actions output |
| llms.txt | Generated if missing | In actions output |
| robots.txt | Generated/fixed if AI crawlers blocked | In actions output |

### Performance

| Stage | Before | After | Mechanism |
|-------|--------|-------|-----------|
| Audit | 40s worst (4 sequential × 10s) | 10s worst (4 parallel) | `Promise.allSettled` all 4 fetches |
| Generate | 240s worst (4 sequential × 60s) | 60s worst (4 parallel) | `Promise.allSettled` all 4 LLM calls |
| Full pipeline (cached retrieve) | 180s+ | ~40s | Deadlines at 90s retrieve + 90s generate |

### Timeouts

```
RETRIEVE_TIMEOUT=90000        # retrieve deadline (default 90s)
ACT_GENERATE_TIMEOUT=90000    # generate deadline (default 90s)
```

### Verification

- `npx tsc --noEmit` → clean.
- CLI runner: `npm run act -- https://getknova.dev` → 5 keyword gaps, metadata saved to `cited-metadata.txt`, 40s end-to-end.
- `openPR()` available standalone if GitHub integration needed.

### Integration with Person C

- **Handoff:** write merged output to **`report.json`** at the repo root — `/api/report` serves it and the UI renders it.
- Write a script or manual step that creates `report.json` from act output + fixture.json shape.

---

## Person C — Interface (`src/ui/`) ✅ DONE

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

## Scripts (`scripts/`) ✅ DONE

| File | Lines | Purpose |
|------|-------|---------|
| `retrieve.ts` | 144 | CLI test runner. Loads `.env`, lists available models (`--models`), smoke tests each engine (`--smoke`), runs full `retrieve()` pipeline on a URL, prints JSON + timing. |
| `act.ts` | 125 | CLI reporter. Runs retrieve → audit → gaps → generate. Outputs keyword gaps, source leaderboard, updated metadata (saved to `cited-metadata.txt`). |

Usage:
```bash
npm run retrieve -- https://example.com          # run full retrieval pipeline
npm run retrieve -- --smoke "best car detailing"  # quick engine validation (1 query each)
npm run retrieve -- --models                      # list available models from all providers
npm run act -- https://yoursite.com               # full report: keywords + metadata download
```

---

## Updates

| Time | Who | What |
|------|-----|------|
| — | — | Repo scaffolded: dirs, fixture.json, package.json, empty modules |
| 24 Jul | A | `/src/retrieve` implemented end-to-end (scrape → queries → engines → aggregate → cache). `openai` added to deps. CLI runner in `scripts/retrieve.ts`. |
| 24 Jul | A | Concurrency via `mapPool` (N=4), 5xx/timeout retry with exponential backoff, Retry-After header support, HTTP keep-alive via SDK, scrape timeout reduced to 5s, cache TTL + search_context_size made configurable. |
| 24 Jul | A | DeepSeek migrated from raw `fetch()` to OpenAI SDK (baseURL override). OpenRouter disabled (too slow). Smoke command added. DeepSeek 404 double-path bug fixed. Hard 90s deadline on engine work. |
| 24 Jul | B | Part-b branch merged: `audit.ts` (site auditor, cheerio), `gaps.ts` (keyword gap analyzer), `voygr.ts` (telephony adapter), `contract.ts` (shared types), `CONTRACT.md`. Dependencies added: `cheerio`, `@anthropic-ai/sdk`, `@octokit/rest`. |
| 24 Jul | B | `generate.ts` (DeepSeek content gen), `pr.ts` (GitHub PR via Octokit), `index.ts` (orchestrator), `scripts/act.ts` (CLI runner) implemented. Contract bridge: `RetrieveOutput.queries: QueryResult[]`. |
| 24 Jul | B | Performance overhaul: 4 audit HTTP fetches parallelized (40s→10s), 4 generate LLM calls parallelized (4min→1min). Hard deadlines: `RETRIEVE_TIMEOUT` (90s), `ACT_GENERATE_TIMEOUT` (90s). |
| 24 Jul | B | PR step decoupled from act pipeline. Pipeline outputs keyword gaps + downloadable metadata file (`cited-metadata.txt`). `pr.ts` available standalone. |
| 24 Jul | C | Dashboard UI complete: 3-state flow (idle → scanning → revealed), source leaderboard, gap cards, diff viewer, ship panel, Hexclave integration. Demo modes: live + fixture fallback. |
| 24 Jul | C | All three modules complete. Integration via `report.json` at repo root, served by `/api/report`. |
