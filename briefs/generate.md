Create and edit ONLY `src/act/generate.ts`. Do not edit any other file.
Do NOT call external APIs and do NOT run a server. You MAY run `node --check src/act/generate.ts`.

PURPOSE: turn the audit + gap list into the concrete on-site fixes we ship in the PR:
metadata rewrite, JSON-LD, robots.txt, llms.txt, and one gap-targeting page.

CONTEXT (study read-only, do not edit):
- `src/contract.ts` is FROZEN. Import:
  `import type { Action, MetaAction, SchemaAction, RobotsTxtAction, LlmsTxtAction,
   NewPageAction, AuditResult, Gap, Client } from "../contract";`
- `fixture.json` in the repo root contains a realistic, correctly-shaped example of every one of
  these actions. **Read it and match its shape and quality exactly** — same field names, same
  level of detail in `rationale`, same style of `before`/`after` strings.
- `src/act/audit.ts` shows the house style: pure helpers, defensive parsing, never throws.
- `@anthropic-ai/sdk` and `openai` are BOTH already dependencies. Do not add any.

LLM ACCESS — implement this fallback chain in one small private helper
`async function complete(system: string, user: string): Promise<string | null>`:
  1. If `process.env.ANTHROPIC_API_KEY` is set → use `@anthropic-ai/sdk`
     (`new Anthropic()`, `client.messages.create`), model `"claude-sonnet-5"`, max_tokens 2000.
     Read the text from `response.content` by finding the first block with `type === "text"`.
  2. Else if `process.env.OPENROUTER_API_KEY` is set → use the `openai` package with
     `new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: "https://openrouter.ai/api/v1" })`
     and model `"anthropic/claude-sonnet-5"`, via `client.chat.completions.create`.
  3. Else return `null`.
  Wrap in try/catch, 30s timeout, return `null` on any failure. **Never throw.**

IMPLEMENT these exports. Every one must work with `complete()` returning `null` — in that case it
falls back to a deterministic, non-LLM version built from the audit data. This is what keeps the
demo alive with no keys and no network.

1. `export function buildRobotsAction(audit: AuditResult): RobotsTxtAction | null`
   Pure, no LLM. Return `null` if `audit.robots_txt` is null OR all six AI crawlers already appear
   in `audit.ai_crawlers_allowed`. Otherwise produce an action whose `after` is the existing
   robots.txt with explicit `User-agent: <bot>` / `Allow: /` stanzas appended for each of
   `GPTBot`, `OAI-SearchBot`, `PerplexityBot`, `ClaudeBot`, `Claude-SearchBot`, `Google-Extended`
   that is missing, plus a `Sitemap:` line if none is present. `before` is the original text.
   `rationale` explains that blocked AI crawlers make everything else in the report moot.

2. `export function buildSchemaAction(audit: AuditResult, client: Client): SchemaAction | null`
   Pure, no LLM. Return `null` if `audit.json_ld` already contains an Organization/LocalBusiness
   node. Otherwise emit a `<script type="application/ld+json">` block using whatever real data the
   audit found — `audit.nap.name ?? client.name`, `client.url`, `audit.nap.phone`, and address
   fields from `audit.nap` — omitting keys whose value is null. **Never invent a street address,
   phone, or city that is not in the audit.** `before` is `""`.

3. `export function buildLlmsTxtAction(audit: AuditResult, client: Client, gaps: Gap[]): LlmsTxtAction | null`
   Pure, no LLM. Return `null` if `audit.has_llms_txt` is true. Otherwise build a valid llms.txt:
   `# <name>`, a `>` summary line from `audit.meta_description` (or the title), a `## Pages`
   section listing up to 10 entries from `audit.pages`, and a `## Practical` section with only the
   NAP fields that are non-null.

4. `export async function buildMetaAction(audit: AuditResult, client: Client, gaps: Gap[]): Promise<MetaAction | null>`
   Uses `complete()`. Ask for a rewritten `<title>` (≤60 chars) and `<meta name="description">`
   (≤155 chars) that work for the top gap keywords while staying truthful to what the audit found
   on the page. `before` is the current title+description as an HTML snippet; `after` is the
   rewritten snippet. If `complete()` returns null, fall back to a deterministic rewrite:
   `<title>{primary gap keyword, title-cased} | {name}</title>` plus a description assembled from
   the audit's own meta description and the top gap keywords. Return `null` if `audit.title` is
   null and there is no client name to work with.

5. `export async function buildGapPageAction(gap: Gap, client: Client, audit: AuditResult): Promise<NewPageAction | null>`
   Uses `complete()`. Generate ONE markdown page targeting `gap.keyword`: YAML front matter with
   `title` and `description`, an H1, a direct answer in the first paragraph, 2–4 sections, and a
   short FAQ. `file` is `blog/<slugified keyword>.md`. `targets_keyword` is `gap.keyword`.
   If `complete()` returns null, fall back to a short deterministic stub page with the front
   matter, an H1 and a TODO body — still a valid, shippable file.
   The content must never fabricate specific prices, credentials, addresses or statistics about
   the client. Instruct the model accordingly in the system prompt.

6. `export async function generateActions(input: { client: Client; audit: AuditResult; gaps: Gap[] }): Promise<Action[]>`
   Orchestrate 1–5 and return the actions in this exact order, skipping nulls:
   robots_txt, meta, schema, llms_txt, then the gap page for `gaps[0]` (if any).
   Run the two async builders concurrently. Never throw — on any internal error return whatever
   deterministic actions succeeded.

REQUIREMENTS:
- Add a `slugify` helper (lowercase, non-alphanumerics → `-`, collapse and trim dashes).
- No new dependencies. No file writes — this module returns data only.
- Do not `console.log`; use `console.error` if you must log.

Finally run `node --check src/act/generate.ts`, then `git --no-pager diff` and show it.
