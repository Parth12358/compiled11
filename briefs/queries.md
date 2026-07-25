Edit ONLY `src/retrieve/index.ts` and `src/retrieve/aggregate.ts` and `src/retrieve/types.ts`.
Do NOT edit any other file. Do NOT call external APIs and do NOT run a server.
You MAY run `node --check` on each file you edit.

THE PROBLEM (a real contract break blocking the whole app):
`CONTRACT.md` and `src/contract.ts` both declare that retrieval must emit a `queries: QueryResult[]`
array, and the entire Part B pipeline (`src/act/*`) derives its gaps and outreach targets from it.
But `retrieve()` currently returns only `{ score, sources }`. Nobody can run the app end to end
without hand-building the queries file. Fix that.

The required shape (already declared in `src/contract.ts` — do NOT redefine or edit that file):
```ts
interface QueryResult {
  query: string;           // the query that was run
  cited_urls: string[];    // every URL cited for this query, deduplicated
  cited_domains: string[]; // registrable domains of cited_urls, deduplicated
  client_cited: boolean;   // did the client's own domain appear?
  citation_count: number;  // cited_urls.length
}
```

CONTEXT (study read-only, do not edit): `src/contract.ts`, `src/act/gaps.ts` (the consumer —
it reads `citation_count`, `client_cited`, `cited_domains`).

IMPLEMENT:

1. In `src/retrieve/types.ts`: add `queries: QueryResult[]` to the `RetrieveOutput` interface.
   Import the `QueryResult` type from `../contract` rather than redeclaring it, so the two
   definitions can never drift.

2. In `src/retrieve/aggregate.ts`: the `aggregate(results, clientDomain)` function already merges
   `EngineResult[]` per query to compute `score` and `sources`. Extend it to ALSO build the
   `queries` array from the same merged per-query data it already has — do not re-derive it from
   scratch and do not change how `score` or `sources` are computed.
   - Merge every engine's URLs for the same query text into one `QueryResult`.
   - `cited_urls`: deduplicated, order preserved.
   - `cited_domains`: apply the module's EXISTING `extractDomain` helper to each URL, drop nulls,
     deduplicate. Reuse that helper — do not write a second domain parser.
   - `client_cited`: true when `clientDomain` appears in `cited_domains`.
   - `citation_count`: `cited_urls.length`.
   - Return `{ score, sources, queries }`.

3. In `src/retrieve/index.ts`: add `queries: []` to the `EMPTY` constant so the no-keys path still
   satisfies the type, and make sure the value returned by `aggregate` flows through unchanged.

CONSTRAINTS:
- Do not change the existing `score` or `sources` values for any input — this is purely additive.
  Existing behaviour must be byte-identical.
- Do not add dependencies. Do not edit `src/contract.ts`.
- Never throw.

Validate `node --check` on all three files, then run `git --no-pager diff` and show it.
