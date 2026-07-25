# CITED — Progress Tracker

**Hackathon:** c0mpiled Startup School, 24 Jul 2026  
**Repo:** compiled11  

---

## Team & Workstreams

| Person | Module | Status | Notes |
|--------|--------|--------|-------|
| **A** | `/src/retrieve` — queries, citation capture, aggregation | ⬜ not started | Delivers `score` + `sources` |
| **B** | `/src/act` — audit, gap diff, generation, PR | ⬜ not started | Delivers `gaps` + `actions` + `pr_url` |
| **C** | `/src/ui` — dashboard, diff viewer, demo surface | ⬜ not started | Full demo UI |

---

## Person A — Retrieval

### Files
| File | Status | Last updated |
|------|--------|--------------|
| `src/retrieve/queries.ts` | ⬜ scaffold | — |
| `src/retrieve/engine.ts` | ⬜ scaffold | — |
| `src/retrieve/aggregate.ts` | ⬜ scaffold | — |
| `src/retrieve/cache.ts` | ⬜ scaffold | — |
| `src/retrieve/index.ts` | ⬜ scaffold | — |

### Approach
- **No Perplexity.** Use OpenAI + DeepSeek + OpenRouter.
- Prompt LLMs to return links (URLs) for each category query.
- Parse URLs from text responses via regex.
- Aggregate citations by domain.
- Compute visibility: `cited_queries / total_queries`.
- Cache all responses to disk (demo runs from cache on re-run).

### Blockers / Decisions needed
- Single-API or multi-API per query? (OpenRouter as gateway, or separate keys?)
- Prompt strategy: how to ask the LLM for links?
- Category/keyword extraction from client homepage — scrape or manual input?

---

## Updates

| Time | Who | What |
|------|-----|------|
| — | — | Repo scaffolded: dirs, fixture.json, package.json, empty modules |
