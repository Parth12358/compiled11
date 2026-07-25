// CLI test runner for the retrieval module.
//   npm run retrieve -- https://yoursite.com    → run the full pipeline
//   npm run retrieve -- --models                → list models your key(s) expose
// Loads .env, enables debug logging, prints results as JSON.

import { promises as fs } from "fs";
import path from "path";

async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const val = m[2].replace(/^["']|["']$/g, "");
      if (val && !process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {
    // no .env — rely on shell env
  }
}

async function listModels() {
  const openai = process.env.OPENAI_API_KEY;
  if (openai) {
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${openai}` },
      });
      const data: any = await res.json();
      const ids = (data?.data ?? []).map((m: any) => m.id).sort();
      console.log(`\nOpenAI models (${ids.length}):`);
      console.log(ids.join("\n"));
    } catch (e) {
      console.error("OpenAI model list failed:", e);
    }
  } else {
    console.log("OPENAI_API_KEY not set — skipping OpenAI model list.");
  }

  const deepseek = process.env.DEEPSEEK_API_KEY;
  if (deepseek) {
    try {
      const res = await fetch("https://api.deepseek.com/models", {
        headers: { Authorization: `Bearer ${deepseek}` },
      });
      const data: any = await res.json();
      const ids = (data?.data ?? []).map((m: any) => m.id).sort();
      console.log(`\nDeepSeek models (${ids.length}):`);
      console.log(ids.join("\n"));
    } catch (e) {
      console.error("DeepSeek model list failed:", e);
    }
  } else {
    console.log("DEEPSEEK_API_KEY not set — skipping DeepSeek model list.");
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    const data: any = await res.json();
    const ids = (data?.data ?? [])
      .map((m: any) => m.id)
      .filter((id: string) => /gpt|claude|:online|perplexity|sonar/i.test(id))
      .sort();
    console.log(`\nOpenRouter models matching gpt/claude/online/sonar (${ids.length}):`);
    console.log(ids.join("\n"));
  } catch (e) {
    console.error("OpenRouter model list failed:", e);
  }
}

/** One fresh query per engine — validates model IDs, auth, and web search cheaply. */
async function smoke(query: string) {
  process.env.RETRIEVE_NO_CACHE = "1"; // always hit the real API
  process.env.RETRIEVE_VERBOSE = "0"; // we print our own summary
  const { runOpenAI, runOpenRouter, runDeepSeek, CONCURRENCY, QUERY_TIMEOUT_MS } = await import(
    "../src/retrieve/engine"
  );

  const engines: Array<[string, boolean, (qs: string[]) => Promise<any[]>]> = [
    ["openai", !!process.env.OPENAI_API_KEY, runOpenAI],
    ["openrouter", !!process.env.OPENROUTER_API_KEY, runOpenRouter],
    ["deepseek", !!process.env.DEEPSEEK_API_KEY, runDeepSeek],
  ];

  console.error(`smoke query: "${query}"\n`);
  for (const [name, hasKey, fn] of engines) {
    if (!hasKey) {
      console.log(`${name.padEnd(11)} SKIP (no key)`);
      continue;
    }
    const t = Date.now();
    try {
      const res = await fn([query]);
      const urls: string[] = res[0]?.urls ?? [];
      const secs = ((Date.now() - t) / 1000).toFixed(1);
      console.log(`${name.padEnd(11)} ${urls.length ? "OK  " : "EMPTY"} ${urls.length} urls  ${secs}s`);
      if (process.env.RETRIEVE_DEBUG) {
        console.log(`             → concurrency=${CONCURRENCY}, timeout=${QUERY_TIMEOUT_MS}ms`);
      }
      urls.slice(0, 5).forEach((u) => console.log(`             ${u}`));
    } catch (e: any) {
      console.log(`${name.padEnd(11)} ERROR  ${e?.status ?? ""} ${e?.message ?? e}`);
    }
  }
}

async function main() {
  await loadEnv();

  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: npm run retrieve -- <url> | --models | --smoke [query]");
    process.exit(1);
  }
  if (arg === "--models") {
    await listModels();
    return;
  }
  if (arg === "--smoke") {
    await smoke(process.argv[3] || "best car detailing app");
    return;
  }

  process.env.RETRIEVE_VERBOSE = process.env.RETRIEVE_VERBOSE ?? "1";
  process.env.RETRIEVE_DEBUG = process.env.RETRIEVE_DEBUG ?? "1";

  console.error(
    `keys: OPENAI=${process.env.OPENAI_API_KEY ? "set" : "MISSING"} ` +
      `OPENROUTER=${process.env.OPENROUTER_API_KEY ? "set" : "MISSING"} ` +
      `DEEPSEEK=${process.env.DEEPSEEK_API_KEY ? "set" : "MISSING"}`
  );

  const { retrieve } = await import("../src/retrieve/index");
  const t0 = Date.now();
  const out = await retrieve(arg);
  console.error(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
