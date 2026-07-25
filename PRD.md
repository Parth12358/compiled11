# PRD — CITED

**Working name.** Rename it if something better lands.

**One line:** Point it at a website and its repo. It finds out who actually owns your category inside AI answer engines, tells you why you're invisible, and opens the PR that fixes it.

**Built for:** c0mpiled Startup School Hackathon, 24 Jul 2026. 3 people, ~2 hours of build.

---

## 1. The problem

Companies optimize for Google and assume AI answers follow. They don't.

Analysis published in 2026 (campaigncreators, citing citation-analysis data) found roughly **80% of LLM citations don't rank in Google's top 100** for the same query, and only about **12% of AI-cited URLs appear in Google's top 10**. The retrieval graph is a different graph.

Worse: the pages answer engines cite are mostly **pages you don't own** — listicles, review sites, comparison pages, Reddit threads, docs. So "improve your site" is only half an answer, and nobody tells you which half.

## 2. Why now / why this isn't already solved

Monitoring is solved and well funded (Profound: $96M Series C at $1B). The gap is that these tools **stop at the dashboard**. They diagnose retrospectively. They don't act.

We close the loop: detect → diagnose → generate the fix → open the PR → re-measure.

## 3. What it does (the loop)

```
INPUT     site URL + GitHub repo URL
  ↓
[1] RETRIEVE   run N category queries against an answer engine,
               capture the cited URLs
  ↓
[2] AGGREGATE  group by domain → who controls this category?
               is the client present anywhere?
  ↓
[3] SCORE      visibility = cited_queries / total_queries
               plus per-source presence/absence
  ↓
[4] DIAGNOSE   gap keywords = terms driving citations
               where the client has no matching content
  ↓
[5] ACT        rewrite title/meta/schema, add llms.txt,
               generate one gap-targeting page
  ↓
[6] SHIP       open a PR against the repo with the diff
  ↓
[7] DISPLAY    dashboard: sources, score, gaps, actions, PR link
```

## 4. Scope

### In (must exist by 10:00 PM)
- Input form: site URL + repo URL
- One answer engine, 20–30 queries, real citations
- Source leaderboard: which domains own this category, client present Y/N
- Visibility score with the denominator shown
- Gap keyword list
- Generated metadata diff, rendered before/after
- One generated page/blog targeting a gap keyword
- Dashboard that a non-technical person understands in 15 seconds

### Nice (only if ahead of schedule)
- Live PR opened on GitHub
- IndexNow ping + "submitted at HH:MM" timestamp
- Second engine for overlap comparison
- Re-run button showing score delta

### Explicitly out
- Multi-engine coverage (one engine, done well)
- Anything that posts to third-party sites — see §8
- Auth beyond a demo login
- Persistence beyond the session
- Crawling more than the client's homepage + sitemap

## 5. Data contract — build against this from minute 0

Write `fixture.json` first. Commit it. All three people build against it in parallel and nobody blocks.

```json
{
  "client": { "url": "https://example.com", "repo": "org/repo", "name": "Example" },
  "score": { "visibility": 0.13, "cited_queries": 4, "total_queries": 30 },
  "sources": [
    { "domain": "g2.com", "citation_count": 18, "client_present": false },
    { "domain": "reddit.com", "citation_count": 11, "client_present": true }
  ],
  "gaps": [
    { "keyword": "best X for Y", "type": "missing_page", "citations": 7 }
  ],
  "actions": [
    { "type": "meta", "file": "index.html", "before": "...", "after": "..." },
    { "type": "new_page", "file": "blog/best-x-for-y.md", "after": "..." }
  ],
  "pr_url": null,
  "indexnow_submitted_at": null
}
```

## 6. Work split

| Who | Owns | Delivers |
|-----|------|----------|
| **A — Retrieval** | queries, citation capture, aggregation | `score` + `sources` |
| **B — Action** | site audit, gap diff, content gen, PR | `gaps` + `actions` + `pr_url` |
| **C — Interface** | the entire demo surface | dashboard, starts at minute 0 from fixture |

**Timeline**
- `0:00–0:10` — agree contract, commit fixture, pick target client, fire IndexNow ping
- `0:10–1:20` — three-way parallel build
- `1:20–1:35` — first real end-to-end run
- `1:35–2:00` — rehearse the demo out loud, twice, on the presenting laptop

## 7. Demo script (3 min)

1. **Hook** — "You rank fine on Google. Here's what ChatGPT actually reads." Show the 80% figure.
2. **Live input** — take a URL from a judge or volunteer. Run it.
3. **Reveal** — source leaderboard. "These nine domains own your category. You appear in one."
4. **Diagnose** — visibility score, gap keywords.
5. **Act** — the diff. Metadata before/after, the generated page, the PR link.
6. **Close** — "Monitoring tools stop at the dashboard. This one opens the pull request."

Keep a pre-baked case loaded in a second tab as the spine. Live run is the flourish, not the dependency.

## 8. Constraints and non-negotiables

**Do not automate posting to third-party sites.** Not Reddit, not review sites, not wikis. It gets suppressed, it violates FTC fake-review rules, and it's the single fastest way to turn a good demo into a bad question. Everything we generate lands in the client's own repo. Third-party gaps get **surfaced for human outreach**, never auto-filled.

**Don't promise a live ranking change.** Bing is hours-to-a-day even with IndexNow; Perplexity is fast but not guaranteed. Ship the ping at minute 10 and treat any citation that lands by 10 PM as a bonus, never as the demo's spine.

**Repo access.** You cannot open PRs on a stranger's repo. Use a fork or a repo you control. If GitHub auth burns more than 20 minutes, fall back to rendering the diff with a "Connect repo" button — the patch is the artifact.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Engine API slow/rate-limited | Cache every response to disk on first run; demo reads cache |
| Live run returns nothing | Pre-baked case in tab 2 |
| GitHub auth eats the clock | Render diff, skip the PR |
| Serial blocking | Fixture contract at minute 0 |
| Judge asks "isn't this Profound?" | "They monitor. We act. They stop at the dashboard — that's their own users' complaint." |

## 10. RFS positioning

**AI-Native Service Companies** (Gustaf Alströmer, Summer 2026 RFS) — sell the completed work, not the tool. The category is full of dashboards that tell you your citation rate. We deliver the fix. That's the thesis stated without contortion.

Secondary: **SaaS Challengers** — AI-native replacement for a legacy SEO tooling stack priced at $250–500/mo for diagnosis alone.

## 11. Sponsor integration

- **Hexclave** — client auth, permissions, per-client dashboards. Their product used as intended. ($1,000 prize)
- **CrustData** — optional: enrich competitor domains surfaced in the source leaderboard.

## 12. Success criteria

Minimum: a stranger's URL goes in, a credible source map and a real diff come out, live, in under 90 seconds.

Stretch: a citation that didn't exist at 6:30 PM exists at 10:00 PM.
