Create and edit ONLY `src/act/classify.ts`. Do not edit any other file.
Do NOT call external APIs and do NOT run a server. You MAY run `node --check src/act/classify.ts`.

PURPOSE: decide, using an LLM, whether each candidate domain is a link-granting organisation we
should phone (chamber, directory, association, blog, listicle) or the client's direct COMPETITOR
that we must never phone. This replaces brittle string heuristics — the judgment is semantic.

WHY (measured failures of the deterministic approach this replaces):
- `gutters.promatcher.com` is a contractor DIRECTORY but was flagged a competitor purely because
  the subdomain contains the client's trade word "gutters".
- `angi.com` and `bbb.org` are a directory and an association, but neither domain string nor page
  title contains any keyword, so both fell through to "other" and were dropped.
- `leaffilter.com`, `faithfulgutters.com`, `geauxprogutters.com` ARE real competitors and must
  keep being excluded.
Your classifier must get all six of those right for a gutter-cleaning client in Baton Rouge.

CONTEXT (study read-only, do not edit):
- `src/act/generate.ts` already talks to OpenRouter. MIRROR its `complete()` helper exactly for
  client construction: `new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL:
  "https://openrouter.ai/api/v1" })` and `client.chat.completions.create`. Use model
  `"anthropic/claude-sonnet-5"`. `openai` is already a dependency.
- `src/act/generate.ts` also has a `parseLoose()` helper that strips ``` fences and extracts the
  outermost balanced `{...}`. Write an equivalent local helper here (do NOT import across modules
  — keep this file self-contained), extended to also handle a top-level `[...]` array.

IMPLEMENT:

1. `export interface TargetVerdict {
     domain: string;
     category: "chamber" | "directory" | "association" | "blog" | "listicle" | "other";
     is_competitor: boolean;
     callable: boolean;
     reason: string;
   }`

2. `export async function classifyCandidates(
     client: { name: string; trade: string | null; locality: string | null },
     candidates: { domain: string; title: string | null; description: string | null }[]
   ): Promise<Map<string, TargetVerdict>>`

   - Return an EMPTY Map immediately if `process.env.OPENROUTER_API_KEY` is unset or
     `candidates` is empty. (The caller treats an empty map as "no verdict" and falls back.)
   - Make ONE batched call for ALL candidates — never one call per domain. Cheaper and more
     self-consistent.
   - System prompt must establish the task precisely:
     * The client is a business; you are given its name, trade and locality.
     * For each candidate domain decide `category`, `is_competitor`, `callable`, `reason`.
     * `is_competitor` = true when the candidate SELLS THE SAME SERVICE to the same kind of
       customer as the client. A directory, marketplace, review site, chamber, association, news
       site or blog is NEVER a competitor even when its name, domain or title contains the
       client's trade words.
     * `callable` = true only when a human at that organisation could plausibly add or approve a
       listing/link for the client. Directories, chambers, associations, local blogs and
       roundup/listicle publishers are callable. Competitors are never callable. Huge consumer
       platforms with no reachable listings desk (search engines, social networks, Wikipedia,
       Reddit) are not callable.
     * `reason` is one short clause, max 15 words.
   - User content: the client block, then a numbered list of candidates with domain, title and
     description.
   - Demand STRICT JSON: `{"verdicts":[{"domain":"…","category":"…","is_competitor":bool,
     "callable":bool,"reason":"…"}]}` and nothing else.
   - Parse with your tolerant parser. Validate every entry: `category` must be one of the six
     literals (anything else → `"other"`), the two booleans coerced with `=== true`, `domain`
     matched case-insensitively back to an input candidate (ignore unknown domains the model
     invents). Skip malformed entries rather than failing the batch.
   - Key the returned Map by the ORIGINAL candidate domain string.
   - 45s timeout via `Promise.race` against a timeout promise, mirroring `generate.ts`.
   - Catch everything and return an empty Map on any failure. **Never throw.**
   - Log a one-line summary to `console.error`: how many candidates went in, how many verdicts
     came back, and how many were judged competitors.

CONSTRAINTS:
- No new dependencies.
- Nothing in this file may throw.
- Do not import from `src/act/outreach.ts` (that module will import THIS one — avoid a cycle).

Validate with `node --check src/act/classify.ts`, then `git --no-pager diff` and show it.
