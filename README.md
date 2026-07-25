# CITED

**Your site ranks on Google. That's not where your buyers are asking anymore.**

CITED points an answer engine at your category, finds out which sources it actually reads, tells you where you're missing — and opens the pull request that fixes it.

Built at [c0mpiled Startup School Hackathon](https://lu.ma/), 24 July 2026 · Transpose Platform, San Francisco.

---

## Current Status

| Module | Status |
|--------|--------|
| **Retrieval** (`src/retrieve/`) — queries, citation capture, aggregation | ✅ Done |
| **Action** (`src/act/`) — audit, gap diff, content generation, PR | ⬜ Not started |
| **Interface** (`src/ui/`) — dashboard, diff viewer, demo surface | ⬜ Not started |

---

## Why

Roughly **80% of the URLs cited by AI answer engines don't rank in Google's top 100** for the same query. Only about 12% appear in Google's top 10. (2026 citation-analysis data via campaigncreators.)

Two consequences most teams haven't internalized:

1. Your Google rank tells you almost nothing about whether ChatGPT recommends you.
2. The pages that *do* get cited are mostly pages you don't own — listicles, review sites, comparison pages, forum threads.

The monitoring category is crowded and well funded. Every one of those tools stops at a dashboard. CITED closes the loop.

## How it works

```
site URL + repo URL
        │
        ├─▶ run N category queries against AI answer engines
        ├─▶ capture cited URLs, aggregate by domain
        ├─▶ score visibility (cited_queries / total_queries)
        ├─▶ diff client content against gap keywords
        ├─▶ generate metadata rewrites + a gap-targeting page
        └─▶ open PR  →  dashboard
```

## Architecture

```
/
  src/
    retrieve/
      index.ts          orchestrator (scrape → queries → engines → aggregate)
      types.ts           shared interfaces
      scrape.ts          homepage scraper (title, meta, OG tags)
      queries.ts         25-30 query templates
      engine.ts          OpenAI + OpenRouter + DeepSeek adapters
      aggregate.ts       domain grouping, score computation
      cache.ts           file-based response cache (1h TTL)
    act/
      audit.ts           crawl client site (NOT IMPLEMENTED)
      gaps.ts            diff content vs gap keywords (NOT IMPLEMENTED)
      generate.ts        LLM-generated fixes (NOT IMPLEMENTED)
      pr.ts              GitHub PR creation (NOT IMPLEMENTED)
      index.ts           action orchestrator (NOT IMPLEMENTED)
    ui/
      dashboard.tsx      full demo surface (NOT IMPLEMENTED)
      index.ts           component exports (NOT IMPLEMENTED)
  scripts/
    retrieve.ts          CLI test runner for retrieval
  fixture.json           data contract — shared across all modules
  cache/                 13 cached API responses (gitignored)
```

Three modules, one JSON contract between them. Each is independently runnable.

## Quickstart

```bash
git clone <repo> && cd cited
npm install
cp .env.example .env      # add your keys
```

### Run retrieval from CLI

```bash
npm run retrieve -- https://example.com     # full pipeline, prints JSON
npm run retrieve -- --models                # list available models
```

### Run the dashboard (coming soon)

```bash
npm run dev               # → http://localhost:3000 (once UI is built)
```

### Environment

```
OPENAI_API_KEY=           # primary retrieval engine (Responses API with web_search)
OPENROUTER_API_KEY=       # fallback retrieval engine (:online model suffix)
DEEPSEEK_API_KEY=         # last-resort engine (no native web search — regex URL extraction)
GITHUB_TOKEN=             # PR creation (Person B)
INDEXNOW_KEY=             # optional, accelerates Bing/ChatGPT discovery
```

**Note:** The retrieval module works with any subset of keys. Missing keys → that engine is silently skipped. If all retrieval keys are absent, the pipeline returns a zeroed result.

## The contract

Everything flows through one object. Build against it from minute zero.

```json
{
  "client": { "url": "", "repo": "", "name": "" },
  "score":  { "visibility": 0.0, "cited_queries": 0, "total_queries": 0 },
  "sources": [{ "domain": "", "citation_count": 0, "client_present": false }],
  "gaps":    [{ "keyword": "", "type": "missing_page", "citations": 0 }],
  "actions": [{ "type": "meta", "file": "", "before": "", "after": "" }],
  "pr_url": null,
  "indexnow_submitted_at": null
}
```

If your module emits it, it works. The `retrieve()` function returns `{ score, sources }` matching this contract.

## Team

| | Owns |
|---|---|
| **A** | `/retrieve` — queries, citation capture, aggregation |
| **B** | `/act` — audit, gap diff, generation, PR |
| **C** | `/ui` — dashboard, diff viewer, the whole demo surface |

## What we deliberately don't do

**We never post to sites you don't own.** No Reddit automation, no generated reviews, no wiki edits. Third-party gaps get surfaced with a suggested outreach draft for a human to send under their own name. Everything automated lands in your repo, behind your review.

That's a product decision, not a limitation. Astroturfing gets suppressed by the engines, violates FTC rules on fake reviews, and poisons the trust signals the whole strategy depends on.

**We don't claim instant results.** Bing indexing runs hours to a day even with IndexNow; Perplexity's index is faster but not guaranteed. CITED submits immediately and timestamps it. What it promises is the diagnosis and the fix, not a stopwatch.

## Stack

TypeScript · Next.js · OpenAI API (retrieval, web_search) · OpenRouter API (retrieval, `:online`) · Anthropic API (generation, coming soon) · GitHub API (PRs) · Hexclave (auth, coming soon)

## License

MIT
