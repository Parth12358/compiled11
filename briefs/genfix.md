Edit ONLY `src/act/generate.ts`. Do not create or edit any other file.
Do NOT call external APIs and do NOT run a server. You MAY run `node --check src/act/generate.ts`.

This file ALREADY EXISTS and works. Preserve every existing export and signature:
`buildRobotsAction`, `buildSchemaAction`, `buildLlmsTxtAction`, `buildMetaAction`,
`buildGapPageAction`, `generateActions`.

THE BUG (observed in a real end-to-end run against a live client):
stderr printed `Failed to parse LLM gap page response, falling back to deterministic`, so the
flagship generated page silently degraded to the TODO stub. The stub is a valid fallback for a
no-key demo, but here a key WAS present and the model DID answer — we just failed to parse it.
Cause: the code does `JSON.parse(llmResult.trim())` on the raw completion. Models routinely wrap
JSON in ```json fences, add a prose preamble, or emit the markdown page directly instead of JSON.

FIX 1 — tolerant JSON extraction. Add a private helper:
`function parseLoose(raw: string | null): Record<string, unknown> | null`
  - null/empty in → null out.
  - Strip a leading/trailing markdown code fence: remove a leading line matching
    /^\s*```(?:json)?\s*$/ and a trailing /^\s*```\s*$/.
  - Try `JSON.parse` on the result.
  - On failure, extract the outermost balanced `{...}` span (first `{` to last `}`) and retry.
  - On failure return null. Never throw.
Use it in BOTH `buildMetaAction` and `buildGapPageAction` in place of the current bare
`JSON.parse` calls.

FIX 2 — accept a raw-markdown answer for the gap page.
In `buildGapPageAction`, if `parseLoose` returns null but the completion is non-empty and looks
like a page (it contains a `#` heading OR starts with `---` front matter), USE THAT TEXT DIRECTLY
as the `after` content instead of discarding it. Before using it, ensure it has YAML front matter:
if the text does not already start with `---`, prepend front matter built from the gap keyword
(`title:` title-cased keyword, `description:` a one-line summary). Only fall back to the
deterministic stub when the completion is null/empty or has neither JSON nor page-like content.

FIX 3 — same tolerance for the meta action.
In `buildMetaAction`, if `parseLoose` returns null, attempt a regex rescue over the raw text for
`<title>...</title>` and `<meta name="description" content="...">`. If both are found, use them.
Only fall back to the deterministic rewrite if that also fails.

FIX 4 — make the failure log actionable.
Replace the generic `console.error("Failed to parse LLM ...")` messages with ones that state which
builder failed AND include the first 200 characters of the raw completion, so the next failure is
diagnosable from the log alone.

CONSTRAINTS:
- Do not change the LLM provider chain in `complete()` — it is correct.
- Do not change any function signature or the order of actions returned by `generateActions`.
- Deterministic fallbacks must still work with no API key at all.
- No new dependencies. Never throw.

Validate with `node --check src/act/generate.ts`, then `git --no-pager diff` and show it.
