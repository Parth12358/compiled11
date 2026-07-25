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

async function main() {
  await loadEnv();
  process.env.RETRIEVE_DEBUG = process.env.RETRIEVE_DEBUG ?? "1";

  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: npm run retrieve -- <url> | --models");
    process.exit(1);
  }
  if (arg === "--models") {
    await listModels();
    return;
  }

  console.error(
    `keys: OPENAI=${process.env.OPENAI_API_KEY ? "set" : "MISSING"} ` +
      `OPENROUTER=${process.env.OPENROUTER_API_KEY ? "set" : "MISSING"}`
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
