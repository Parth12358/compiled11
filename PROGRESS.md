# CITED — Progress Tracker

**Hackathon:** c0mpiled Startup School, 24 Jul 2026  
**Repo:** compiled11  

---

## Overall Status

| Module | Person | Status | Files with code | Stub files |
|--------|--------|--------|-----------------|------------|
| `src/retrieve/` | **A** | ✅ **DONE** | 7 | 0 |
| `src/act/` | **B** | ⬜ **NOT STARTED** | 0 | 5 |
| `src/ui/` | **C** | ⬜ **NOT STARTED** | 0 | 2 |
| `scripts/` | — | ✅ **DONE** | 1 | 0 |

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

## Person B — Action (`src/act/`) ⬜ NOT STARTED

All 5 files are empty stubs (10 lines of comments total):

| File | Intended purpose |
|------|-----------------|
| `audit.ts` | Crawl client homepage + sitemap, extract existing content signals |
| `gaps.ts` | Diff client content against gap keywords from retrieval |
| `generate.ts` | Generate metadata rewrites + gap-targeting page using Anthropic |
| `pr.ts` | Open a PR against client repo with generated diffs |
| `index.ts` | Orchestrator: audit → gaps → generate → PR |

**Work remaining:**
- [ ] Add `@anthropic-ai/sdk` or use OpenAI-compatible endpoint (already installed `openai` package)
- [ ] Implement `audit.ts` — fetch sitemap, crawl homepage, extract all meta tags, headings, existing llms.txt
- [ ] Implement `gaps.ts` — compare `sources[].domain` and gap keywords against client content, identify missing topics
- [ ] Implement `generate.ts` — use LLM to generate metadata diffs (title/meta/og) and one blog page targeting top gap keyword
- [ ] Implement `pr.ts` — create a branch, commit generated files, open PR via GitHub API
- [ ] Implement `index.ts` — wire the pipeline, output `{gaps, actions, pr_url}` matching fixture.json contract
- [ ] Skip PR if `GITHUB_TOKEN` missing or auth takes >20s → render diff in UI

---

## Person C — Interface (`src/ui/`) ⬜ NOT STARTED

Both files are empty stubs (4 lines of comments total):

| File | Intended purpose |
|------|-----------------|
| `dashboard.tsx` | Full dashboard: input form, score, source leaderboard, gaps, actions, PR link |
| `index.ts` | Entry point exporting all UI components |

**Work remaining:**
- [ ] Create Next.js pages (no `pages/` or `app/` directory exists yet)
- [ ] Implement input form (site URL + repo URL)
- [ ] Implement score display (visibility gauge with denominator)
- [ ] Implement source leaderboard table (domain, citation_count, client_present with Y/N badge)
- [ ] Implement gap keywords list with citation counts
- [ ] Implement diff viewer (before/after metadata side-by-side)
- [ ] Implement generated page preview
- [ ] Implement PR link display
- [ ] Wire to fixture.json for offline/dev mode
- [ ] Wire to `retrieve()` and act module for live mode
- [ ] Hexclave auth integration ($1,000 prize)

---

## Scripts (`scripts/`) ✅ DONE

| File | Lines | Purpose |
|------|-------|---------|
| `retrieve.ts` | 139 | CLI test runner. Loads `.env`, lists available models (`--models`), smoke tests each engine (`--smoke`), runs full `retrieve()` pipeline on a URL, prints JSON + timing. |

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
| `package.json` | ✅ | Next.js 14, `openai` added. |
| `tsconfig.json` | ✅ | Standard Next.js config with `@/*` path alias. |
| `fixture.json` | ✅ | Data contract with example values. Matches the exact shape all modules produce/consume. |
| `.env` | ✅ | Real API keys set for OpenAI, DeepSeek, OpenRouter, GitHub. `INDEXNOW_KEY` empty. |
| `.env.example` | ✅ | Matches actual env var names used by code. |
| `.gitignore` | ✅ | Ignores `node_modules/`, `.next/`, `.env`, `cache/`. |
| `next.config` | ⛔ **MISSING** | No `next.config.js/mjs/ts`. Next.js runs on defaults. |
| Pages/App dir | ⛔ **MISSING** | No `pages/` or `app/` directory. Person C must create this for the dashboard. |
| `next-env.d.ts` | ⛔ **MISSING** | Expected by `tsconfig.json`. TypeScript tolerates this. |

---

## Updates

| Time | Who | What |
|------|-----|------|
| — | — | Repo scaffolded: dirs, fixture.json, package.json, empty modules |
| 24 Jul | A | `/src/retrieve` implemented end-to-end (scrape → queries → engines → aggregate → cache). `openai` added to deps. CLI runner in `scripts/retrieve.ts`. |
| 24 Jul | A | Concurrency via `mapPool` (N=4), 5xx/timeout retry with exponential backoff, Retry-After header support, HTTP keep-alive via SDK, scrape timeout reduced to 5s, cache TTL + search_context_size made configurable. |
| 24 Jul | A | DeepSeek migrated from raw `fetch()` to OpenAI SDK (baseURL override). OpenRouter disabled (too slow). Smoke command added. DeepSeek 404 double-path bug fixed. Live run against `getknova.dev` confirmed working. |
