# CITED — Progress Tracker

**Hackathon:** c0mpiled Startup School, 24 Jul 2026  
**Repo:** compiled11  

---

## Team & Workstreams

| Person | Module | Status | Notes |
|--------|--------|--------|-------|
| **A** | `/src/retrieve` — queries, citation capture, aggregation | ⬜ not started | Delivers `score` + `sources` |
| **B** | `/src/act` — audit, gap diff, generation, PR | ⬜ not started | Delivers `gaps` + `actions` + `pr_url` |
| **C** | `/src/ui` — dashboard, diff viewer, demo surface | ✅ **done** | Full demo UI live; PRD-C codex-APPROVED; verified in browser |

---

## Person C — Interface (DONE)

### What exists
- **Design:** "the machine's reading room" — paper-world hero → streaming query scan → ink-flood inversion → dark dashboard where citations glow amber. Fraunces / Instrument Sans / IBM Plex Mono, all vendored in `src/ui/fonts/` (zero network). Palette CVD-validated (diff green adjusted to `#2BA793`, deutan ΔE 9.8). Backgrounds generated with ChatGPT (`public/assets/beam.jpg`, `constellation.jpg`).
- **Flow:** `idle → scanning → revealed`. Scan runs ≥4s and races `GET /api/report` with a hard 3.5s abort → falls back to bundled fixture; the demo cannot stall on network.
- **Sections:** verdict headline + animated score arc (denominator explicit), ranked source leaderboard (amber = client present), gap keyword cards, diff viewer (rewrite diffs + generated-file mode, per-file tabs), ship panel (PR link / "Connect repo" ghost + IndexNow state), Hexclave $99/mo checkout card, close line.
- **Demo modes:**
  - `npm run dev:plain` → http://localhost:3000 — full interactive flow (standalone, no Hexclave).
  - **Pre-baked tab-2 spine: `http://localhost:3000/?fixture=1`** — zero network, straight to the reveal.
  - `npm run dev -- --fixture` also works (dev.js shim maps the flag).
  - `npm run dev` = Hexclave CLI wrapper (onboarding/link flow) around the same server.

### Integration seams for A + B
- **Contract:** `fixture.json` (values enriched, **shape unchanged**). Types in `src/ui/types.ts`.
- **Handoff:** write your merged output to **`report.json` at the repo root** — `/api/report` serves it and the UI renders it identically to the fixture. `pr_url` / `indexnow_submitted_at` light up the ship panel automatically.

### Hexclave (sponsor)
- `@hexclave/next` installed; auth handler at `/handler/*`, sign-in button in the dashboard topbar, payments checkout card (`prod_pro_monthly`, create in dashboard → Apps → Payments), `deployments-alpha` configured in `hexclave.config.ts`.
- All Hexclave surfaces are env-gated: keyless runs render fallbacks and never construct the SDK (the demo can't be broken by a missing project).

---

## Person A — Retrieval

### Approach (unchanged)
- OpenAI + DeepSeek + OpenRouter; prompt for links, regex URLs, aggregate by domain, cache to disk.
- **New:** emit the contract shape into `report.json` at repo root (with B) — the UI picks it up with zero UI changes.

---

## Updates

| Time | Who | What |
|------|-----|------|
| — | — | Repo scaffolded: dirs, fixture.json, package.json, empty modules |
| 20:15 | C | PRD-C written; codex (gpt-5.6-sol) review round 1: 3 required changes |
| 20:21 | C | Changes applied (fetch timeout, vendored fonts, fixture-mode mechanics); codex verdict: **APPROVED** |
| 20:30 | C | ChatGPT background images generated + optimized; components built (3 parallel agents) |
| 20:45 | C | Hexclave installed: auth + payments + deployments config; build green |
| 20:55 | C | Browser-verified: full flow + fixture path, zero console errors |
| 21:10 | C | Dragonfly-informed iteration: ASCII citation-graph hero, SEC—NN numbering, pill nav, giant closing wordmark |
| 21:25 | C | **DEPLOYED** via Hexclave deployments-alpha (project `5a7905b0`, service `web`): https://hxc-5a7905b0-ecf1-45a6-82cc-6ff9b480f830-web-7e3b3e5-fkffxfwij.vercel.app — fixture spine at `/?fixture=1`. Redeploy: `npx -y @hexclave/cli@latest deploy web --cloud-project-id 5a7905b0-ecf1-45a6-82cc-6ff9b480f830` |
