Create and edit ONLY `src/act/pr.ts`. Do not edit any other file.
Do NOT call external APIs and do NOT run a server. You MAY run `node --check src/act/pr.ts`.

PURPOSE: take the generated actions and ship them — open a pull request against the client's repo
with the file changes, and ping IndexNow so the new URLs get discovered.

CONTEXT (study read-only, do not edit):
- `src/contract.ts` is FROZEN. Import:
  `import type { Action, Client } from "../contract";`
  Note `Action` is a discriminated union on `type`. The file-bearing variants are `meta`,
  `schema`, `robots_txt`, `llms_txt`, `new_page` — each has a `file` and an `after`.
  The `backlink_call` variant has NO `file` and must be filtered out before any commit logic.
- `@octokit/rest` is already a dependency: `import { Octokit } from "@octokit/rest";`
- `src/act/audit.ts` is the house style for defensive, never-throwing async code. Mirror it.

IMPLEMENT these exports:

1. `export function actionsToFiles(actions: Action[]): { path: string; content: string }[]`
   Pure. Filter to the five file-bearing action types (use a `type` guard — never assume `file`
   exists on the union). Map each to `{ path: action.file, content: action.after }`.
   If two actions target the same `path`, keep the LAST one and log to `console.error`.
   `meta` and `schema` both target an existing HTML file and cannot be blindly overwritten — for
   those two types, SKIP them here and add a comment explaining that they are rendered as a diff
   in the UI rather than committed, because we do not have the file's full original contents.
   So in practice this returns the `robots_txt`, `llms_txt` and `new_page` files.

2. `export async function openPR(input: { client: Client; actions: Action[]; live?: boolean }):
     Promise<string | null>`
   Returns the PR URL, or `null` when it did not open one. Rules:
   - **`input.live !== true` is the DEFAULT and means DRY RUN** — return `null` immediately without
     touching the network. Log what it would have done. Do not invert this.
   - Return `null` if `process.env.GITHUB_TOKEN` is unset, or if `client.repo` is empty or does not
     match `owner/name` (validate with a regex).
   - Otherwise, with Octokit, in this order:
     a. `repos.get` to read the repo's `default_branch`.
     b. `git.getRef` for `heads/<default_branch>` to get the base SHA.
     c. `git.createRef` a new branch `cited/aeo-fixes-<short timestamp>`. Derive the timestamp from
        `Date.now()`; do not add a date library.
     d. For each file from `actionsToFiles`, `repos.createOrUpdateFileContents` on the new branch,
        base64-encoding the content. If the file already exists, fetch its `sha` first via
        `repos.getContent` and pass it — otherwise the update 422s. Wrap each file in try/catch so
        one failure does not abort the rest.
     e. `pulls.create` with a title like `CITED: AI answer-engine fixes` and a body that lists each
        action's `file` and its `rationale` as markdown bullets.
   - Return `data.html_url`. On ANY error, log to `console.error` and return `null`.
   - **This function must never throw.** A failed PR degrades to "render the diff in the UI".

3. `export async function pingIndexNow(input: { client: Client; actions: Action[]; live?: boolean }):
     Promise<string | null>`
   Returns an ISO timestamp string when a ping was accepted, else `null`.
   - `input.live !== true` → return `null` without touching the network (dry-run default).
   - Return `null` if `process.env.INDEXNOW_KEY` is unset.
   - Build the URL list: `new URL(action.file, client.url).href` for each `new_page` action, plus
     `client.url` itself. Deduplicate.
   - `POST https://api.indexnow.org/indexnow` with JSON body
     `{ host, key, keyLocation: "https://<host>/<key>.txt", urlList }` where `host` is the
     hostname of `client.url`. 10s AbortController timeout.
   - Treat HTTP 200 and 202 as success → return `new Date().toISOString()`. Anything else → `null`.
   - Never throw.

REQUIREMENTS:
- No new dependencies.
- Do not `console.log` — use `console.error`.
- Do not write to the local filesystem and do not run any `git` commands.

Finally run `node --check src/act/pr.ts`, then `git --no-pager diff` and show it.
