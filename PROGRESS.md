# CITED — Progress Tracker

**Hackathon:** c0mpiled Startup School, 24 Jul 2026
**Repo:** compiled11
**Test client:** BR Gutter Pros (`https://brgutterpros.com`), Baton Rouge, LA

---

## Team & Workstreams

| Person | Module | Status | Notes |
|--------|--------|--------|-------|
| **A** (Parth) | `/src/retrieve` — queries, citation capture, aggregation | done | Now also emits `queries[]` per the contract. OpenRouter model corrected to `perplexity/sonar`. |
| **B** | `/src/act` — audit, gap diff, generation, outreach, classify, call, PR | done | Implemented and verified end to end. |
| **C** | `/src/ui` — dashboard, diff viewer, demo surface | **not started** | Stubs only. No `app/` or `pages/` directory exists. Largest remaining gap. |

---

## Person A — Retrieval (`src/retrieve/`)

### Files

| File | Status |
|------|--------|
| `types.ts` | done |
| `scrape.ts` | done |
| `queries.ts` | done |
| `engine.ts` | done |
| `aggregate.ts` | done |
| `cache.ts` | done |
| `index.ts` | done |

### Implementation

- **Engines:** Primary = OpenAI Responses API (`web_search` tool, structured `url_citation` annotations). Fallback = OpenRouter `perplexity/sonar` (was `openai/gpt-5.2:online`, which does not exist — corrected).
- Both engines run in **parallel**; queries run **sequentially within** each engine to dodge rate limits (429 → 1s retry, ×2). 15s timeout per query.
- `scrape.ts` pulls `<title>` / meta description / meta keywords / OG tags → `{ category, keywords }`; falls back to hostname slug.
- `queries.ts` → 25 templates + up to 6 keyword-driven queries, deduped, capped at 30. Generic fallback when no category.
- `aggregate.ts` merges engines per query, counts **distinct domains per query**, flags `client_present`, scores `visibility = cited_queries / total_queries` (rounded 4dp), top 20 sources.
- `cache.ts` writes every non-empty result to `cache/` (md5 key, 1h TTL) so the demo re-runs offline.
- **Now emits `queries[]`** for downstream consumption by Part B (outreach classifier uses uncited queries for target discovery).
- **Never crashes:** missing key → engine skipped; both missing → `{ visibility:0, cited_queries:0, total_queries:0, sources:[] }`.

### Verification

- `npx tsc --noEmit` → clean.
- Offline test suite (buildQueries / aggregate / domain normalization / cache round-trip / no-keys path) → all pass.
- Live homepage scrape confirmed against example.com + linear.app.

### Env vars

- `OPENAI_API_KEY` and/or `OPENROUTER_API_KEY` in `.env`.

---

## Person B — Action (`src/act/`)

### Files

| File | Role | Status |
|------|------|--------|
| `audit.ts` | Homepage + robots.txt + llms.txt + sitemap audit, JSON-LD NAP extraction | done |
| `gaps.ts` | Per-query gap diff → `missing_page` / `thin_content` | done |
| `generate.ts` | LLM metadata + JSON-LD schema + robots.txt + llms.txt + gap page, each with a deterministic no-key fallback | done |
| `outreach.ts` | Autonomous target discovery, phone scraping, call-brief authoring | done |
| `classify.ts` | LLM judgment of competitor vs. directory/chamber/association | done |
| `call.ts` | Voygr call runner, outcome mapping, quota guard | done |
| `pr.ts` | Octokit PR + IndexNow ping | done |
| `index.ts` | `act()` orchestrator | done |
| `adapters/voygr.ts` | Voygr voice-call API adapter | done |
| `scripts/act.ts` | CLI runner | done |

### Implementation

- **Audit** inspects homepage metadata, robots.txt, llms.txt, sitemaps, and extracts NAP (name/address/phone) from JSON-LD.
- **Gap diff** runs per-query, classifying each as `missing_page` or `thin_content`.
- **Generation** produces metadata rewrites, JSON-LD schema, robots.txt, llms.txt, and a gap-targeting page. Each has a deterministic no-key fallback (no LLM API call needed).
- **Outreach (the differentiator):**
  1. Candidate domains come from `queries[]` where the client was not cited.
  2. A cheap deterministic pre-filter drops platforms that cannot be phoned (`NEVER_CALL`).
  3. An LLM classifier judges each remaining domain: category, and whether it is the client's direct COMPETITOR. Competitors are never called. Replaced string heuristics — `gutters.promatcher.com` (a directory) was wrongly flagged a competitor by substring match.
  4. Phone scraping: JSON-LD `telephone` → `tel:` link → proximity-gated visible-text regex, normalized to E.164. Measured 6/6 on chambers, associations, and niche directories.
  5. A call brief is written per target, then Voygr places the call.
- **PR** opens via Octokit, then submits an IndexNow ping.

### Verification

- End-to-end pipeline runs successfully against BR Gutter Pros fixture data.
- Phone scraping: 6/6 on chambers, associations, and niche directories.
- Classifier correctly distinguishes `gutters.promatcher.com` as a directory (not competitor).
- Deterministic fallbacks for generation work without API keys.

### Safety posture

- **Dry-run by default.** Real calls need `--live-call`, real PRs need `--live-pr`, IndexNow needs `--live-indexnow`.
- `--live-all` arms everything; CLI prints a warning then waits 5 seconds before proceeding.
- Call targets start at `status: "pending_approval"`.
- We never call competitors.
- We never post to sites the client does not own.

### Env vars

- `ANTHROPIC_API_KEY`, `VOYGR_API_KEY`, `GITHUB_TOKEN`, `INDEXNOW_KEY`, `DEMO_PHONE`.

---

## Person C — UI (`src/ui/`)

| Status | Notes |
|--------|-------|
| **not started** | Stubs only. No `app/` or `pages/` directory exists. `npm run dev` serves nothing. Largest remaining gap. |

---

## Known Issues

| Issue | Detail |
|-------|--------|
| **Part C does not exist** | `src/ui/` is still stubs. No dashboard, diff viewer, or demo surface. `npm run dev` serves nothing. |
| **`main` and `part-b` diverged** | The `part-b` branch contains the full `/src/act` implementation but has not been merged back. Branches need reconciling. |
| **Diff-only actions** | `meta` and `schema` actions are rendered as diffs rather than committed, because we do not hold the file's full original contents. |

---

## Updates

| Time | What |
|------|------|
| 24 Jul | Repo scaffolded: dirs, fixture.json, package.json, empty modules |
| 24 Jul | Part A implemented end-to-end. Typecheck + offline tests pass. |
| — | Part B implemented: audit, gaps, generate, outreach (classify + phone scrape + call brief + Voygr), PR, IndexNow. Verified end to end against BR Gutter Pros. |
| — | OpenRouter model corrected from `openai/gpt-5.2:online` (does not exist) to `perplexity/sonar`. |
| — | Vendors removed: CrustData, Firecrawl, Jina, Perplexity-direct, DeepSeek. Env cleaned up. |
