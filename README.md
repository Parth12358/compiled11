# CITED

**Your site ranks on Google. That's not where your buyers are asking anymore.**

CITED points an answer engine at your category, finds out which sources it actually reads, tells you where you're missing — and opens the pull request that fixes it.

Built at [c0mpiled Startup School Hackathon](https://lu.ma/), 24 July 2026 · Transpose Platform, San Francisco.

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
        ├─▶ run N category queries against an answer engine
        ├─▶ capture cited URLs, aggregate by domain
        ├─▶ score visibility (cited_queries / total_queries)
        ├─▶ diff client content against gap keywords
        ├─▶ generate metadata rewrites + a gap-targeting page
        └─▶ open PR  →  dashboard
```

## Quickstart

```bash
git clone <repo> && cd cited
npm install
cp .env.example .env      # add your keys
npm run dev               # → http://localhost:3000
```

### Environment

```
PERPLEXITY_API_KEY=      # citation retrieval
ANTHROPIC_API_KEY=       # content + metadata generation
GITHUB_TOKEN=            # PR creation (optional)
INDEXNOW_KEY=            # optional, accelerates Bing/ChatGPT discovery
```

### Demo mode (no keys, no network)

```bash
npm run dev -- --fixture
```

Reads `fixture.json` and renders the full dashboard. Use this if the venue wifi dies. **It will.**

## Architecture

```
/src
  /retrieve    queries.ts, engine.ts, aggregate.ts     → score, sources
  /act         audit.ts, gaps.ts, generate.ts, pr.ts   → gaps, actions, pr_url
  /ui          dashboard, source table, diff viewer
fixture.json   the contract — see below
```

Three modules, one JSON contract between them. Each is independently runnable.

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

`--fixture` renders this exact shape. If your module emits it, it works.

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

## Roadmap

- [ ] Multi-engine coverage + overlap analysis
- [ ] Scheduled re-runs with score deltas
- [ ] Outreach drafts for third-party gaps
- [ ] Category retrieval graph — which domains control which verticals, across clients

That last one is the actual company. The service wins the first customers; the graph compounds.

## Stack

TypeScript · Next.js · Perplexity API (retrieval) · Anthropic API (generation) · GitHub API (PRs) · Hexclave (auth)

## License

MIT
