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

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      if (
        key === "repo" ||
        key === "queries"
      ) {
        flags[key] = argv[++i] ?? "";
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(argv[i]);
    }
  }
  return { positional, flags };
}

async function main() {
  await loadEnv();

  const { positional, flags } = parseArgs(process.argv);
  const url = positional[0];

  if (!url) {
    console.error(
      "usage: npm run act -- <site-url> [--repo owner/name] [--fixture] [--live-call] [--live-pr] [--live-indexnow] [--live-all] [--queries <path.json>]",
    );
    process.exit(1);
  }

  const hostname = new URL(url).hostname;
  const clientName = hostname
    .replace(/^www\./, "")
    .replace(/\.[^.]+$/, "");
  const clientRepo =
    typeof flags.repo === "string" ? flags.repo : "";

  let queries: unknown[] = [];
  let sources: unknown[] = [];

  if (typeof flags.queries === "string") {
    try {
      const raw = await fs.readFile(flags.queries, "utf8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        queries = data;
        sources = [];
      } else {
        queries = data.queries ?? [];
        sources = data.sources ?? [];
      }
      console.error(`queries: loaded from ${flags.queries}`);
    } catch (err) {
      console.error("failed to read queries file:", err);
      process.exit(1);
    }
  } else {
    try {
      const fixtureRaw = await fs.readFile(
        path.join(process.cwd(), "fixture.json"),
        "utf8",
      );
      const fixture = JSON.parse(fixtureRaw);
      queries = fixture.queries ?? [];
      sources = fixture.sources ?? [];
      console.error("queries: loaded from fixture.json");
    } catch {
      console.error("queries: fixture.json not found (ran without --queries)");
    }
  }

  const liveCall = flags["live-call"] === true || flags["live-all"] === true;
  const livePr = flags["live-pr"] === true || flags["live-all"] === true;
  const liveIndexnow =
    flags["live-indexnow"] === true || flags["live-all"] === true;

  console.error(
    `keys: VOYGR_API_KEY=${process.env.VOYGR_API_KEY ? "set" : "MISSING"} ` +
      `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY ? "set" : "MISSING"} ` +
      `OPENROUTER_API_KEY=${process.env.OPENROUTER_API_KEY ? "set" : "MISSING"} ` +
      `GITHUB_TOKEN=${process.env.GITHUB_TOKEN ? "set" : "MISSING"} ` +
      `INDEXNOW_KEY=${process.env.INDEXNOW_KEY ? "set" : "MISSING"}`,
  );

  if (liveCall || livePr || liveIndexnow) {
    const parts: string[] = [];
    if (liveCall) parts.push("real outbound phone calls");
    if (livePr) parts.push("a real GitHub PR");
    if (liveIndexnow) parts.push("a real IndexNow submission");
    console.error(
      `\n[LIVE MODE] This run will make: ${parts.join(", ")}.`,
    );
    console.error("Waiting 5 seconds — Ctrl-C to abort...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const { act } = await import("../src/act/index");

  const t0 = Date.now();
  const out = await act({
    client: { url, repo: clientRepo, name: clientName },
    queries: queries as any,
    sources: sources as any,
    fixture: flags.fixture === true ? true : undefined,
    live: {
      call: liveCall,
      pr: livePr,
      indexnow: liveIndexnow,
    },
  });

  console.error(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
