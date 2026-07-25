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

## Person A — Retrieval (`src/retrieve/`) ✅ DONE

### Files

| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | 32 | Shared interfaces: `Citation`, `EngineName`, `EngineResult`, `SourceStats`, `Score`, `RetrieveOutput` |
| `scrape.ts` | 109 | Fetches homepage, extracts title/meta/OG tags → `{category, keywords}`. Falls back to hostname slug. |
| `queries.ts` | 74 | 25 templates + keyword-driven queries → max 30 deduplicated queries. Generic fallback when no category. |
| `engine.ts` | 227 | Three engine adapters: OpenAI Responses API (`web_search` tool), OpenRouter (`:online`), DeepSeek (no web-search, regex URL extraction). All with 15s timeout, 429 retry ×2, file-based cache. |
| `aggregate.ts` | 81 | Merges engines per query, counts distinct domains per query, flags `client_present`, computes `visibility = cited_queries / total_queries` (4dp), top 20 sources. |
| `cache.ts` | 37 | File-based JSON cache (`cache/` dir, MD5-hashed filenames, 1h TTL). Never throws. |
| `index.ts` | 36 | Orchestrator: scrape → queries → engines (parallel) → aggregate. Returns `{score, sources}` matching `fixture.json` contract. |

Total: ~600 lines.

### Engine strategy (as built)

| Engine | API | Citation method | Status |
|--------|-----|-----------------|--------|
| **OpenAI** | Responses API (`client.responses.create`) with `web_search` tool | Structured `url_citation` annotations in `response.output[].content[].annotations[]` | Primary |
| **OpenRouter** | Chat completions at `https://openrouter.ai/api/v1/chat/completions` with `:online` model suffix | `url_citation` annotations in `choices[0].message.annotations[]` | Fallback |
| **DeepSeek** | Chat completions at `https://api.deepseek.com/chat/completions` | **No native web search.** Regex extraction from model text output (`https?:\/\/[^\s)\]}"'<>]+`) | Last resort (training-memory recall only) |

- Engines run in **parallel** (Promise.all). Queries within each engine run **sequentially** (rate-limit safe).
- Missing `*_API_KEY` → engine skipped silently. No keys at all → returns `{visibility: 0, cited_queries: 0, total_queries: 0, sources: []}`.
- Every non-empty response cached to `cache/` (gitignored). Cache keys: `{engine}:{query}`, 1h TTL.

### Verification

- `npx tsc --noEmit` → clean (zero errors).
- Offline tests pass: `buildQueries`, `aggregate`, domain normalization, cache round-trip, no-keys path, fallback path.
- Live runs confirmed for real sites (cache populated from prior test runs — 13 cached files).

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
- [ ] Add `@anthropic-ai/sdk` or `openai` for Anthropic API (Anthropic is OpenAI-compatible via baseURL override)
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
| `retrieve.ts` | 102 | CLI test runner. Loads `.env`, lists available models (`--models`), runs `retrieve()` on a URL, prints JSON + timing. |

Usage:
```bash
npm run retrieve -- https://example.com          # run full retrieval pipeline
npm run retrieve -- --models                      # list available models from all providers
```

---

## Configuration & Infrastructure

| Item | Status | Notes |
|------|--------|-------|
| `package.json` | ✅ | Next.js 14, `openai` added. Missing: no Anthropic SDK yet (needed by Person B). |
| `tsconfig.json` | ✅ | Standard Next.js config with `@/*` path alias. |
| `fixture.json` | ✅ | Data contract with example values. Matches the exact shape all modules produce/consume. |
| `.env` | ✅ | Real API keys set for OpenAI, DeepSeek, OpenRouter, GitHub. `INDEXNOW_KEY` empty. |
| `.env.example` | ⚠️ | Out of sync with README — README mentions `PERPLEXITY_API_KEY`, actual uses `OPENAI_API_KEY` etc. |
| `.gitignore` | ✅ | Ignores `node_modules/`, `.next/`, `.env`, `cache/`. Missing: `tsconfig.tsbuildinfo`. |
| `next.config` | ⛔ **MISSING** | No `next.config.js/mjs/ts`. Next.js runs on defaults. |
| Pages/App dir | ⛔ **MISSING** | No `pages/` or `app/` directory. `npm run dev` starts Next.js but has nothing to serve (Person C must create this). |
| `next-env.d.ts` | ⛔ **MISSING** | Expected by `tsconfig.json` but doesn't exist. TypeScript tolerates this. |

---

## Known Issues

1. **Model names are placeholders.** `engine.ts` uses `gpt-5.2`, `openai/gpt-5.2:online`, `deepseek-v4-pro`. These were taken from draft API docs and may not match currently deployed models. Verify and update constants at the top of `engine.ts` before live demo.

2. **No Next.js surface exists.** `npm run dev` starts a server with no pages. Person C needs to create `pages/index.tsx` or `app/page.tsx` before the dashboard renders.

3. **`.env.example` / README mismatch.** README lists `PERPLEXITY_API_KEY` and `ANTHROPIC_API_KEY` but the actual code uses `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`. Update one or the other.

4. **No Anthropic SDK.** Person B needs Anthropic for content generation. Add `@anthropic-ai/sdk` or use OpenAI-compatible endpoint via the `openai` package that's already installed.

5. **Fixture demo mode doesn't exist.** README mentions `npm run dev -- --fixture` but there's no mechanism to pass CLI flags to Next.js nor a fixture renderer implemented. Person C should add this.

---

## Updates

| Time | Who | What |
|------|-----|------|
| — | — | Repo scaffolded: dirs, fixture.json, package.json, empty modules |
| 24 Jul | A | `/src/retrieve` implemented end-to-end (scrape → queries → engines → aggregate → cache). Typecheck + offline tests pass. `openai` added to deps. CLI runner in `scripts/retrieve.ts`. Live cache populated. |
| 24 Jul | — | Docs updated: full audit of all source files, accurate status for all tracks, known issues documented. |
