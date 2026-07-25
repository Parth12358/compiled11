# CITED

**Your site ranks on Google. That's not where your buyers are asking anymore.**

CITED points an answer engine at your category, finds out which sources it actually reads, tells you where you're missing — and delivers the fix.

Built at [c0mpiled Startup School Hackathon](https://lu.ma/), 24 July 2026 · Transpose Platform, San Francisco.

---

## Current Status

| Module | Status |
|--------|--------|
| **Retrieval** (`src/retrieve/`) — queries, citation capture, aggregation | ✅ Done |
| **Action** (`src/act/`) — audit, gap diff, content generation, PR | ✅ Done |
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
site URL
    │
    ├─▶ run N category queries against AI answer engines
    ├─▶ capture cited URLs, aggregate by domain
    ├─▶ score visibility (cited_queries / total_queries)
    ├─▶ audit site content against gap keywords
    ├─▶ generate metadata rewrites + a gap-targeting page
    └─▶ report: keyword list + downloadable metadata file
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
      engine.ts          OpenAI + DeepSeek adapters (via OpenAI SDK)
      aggregate.ts       domain grouping, score + QueryResult[] computation
      cache.ts           file-based response cache (configurable TTL)
    act/
      audit.ts           site auditor (4 parallel HTTP fetches) ✅
      gaps.ts            keyword gap analyzer ✅
      generate.ts        DeepSeek content + metadata generator (4 parallel) ✅
      pr.ts              GitHub PR creator (standalone, decoupled from pipeline) ✅
      index.ts           orchestrator: audit → gaps → generate ✅
      adapters/
        voygr.ts         Voygr telephony adapter ✅
    ui/
      dashboard.tsx      full demo surface (NOT IMPLEMENTED)
      index.ts           component exports (NOT IMPLEMENTED)
  contract.ts             shared data contract — single source of truth
  scripts/
    retrieve.ts          CLI: retrieval, smoke tests, model listing
    act.ts               CLI: full report, keywords + metadata download
  fixture.json           data contract — shared across all modules
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
npm run retrieve -- --smoke "best car detailing"  # quick engine validation
npm run retrieve -- --models                # list available models
```

### Run the full pipeline from CLI

```bash
npm run act -- https://yoursite.com     # retrieve → audit → gaps → generate → report
                                        # outputs: keyword list + cited-metadata.txt
```

### Run the dashboard (coming soon)

```bash
npm run dev               # → http://localhost:3000 (once UI is built)
```

### Environment

```
OPENAI_API_KEY=           # primary retrieval engine (Responses API with web_search)
DEEPSEEK_API_KEY=         # retrieval engine + content generation (via OpenAI SDK)
ANTHROPIC_API_KEY=        # optional alternative for content generation
OPENROUTER_API_KEY=       # fallback retrieval engine (disabled by default)
VOYGR_API_KEY=            # optional: AI phone-call backlink outreach
CRUSTDATA_API_KEY=        # optional: company/contact enrichment
GITHUB_TOKEN=             # optional: PR creation (standalone via pr.ts)
INDEXNOW_KEY=             # optional: accelerates Bing/ChatGPT discovery
DEMO_PHONE=               # optional: demo phone for backlink calls
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
| **A** | `/retrieve` — queries, citation capture, aggregation ✅ |
| **B** | `/act` — audit, gap diff, content generation ✅ |
| **C** | `/ui` — dashboard, diff viewer, demo surface ⬜ |

## What we deliberately don't do

**We never post to sites you don't own.** No Reddit automation, no generated reviews, no wiki edits. Third-party gaps get surfaced with a suggested outreach draft for a human to send under their own name. Everything automated lands in your repo, behind your review.

That's a product decision, not a limitation. Astroturfing gets suppressed by the engines, violates FTC rules on fake reviews, and poisons the trust signals the whole strategy depends on.

**We don't claim instant results.** Bing indexing runs hours to a day even with IndexNow; Perplexity's index is faster but not guaranteed. CITED submits immediately and timestamps it. What it promises is the diagnosis and the fix, not a stopwatch.

## Stack

TypeScript · Next.js · OpenAI API (retrieval, web_search) · DeepSeek API (retrieval + content generation) · Cheerio (HTML parsing) · Octokit (GitHub PRs) · Voygr (telephony)

## License

MIT
