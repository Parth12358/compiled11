Edit ONLY `src/retrieve/engine.ts`. Do not edit any other file.
Do NOT call external APIs and do NOT run a server. You MAY run `node --check src/retrieve/engine.ts`.

THE PROBLEM (verified live against the OpenRouter model list today):
`const OPENROUTER_MODEL = "openai/gpt-5.2:online"` — **this model does not exist.** OpenRouter
currently publishes NO models with an `:online` suffix at all, so every OpenRouter query fails and
the engine silently returns zero citations.

Models that DO exist and natively return citations (confirmed present in the live model list):
`perplexity/sonar`, `perplexity/sonar-pro`, `perplexity/sonar-reasoning-pro`,
`perplexity/sonar-deep-research`.

A live call to `perplexity/sonar` through OpenRouter's `/chat/completions` was verified working
today and returns cited URLs in a **top-level `citations` array** on the response body:
`{ "choices":[...], "citations": ["https://…", "https://…"] }`
It may ALSO populate `choices[0].message.annotations[].url_citation.url` — handle both.

MAKE THESE CHANGES:

1. Change `OPENROUTER_MODEL` to `"perplexity/sonar"`. Keep it a single named constant at the top
   of the file, and add a short comment recording that `:online` suffixed models do not exist on
   OpenRouter and that Sonar returns citations natively.

2. Extend `extractOpenRouterCitations(data)` so it collects URLs from BOTH sources, in this order,
   then deduplicates:
   a. `data.citations` when it is an array of strings (the Sonar shape — this is the one that
      actually fires today);
   b. the existing `data.choices[0].message.annotations[]` walk, accepting either
      `ann.url_citation.url` or `ann.url`.
   Keep the function's existing name, signature and defensive style. It must never throw.

3. Leave `runOpenAI`, the caching wrapper, the 429 retry, the timeout and all other behaviour
   exactly as they are. This is a targeted fix, not a refactor.

CONSTRAINTS:
- Do not add dependencies. Do not change any function signature.
- Do not touch the OpenAI adapter's model constant.

Validate `node --check src/retrieve/engine.ts`, then run `git --no-pager diff` and show it.
