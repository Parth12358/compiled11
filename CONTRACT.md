# CITED — data contract

One object flows through the whole app. Source of truth: [`src/contract.ts`](src/contract.ts).

```
client   { url, repo, name }              input form
score    { visibility, cited_queries, total_queries }   ← A (retrieve)
sources  [{ domain, citation_count, client_present }]   ← A (retrieve)
queries  [ QueryResult ]                                ← A (retrieve)   ← NEW
gaps     [ Gap ]                                        ← B (act)
actions  [ Action ]                                     ← B (act)
pr_url                    string | null                ← B (act)
indexnow_submitted_at     string | null                ← B (act)
```

## For A — the `queries[]` shape B consumes

B derives `gaps` and prioritizes backlink outreach from **per-query** citation data, not just the
domain-aggregated `sources[]`. Each query A runs becomes one `QueryResult`:

```ts
interface QueryResult {
  query: string;          // the category query you ran
  cited_urls: string[];   // every URL the engine cited for this query
  cited_domains: string[];// domains of cited_urls (convenience; B can also derive)
  client_cited: boolean;  // did the client's own domain appear in this query's citations?
  citation_count: number; // total citations captured for this query
}
```

A gap = a query with `citation_count > 0`, `client_cited === false`, and no client page already
targeting it. `citations` on a `Gap` carries `citation_count` so C can rank.

## For C — the `actions[]` union

`actions` is a discriminated union on `type`; render each differently:

| `type` | shape | render as |
|---|---|---|
| `meta` | `file, before, after` | before/after diff |
| `schema` | `file, before, after` | before/after diff (JSON-LD) |
| `robots_txt` | `file, before, after` | before/after diff |
| `llms_txt` | `file, after` | new-file preview |
| `new_page` | `file, after, targets_keyword` | new-file / page preview |
| `backlink_call` | `target, brief, status, outcome, outcome_summary, transcript, recording_url` | call card |

`backlink_call` needs a **human-approval gate**: C shows targets at `status: "pending_approval"`;
B only dials after approval.
