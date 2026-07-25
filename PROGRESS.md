# CITED — Progress Tracker

**Hackathon:** c0mpiled Startup School, 24 Jul 2026  
**Repo:** compiled11  

---

## Team & Workstreams

| Person | Module | Status | Notes |
|--------|--------|--------|-------|
| **A** | `/src/retrieve` — queries, citation capture, aggregation | ✅ built | Delivers `score` + `sources`; typecheck + offline tests pass |
| **B** | `/src/act` — audit, gap diff, generation, PR | ⬜ not started | Delivers `gaps` + `actions` + `pr_url` |
| **C** | `/src/ui` — dashboard, diff viewer, demo surface | ⬜ not started | Full demo UI |

---

## Person A — Retrieval

### Files
| File | Status | Last updated |
|------|--------|--------------|
| `src/retrieve/types.ts` | ✅ done | 24 Jul |
| `src/retrieve/scrape.ts` | ✅ done | 24 Jul |
| `src/retrieve/queries.ts` | ✅ done | 24 Jul |
| `src/retrieve/engine.ts` | ✅ done | 24 Jul |
| `src/retrieve/aggregate.ts` | ✅ done | 24 Jul |
| `src/retrieve/cache.ts` | ✅ done | 24 Jul |
| `src/retrieve/index.ts` | ✅ done | 24 Jul |

### Approach (as built)
- **Engines:** Primary = OpenAI Responses API (`web_search` tool, structured `url_citation` annotations). Fallback = OpenRouter `:online`. **DeepSeek dropped** (no web search over API).
- Both engines run in **parallel**; queries run **sequentially within** each engine to dodge rate limits (429 → 1s retry, ×2). 15s timeout per query.
- `scrape.ts` pulls `<title>` / meta description / meta keywords / OG tags → `{ category, keywords }`; falls back to hostname slug.
- `queries.ts` → 25 templates + up to 6 keyword-driven queries, deduped, capped at 30. Generic fallback when no category.
- `aggregate.ts` merges engines per query, counts **distinct domains per query**, flags `client_present`, scores `visibility = cited_queries / total_queries` (rounded 4dp), top 20 sources.
- `cache.ts` writes every non-empty result to `cache/` (md5 key, 1h TTL) so the demo re-runs offline.
- **Never crashes:** missing key → engine skipped; both missing → `{ visibility:0, cited_queries:0, total_queries:0, sources:[] }`.

### Verification
- `npx tsc --noEmit` → clean.
- Offline test suite (buildQueries / aggregate / domain normalization / cache round-trip / no-keys path) → all pass. Live homepage scrape confirmed against example.com + linear.app.

### Open decisions (resolved)
- ~~Single- vs multi-API~~ → both, in parallel, keyed off available env vars.
- ~~Prompt strategy~~ → ask for authoritative sources + URLs; rely on engine's native citation annotations, not regex.
- ~~Category extraction~~ → scrape homepage meta, hostname fallback.

### Needs before live run
- `OPENAI_API_KEY` and/or `OPENROUTER_API_KEY` in `.env`.
- **Model names are placeholders** (`gpt-5.6`, `openai/gpt-5.2:online`) — confirm the real IDs against the provider before the demo. Constants live at the top of `engine.ts`.

---

## Updates

| Time | Who | What |
|------|-----|------|
| — | — | Repo scaffolded: dirs, fixture.json, package.json, empty modules |
| 24 Jul | A | `/src/retrieve` implemented end-to-end (scrape→queries→engines→aggregate→cache). Typecheck + offline tests pass. `openai` added to deps. |
