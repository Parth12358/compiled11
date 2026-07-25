Edit ONLY `PROGRESS.md` and `README.md`. Do not edit any other file.
Do NOT call external APIs and do NOT run a server. No validation command is needed.

Rewrite both documents so they describe the project AS IT ACTUALLY IS NOW. Both are badly out of
date: they still describe Part B as "not started" and reference vendors and env vars we removed.

GROUND TRUTH — use exactly these facts, do not invent others:

Client used for testing: **BR Gutter Pros** (`https://brgutterpros.com`), a gutter company in
Baton Rouge, LA.

Part A — `src/retrieve/` (owner: Parth, on `main`): scrape → build queries → run answer engines →
aggregate. Now also emits `queries[]` per the contract. The OpenRouter model was corrected to
`perplexity/sonar` (the previously configured `openai/gpt-5.2:online` does not exist).

Part B — `src/act/` — **implemented and verified end to end**:
| File | Role |
|---|---|
| `audit.ts` | homepage + robots.txt + llms.txt + sitemap audit, JSON-LD NAP extraction |
| `gaps.ts` | per-query gap diff → `missing_page` / `thin_content` |
| `generate.ts` | LLM metadata + JSON-LD schema + robots.txt + llms.txt + gap page, each with a deterministic no-key fallback |
| `outreach.ts` | autonomous target discovery, phone scraping, call-brief authoring |
| `classify.ts` | LLM judgment of competitor vs. directory/chamber/association |
| `call.ts` | Voygr call runner, outcome mapping, quota guard |
| `pr.ts` | Octokit PR + IndexNow ping |
| `index.ts` | `act()` orchestrator |
| `adapters/voygr.ts` | Voygr voice-call API adapter |
| `scripts/act.ts` | CLI runner |

Part C — `src/ui/` — **still stubs. No `app/` or `pages/` directory exists**, so `npm run dev`
serves nothing. This is the largest remaining gap.

How outreach works (describe this accurately, it is the differentiator):
1. Candidate domains come from `queries[]` where the client was not cited.
2. A cheap deterministic pre-filter drops platforms that cannot be phoned (`NEVER_CALL`).
3. An **LLM classifier** judges each remaining domain: category, and crucially whether it is the
   client's direct COMPETITOR. Competitors are never called. This replaced string heuristics,
   which measurably misfired — `gutters.promatcher.com` (a directory) was wrongly flagged a
   competitor because of its subdomain.
4. Phone numbers are scraped from each target's own site: JSON-LD `telephone` → `tel:` link →
   proximity-gated visible-text regex, normalized to E.164. Measured 6/6 on chambers,
   associations and niche directories.
5. A call brief is written per target, then Voygr places the call.

Vendors REMOVED — make sure neither document mentions them anywhere: CrustData, Firecrawl, Jina,
Perplexity-direct, DeepSeek. Env vars are now exactly: `OPENAI_API_KEY`, `OPENROUTER_API_KEY`,
`ANTHROPIC_API_KEY`, `VOYGR_API_KEY`, `GITHUB_TOKEN`, `INDEXNOW_KEY`, `DEMO_PHONE`.

Safety posture (state this plainly in both): every side effect is **dry-run by default**. Real
phone calls need `--live-call`, a real PR needs `--live-pr`, IndexNow needs `--live-indexnow`;
`--live-all` arms them together and the CLI prints a warning then waits 5 seconds first. Call
targets start at `status: "pending_approval"`. We never post to sites the client does not own.

Commands:
```
npm run retrieve -- <url>            # Part A
npm run act -- <url> [--queries f.json] [--fixture] [--live-call|--live-pr|--live-all]
```

REQUIREMENTS:
- `README.md`: keep it a crisp product README — what it is, why, how the loop works, quickstart,
  env, architecture, the honesty/safety section, and what is not done yet. Keep the existing
  voice and the "we never post to sites you don't own" argument.
- `PROGRESS.md`: a status tracker — per-module table with real status, what is verified, what is
  left, and known issues. Note as known issues: (a) Part C does not exist, (b) `main` and
  `part-b` have diverged and need reconciling, (c) `meta` and `schema` actions are rendered as
  diffs rather than committed, because we do not hold the file's full original contents.
- Do not overstate. If something is untested, say so.

Show the final content of both files when done.
