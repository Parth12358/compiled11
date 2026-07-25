Create and edit ONLY these two files: `src/act/index.ts` and `scripts/act.ts`. Nothing else.
Do NOT call external APIs and do NOT run a server. You MAY run
`node --check src/act/index.ts` and `node --check scripts/act.ts`.

PURPOSE: wire the whole Part B pipeline into one call, and give it a CLI so we can run any client
end to end. Every module below is ALREADY IMPLEMENTED — your job is composition, not reinvention.
Read each module's real exported signatures before wiring; do not guess them.

CONTEXT (study read-only, do not edit any of these):
- `src/contract.ts` is FROZEN. Import:
  `import type { ActInput, ActOutput, Action, BacklinkCallAction, Gap, OutreachTarget } from "../contract";`
  `ActInput`  = `{ client, queries, sources, approvedTargets?, fixture?, live? }` where
  `live` = `{ generate?, call?, pr?, indexnow? }`, all optional booleans.
  `ActOutput` = `{ gaps, actions, pr_url, indexnow_submitted_at }`.
- `src/act/audit.ts`     → `auditSite(url): Promise<AuditResult>`
- `src/act/gaps.ts`      → `computeGaps(queries, audit, opts?): Gap[]`
- `src/act/generate.ts`  → `generateActions({ client, audit, gaps }): Promise<Action[]>`
- `src/act/outreach.ts`  → `discoverTargets({ client, queries, sources, audit, limit? }):
                             Promise<OutreachTarget[]>` and `buildCallBrief(target, client): string`
- `src/act/call.ts`      → `toPendingAction(target, brief): BacklinkCallAction` and
                           `runCalls(actions, { live, maxCalls, concurrency }): Promise<BacklinkCallAction[]>`
- `src/act/pr.ts`        → `openPR({ client, actions, live }): Promise<string | null>` and
                           `pingIndexNow({ client, actions, live }): Promise<string | null>`

IMPLEMENT in `src/act/index.ts`:

`export async function act(input: ActInput): Promise<ActOutput>`

Pipeline order:
 1. If `input.fixture === true`, read `fixture.json` from the repo root
    (`fs.promises.readFile`, path via `process.cwd()`), and return its `gaps`, `actions`,
    `pr_url` and `indexnow_submitted_at` directly. Wrap in try/catch; on failure fall through
    to the live path rather than throwing.
 2. `auditSite(input.client.url)`.
 3. `computeGaps(input.queries, audit)`.
 4. Run these two CONCURRENTLY with `Promise.all`, since they are independent:
    - `generateActions({ client, audit, gaps })` → the on-site actions
    - the outreach chain: `discoverTargets({ client, queries, sources, audit })`, then for each
      target `toPendingAction(target, buildCallBrief(target, input.client))`
 5. Calls: if `input.approvedTargets` is a non-empty array, keep only the pending call actions
    whose `target.domain` appears in it; if it is undefined, keep all of them. Then
    `runCalls(pendingCallActions, { live: input.live?.call === true, maxCalls: 3 })`.
    **Note `runCalls` already dry-runs unless `live` is true — pass the flag through, do not
    add a second gate of your own.**
 6. `actions` = the generated on-site actions followed by the call actions.
 7. `pr_url` = `await openPR({ client, actions, live: input.live?.pr === true })`.
    `indexnow_submitted_at` = `await pingIndexNow({ client, actions,
    live: input.live?.indexnow === true })`.
 8. Return `{ gaps, actions, pr_url, indexnow_submitted_at }`.

Requirements: `act()` must NEVER throw. Wrap each stage in try/catch and degrade — a failed
audit yields empty gaps, a failed generate yields no on-site actions, a failed outreach yields no
call actions. Log stage failures with `console.error`. Also
`export type { ActInput, ActOutput } from "../contract";`

IMPLEMENT in `scripts/act.ts` — a CLI runner:

- MIRROR `scripts/retrieve.ts` exactly for its `loadEnv()` helper (it hand-parses `.env` into
  `process.env`; copy that approach, do not add `dotenv`).
- Usage:
    `npm run act -- <site-url> [--repo owner/name] [--fixture] [--live-call] [--live-pr]
                    [--live-indexnow] [--live-all] [--queries <path.json>]`
- Resolve `queries` and `sources`: if `--queries <path>` is given, read that JSON file and accept
  either a bare array of QueryResult or a full report object with `queries`/`sources` keys.
  Otherwise fall back to `fixture.json`'s `queries` and `sources`. Print which source was used to
  stderr.
- Build the `client` from the URL: `name` from the hostname with the leading `www.` stripped and
  the TLD removed, `repo` from `--repo` (default `""`).
- `--live-all` sets call, pr and indexnow live together. Default with no flags is a FULL DRY RUN.
- Before running, print to stderr which keys are present as `set`/`MISSING`:
  `CRUSTDATA_API_KEY`, `VOYGR_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`,
  `GITHUB_TOKEN`, `INDEXNOW_KEY`.
- **If any `--live-*` flag is passed, print a clear warning to stderr naming exactly what will
  happen (real phone calls / a real PR), then wait 5 seconds before proceeding** so it can be
  Ctrl-C'd. Use a plain `setTimeout` promise.
- Print the final `ActOutput` as pretty JSON on **stdout only** (all logging goes to stderr), and
  print the elapsed seconds to stderr.
- End with `main().catch(e => { console.error(e); process.exit(1); })`, same as `scripts/retrieve.ts`.

Do not add dependencies. Do not edit `package.json` — the `act` script entry already exists.

Finally run `node --check src/act/index.ts && node --check scripts/act.ts`, then
`git --no-pager diff` and show it.
