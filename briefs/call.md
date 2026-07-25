Create and edit ONLY `src/act/call.ts`. Do not edit any other file — in particular do NOT edit
`src/act/adapters/voygr.ts`, which is already correct.
Do NOT call external APIs and do NOT run a server. You MAY run `node --check src/act/call.ts`.

PURPOSE: this stage actually places the outreach phone calls through Voygr and turns each call
into a `BacklinkCallAction` for the report. It spends real money on real phone calls, so the
safety rails below are mandatory, not optional.

CONTEXT (study read-only, do not edit):
- `src/contract.ts` is FROZEN. Import:
  `import type { BacklinkCallAction, BacklinkOutcome, OutreachTarget, VoygrCallResult,
   TranscriptTurn } from "../contract";`
  `BacklinkCallAction` fields: `type:"backlink_call"`, `target`, `brief`, `call_id`, `status`,
  `outcome_type`, `outcome`, `outcome_summary`, `transcript`, `recording_url`, `backlink_url`.
  `status` is exactly `"pending_approval" | "queued" | "in_progress" | "completed" | "failed"`.
  `BacklinkOutcome` is exactly `"listed" | "will_follow_up" | "needs_form" | "declined" |
  "no_answer" | "pending"`.
- `src/act/adapters/voygr.ts` exports `voygr` implementing `VoygrAdapter` with
  `placeCall(target_phone, brief, language?)`, `getCall(call_id)`, `getUsage()`,
  `awaitCall(call_id, {timeoutMs, pollMs})`. Use it. Do not re-implement HTTP calls to Voygr.
- `src/act/outreach.ts` exports `buildCallBrief(target, client)`. Another agent is writing it in
  parallel — just import it if you need it; otherwise accept the brief string as a parameter.

VERIFIED API FACTS (probed live today — build against these, do not guess):
- `getUsage()` really returns `{ remaining, limit }`; our account currently shows ~1990 of 2000
  remaining. Quota is real and finite.
- A completed call's `outcome_type` uses VOYGR'S OWN taxonomy, which is reservation-flavoured and
  does NOT match our `BacklinkOutcome`. A real observed value is `"success_no_booking"`.
  You MUST map it. Other values you should handle: anything containing "no_answer"/"noanswer",
  "voicemail", "failed"/"error", "declined"/"refused", "success".
- `transcript_full` is frequently `null` even on a completed call. Handle null everywhere.
- `recording_url` comes back as a RELATIVE path like `/calls/<id>/recording`, NOT an absolute URL.

IMPLEMENT these exports:

1. `export function mapOutcome(result: VoygrCallResult): BacklinkOutcome`
   Pure function. Decide from `result.status`, `result.outcome_type` and `result.outcome_summary`
   (lowercased substring matching), in this priority order:
   - status is not terminal (`queued`/`in_progress`/`ringing`) → `"pending"`
   - outcome_type or summary mentions no answer / voicemail / busy → `"no_answer"`
   - summary mentions "added", "listed", "will add", "added you to" → `"listed"`
   - summary mentions "form", "submit", "application", "online portal", "email us" → `"needs_form"`
   - summary mentions "call back", "follow up", "send an email", "check with", "pass it on" →
     `"will_follow_up"`
   - outcome_type/summary mentions declined/refused/not interested/no thank → `"declined"`
   - status === "completed" with none of the above → `"will_follow_up"`
   - anything else → `"pending"`
   Order matters: check `declined` BEFORE the generic completed fallback.

2. `export function absolutizeRecording(url: string | null): string | null`
   If `url` is null → null. If it already starts with `http` → return unchanged. Otherwise prefix
   `https://api.voygr.tech`. (This fixes the relative-path issue noted above.)

3. `export function toPendingAction(target: OutreachTarget, brief: string): BacklinkCallAction`
   Pure. Builds the pre-call record: `type:"backlink_call"`, the given `target` and `brief`,
   `call_id:null`, `status:"pending_approval"`, and every outcome field `null`.

4. `export async function runCalls(actions: BacklinkCallAction[], opts: {
     live?: boolean; maxCalls?: number; concurrency?: number; timeoutMs?: number;
   }): Promise<BacklinkCallAction[]>`
   The runner. Rules, all mandatory:
   - **`opts.live !== true` is the DEFAULT and means DRY RUN.** In dry run, place no calls at all:
     return the actions unchanged with `status:"pending_approval"`. Log a line per action saying
     what WOULD have been dialled. This is the safety default — do not invert it.
   - Only act on actions whose `status` is `"pending_approval"` and whose `target.phone` is a
     non-null string. Anything else passes through untouched.
   - Before dialling, call `voygr.getUsage()`. If it throws, abort the whole live run and return
     the actions unchanged (do not dial blind). If `remaining` is less than the number of calls
     you intend to place, reduce the number of calls to `remaining` and log that you truncated.
   - Cap the run at `opts.maxCalls ?? 3` calls. Never exceed it.
   - Run with concurrency `opts.concurrency ?? 2` — a simple worker-pool over the queue, not
     `Promise.all` over everything.
   - Per call: `voygr.placeCall(target.phone, action.brief)` → set `call_id` and
     `status:"in_progress"`; then `voygr.awaitCall(call_id, { timeoutMs: opts.timeoutMs ?? 300000 })`.
     On the result set `status:"completed"`, `outcome_type` ← raw `result.outcome_type`,
     `outcome` ← `mapOutcome(result)`, `outcome_summary` ← `result.outcome_summary`,
     `transcript` ← `result.transcript_full` (may be null),
     `recording_url` ← `absolutizeRecording(result.recording_url)`.
   - Any error on an individual call → that action gets `status:"failed"` and
     `outcome:"pending"`, and the run CONTINUES with the others. One bad number must never abort
     the batch.
   - Return a NEW array; never mutate the input objects in place (clone with spread).

REQUIREMENTS:
- `runCalls` must never throw.
- No new dependencies.
- Use `console.error` for the operational logging so it does not pollute JSON stdout.

Finally run `node --check src/act/call.ts`, then `git --no-pager diff` and show it.
