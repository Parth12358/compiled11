# PRD-C — CITED Interface (Part C)

**Owner:** Person C. **Parent:** `PRD.md` §4 (scope), §7 (demo script). **Deadline:** demo-ready tonight.

**Goal:** the entire demo surface — what judges watch for 3 minutes and vote "Most Beautiful" on. A non-technical person must understand it in 15 seconds.

---

## 1. Objective

A single-page Next.js app: site URL + repo URL go in, a retrieval "scan" plays, and the category-ownership dashboard is revealed from the `fixture.json` contract. Zero-network safe (venue wifi will die). Beautiful enough to win, legible enough to need no narration.

## 2. Design direction — "the machine's reading room"

Every monitoring competitor (Profound, Peec, StackAI) is a near-black generic SaaS dashboard. We map the visual design to the demo narrative instead:

- **Paper world (idle):** the web you think you know. Warm paper background, ink typography, ambient drifting citation superscripts (¹ ² ³) — quiet, editorial.
- **The Inversion (signature moment):** on submit, category queries stream line-by-line; then the page floods to ink-dark — you are now inside the answer engine.
- **Ink world (revealed):** the retrieval graph. Sources render as an illuminated leaderboard; every place the client IS cited **glows amber** ("where the engine's light finds you"); absences stay cold slate. A soft amber beam lights the verdict header.

### Tokens
- Color: `--paper #F5F2EA` · `--night #0B101E` (dark surface base) · `--ink #131A2A` (text on paper / raised dark surface) · `--amber #E9A23B` + glow · `--slate #5A6478` (absent/cold) · diff add `#3FA66A` · diff del `#C4554D`
- Type: **Fraunces** (display — verdict lines, big score; wonky character, restrained use) · **Instrument Sans** (UI/body) · **IBM Plex Mono** (domains, counts, URLs, diffs). Vendored locally: woff2 files committed in `src/ui/fonts/`, loaded via `next/font/local` — zero network at build, dev startup, or runtime.
- Motion (all CSS/rAF; `prefers-reduced-motion` → fades only): hero citation-mark drift · input focus beam · scan queries streaming + captured-URL ticker · the inversion transition · score arc count-up · leaderboard bar stagger + amber pulse on `client_present` · gap cards rise on scroll · diff rows strike/add sequentially · PR card slide-in.
- Backgrounds: ChatGPT-generated imagery (gpt-image via OpenAI API if a key is present, else ChatGPT web) in `public/assets/` — amber beam-on-ink hero backdrop, citation-constellation texture, paper-grain field. Hand-built SVG fallbacks if generation fails so the build never blocks. Images are ambience only; all data surfaces stay live DOM (crisp on projector, animatable).
- Bar: the motion design is judged ("Most Beautiful" / design-award level) — one orchestrated page-load + inversion sequence rather than scattered effects; every animated element serves the reveal narrative.

## 3. Structure — one route, three states

`idle → scanning → revealed`

- **idle:** hero with the hook line ("You rank fine on Google. Here's what ChatGPT actually reads."), the 80% stat, site+repo inputs (URL-validated), Run button.
- **scanning:** streams the category queries; tries `GET /api/report` (A+B's pipeline, same contract) with a **hard 3.5s `AbortController` timeout** — on timeout, non-200, or parse failure it falls back to the bundled fixture. The scan choreography runs ≥4s regardless, absorbing the wait; there is no state in which the demo can stall on network.
- **revealed:** ① Verdict header — client name, animated score arc, denominator explicit ("cited in 4 of 30 answers"), one Fraunces verdict line naming the owning domain. ② Source leaderboard — ranked domains, citation-count bars, present/absent. ③ Gap keywords. ④ Actions — metadata diff rendered before/after + generated page preview. ⑤ Ship — PR link (or "Connect repo" fallback per parent PRD §8) + IndexNow timestamp. ⑥ Close line.
- **Fixture mode** jumps straight to `revealed` from the statically imported fixture (bundled at build; zero network calls — `/api/report` is never touched). Two explicit activation mechanisms: **`/?fixture=1`** at runtime (zero config — this is the pre-baked tab-2 spine from parent PRD §7), and **`NEXT_PUBLIC_FIXTURE=1`** env. The README's documented `npm run dev -- --fixture` keeps working via a small `scripts/dev.js` shim (`"dev": "node scripts/dev.js"`) that strips the `--fixture` flag, sets `NEXT_PUBLIC_FIXTURE=1`, and spawns `next dev` — Next itself never sees the unknown flag.

## 4. Data

Consumes the `fixture.json` contract verbatim; TS types in `src/ui/types.ts`. Fixture **values** get enriched (≈9 sources, 4–5 gaps, realistic before/after diff strings) so the reveal reads rich; the **shape does not change** — A and B are unaffected. UI is source-agnostic: real pipeline output that matches the shape renders identically.

## 5. Tech

Next.js 14 app router (deps already in `package.json`). No animation/chart libraries — hand-rolled CSS + `requestAnimationFrame` (fewer deps, wifi-safe install). Components split: shell/hero/scan (main) · score+leaderboard+gaps · diff+actions+PR — independently buildable against `types.ts`.

## 6. Quality floor

Responsive 1280+ stage and laptop, sane at 768. Visible keyboard focus. Reduced motion respected. Data text on dark meets AA contrast. Projector test: full brightness, amber/ink stays readable.

## 7. Out of scope

Real Hexclave auth (clean seam: optional demo "client access" gate, skippable — real integration only if time remains per parent §11), multi-engine UI, persistence, editing generated content in-UI.

## 8. Risks

- Wifi dies → everything demo-critical is bundled; fonts are vendored woff2 committed to the repo (no cache or CDN dependence).
- A/B pipeline late → `/api/report` fallback to fixture is automatic and visually identical.
- Projector washout → high-contrast pairing, tested at brightness.
- Clock → build order: leaderboard+score first, diff second, garnish last.

## Changelog

- v1 — author: Claude (Person C). Reviewer: codex/gpt-5.6-sol — verdict: REQUIRED CHANGES (1. hard fetch timeout; 2. vendor fonts locally; 3. explicit fixture-mode mechanism + zero network).
- v2 — all three required changes applied (3.5s AbortController + choreography absorption; `next/font/local` with committed woff2; `?fixture=1` / env / dev.js shim, fixture path network-free). Reviewer: codex/gpt-5.6-sol — **verdict: APPROVED**.
- v2.1 — token refinement post-approval: diff add color `#3FA66A` → `#2BA793` (CVD-validated, deutan ΔE 9.8 vs del; dataviz validator run, all separation/contrast checks pass). No structural change.
- v2.2 — user-directed design iteration (dragonfly.xyz philosophy study): hero ambient becomes an ASCII citation-graph (text-as-imagery, `src/ui/ascii.ts`) + print registration crosses; dark-world topbar → floating pill nav; sections numbered `01–04` with `SEC—NN` margin tags; page closes on a giant `CITED¹` wordmark. Sponsor additions per user instruction: Hexclave auth (`/handler/*`), $99/mo checkout card, `deployments-alpha` config. All Hexclave surfaces env-gated so keyless demo runs are untouched.
