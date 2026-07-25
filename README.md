# CITED

**Your site ranks on Google. That's not where your buyers are asking anymore.**

CITED points an answer engine at your category, finds out which sources it actually reads, tells you where you're missing — and opens the pull request that fixes it.

Built at [c0mpiled Startup School Hackathon](https://lu.ma/), 24 July 2026 · Transpose Platform, San Francisco.

Test client: **BR Gutter Pros** (`https://brgutterpros.com`), a gutter company in Baton Rouge, LA.

---

## Why

Roughly **80% of the URLs cited by AI answer engines don't rank in Google's top 100** for the same query. Only about 12% appear in Google's top 10. (2026 citation-analysis data via campaigncreators.)

Two consequences most teams haven't internalized:

1. Your Google rank tells you almost nothing about whether ChatGPT recommends you.
2. The pages that *do* get cited are mostly pages you don't own — listicles, review sites, comparison pages, forum threads.

The monitoring category is crowded and well funded. Every one of those tools stops at a dashboard. CITED closes the loop — and reaches out to the people whose pages *are* being cited, to ask for a mention.

## How it works

```
site URL + repo URL
        │
        ├─▶ run N category queries against an answer engine
        ├─▶ capture cited URLs, aggregate by domain
        ├─▶ score visibility (cited_queries / total_queries)
        ├─▶ audit homepage metadata, robots.txt, sitemaps, JSON-LD NAP
        ├─▶ diff client content against gap keywords
        ├─▶ generate metadata rewrites + JSON-LD schema + robots.txt + llms.txt + gap-targeting page
        ├─▶ discover sites that were cited but didn't mention the client
        ├─▶ classify each as competitor vs. directory/chamber/association
        ├─▶ scrape phone numbers, write per-target call briefs
        ├─▶ place voice calls via Voygr, track outcomes
        └─▶ open PR  →  IndexNow ping
```

### The outreach loop (the differentiator)

1. Candidate domains come from `queries[]` where the client was not cited.
2. A cheap deterministic pre-filter drops platforms that cannot be phoned (`NEVER_CALL`).
3. An **LLM classifier** judges each remaining domain: category, and crucially whether it is the client's direct COMPETITOR. Competitors are never called. This replaced string heuristics, which measurably misfired — `gutters.promatcher.com` (a directory) was wrongly flagged a competitor because of its subdomain.
4. Phone numbers are scraped from each target's own site: JSON-LD `telephone` → `tel:` link → proximity-gated visible-text regex, normalized to E.164. Measured 6/6 on chambers, associations and niche directories.
5. A call brief is written per target, then Voygr places the call.

## Quickstart

```bash
git clone <repo> && cd cited
npm install
cp .env.example .env      # add your keys
```

### Commands

```bash
npm run retrieve -- <url>            # Part A — scrape → queries → engines → aggregate
npm run act -- <url>                 # Part B — audit → gaps → generate → outreach → PR
npm run act -- <url> --queries f.json --fixture   # use saved queries + fixture data
npm run act -- <url> --live-call                  # actually place Voygr calls
npm run act -- <url> --live-pr                    # actually open a GitHub PR
npm run act -- <url> --live-all                   # everything live; prints warning, waits 5s
```

`npm run dev` does not yet serve anything — Part C (the UI) is still stubs; no `app/` or `pages/` directory exists.

### Environment

```
OPENAI_API_KEY=           # Part A retrieval (OpenAI Responses API)
OPENROUTER_API_KEY=       # Part A retrieval fallback (perplexity/sonar)
ANTHROPIC_API_KEY=        # content + metadata generation + classify
VOYGR_API_KEY=            # voice call placement
GITHUB_TOKEN=             # PR creation via Octokit
INDEXNOW_KEY=             # Bing/ChatGPT index notification
DEMO_PHONE=               # target phone override for demos
```

### Demo mode (no keys, no network)

```bash
npm run act -- <url> --fixture
```

Reads `fixture.json` and runs the full pipeline against cached data. Use this if the venue wifi dies. **It will.**

## Architecture

```
/src
  /retrieve      scrape.ts, queries.ts, engine.ts, aggregate.ts, cache.ts, index.ts
                 → score, sources, queries[]
  /act           audit.ts, gaps.ts, generate.ts, outreach.ts, classify.ts, call.ts,
                 pr.ts, index.ts, scripts/act.ts, adapters/voygr.ts
                 → gaps, actions, pr_url, call outcomes
  /ui            stubs only — no dashboard yet
fixture.json     the contract — see below
```

Three modules, one JSON contract between them. Each is independently runnable.

## The contract

Everything flows through one object. Build against it from minute zero.

```json
{
  "client": { "url": "", "repo": "", "name": "" },
  "score":  { "visibility": 0.0, "cited_queries": 0, "total_queries": 0 },
  "sources": [{ "domain": "", "citation_count": 0, "client_present": false }],
  "queries": ["gutter installation baton rouge", "..."],
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
| **A** (Parth) | `/src/retrieve` — queries, citation capture, aggregation |
| **B** | `/src/act` — audit, gap diff, generation, outreach, classify, call, PR |
| **C** | `/src/ui` — dashboard, diff viewer, the whole demo surface (not started) |

## Safety posture

**Every side effect is dry-run by default.** Real phone calls need `--live-call`, a real PR needs `--live-pr`, IndexNow needs `--live-indexnow`. `--live-all` arms them together and the CLI prints a warning then waits 5 seconds first. Call targets start at `status: "pending_approval"`.

**We never post to sites you don't own.** No Reddit automation, no generated reviews, no wiki edits. Third-party gaps get a voice call from a real person, placed through the target's own public phone number, and the outcome is logged for human follow-up. Everything automated lands in your repo, behind your review.

That's a product decision, not a limitation. Astroturfing gets suppressed by the engines, violates FTC rules on fake reviews, and poisons the trust signals the whole strategy depends on.

**We don't claim instant results.** Bing indexing runs hours to a day even with IndexNow; Perplexity's index is faster but not guaranteed. CITED submits immediately and timestamps it. What it promises is the diagnosis and the fix, not a stopwatch.

## What is not done

Part C (`src/ui/`) — the dashboard, diff viewer, and demo surface — is still stubs. No `app/` or `pages/` directory exists; `npm run dev` serves nothing. This is the largest remaining gap.

Known issues:
- `main` and `part-b` have diverged and need reconciling.
- `meta` and `schema` actions are rendered as diffs rather than committed, because we do not hold the file's full original contents.

## Roadmap

- [ ] Dashboard UI (Part C)
- [ ] Merge `main` and `part-b`
- [ ] Multi-engine coverage + overlap analysis
- [ ] Scheduled re-runs with score deltas
- [ ] Category retrieval graph — which domains control which verticals, across clients

That last one is the actual company. The service wins the first customers; the graph compounds.

## Stack

TypeScript · Node.js · OpenRouter API (`perplexity/sonar`) · OpenAI Responses API · Anthropic API · GitHub API (Octokit) · Voygr API (voice calls) · IndexNow

## License

MIT
