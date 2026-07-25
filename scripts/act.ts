// CLI runner for the act module.
//   npm run act -- https://yoursite.com    → retrieve → audit → gaps → generate → report
//
// Outputs:
//   1. Keyword gaps (list of terms the site should target)
//   2. Updated metadata (title + description) — saved to ./cited-metadata.txt
//   3. Optional: llms.txt and robots.txt if generated

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
    // no .env
  }
}

async function main() {
  await loadEnv();

  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: npm run act -- <url>");
    console.error("  url  client site URL");
    process.exit(1);
  }

  process.env.RETRIEVE_VERBOSE = "0";
  process.env.RETRIEVE_DEBUG = "0";

  console.error(`\n≡ CITED — AI visibility report for ${arg}\n`);

  const t0 = Date.now();

  // ── Retrieve ──────────────────────────────────────────────
  console.error("▸ Step 1: Retrieving citations from AI engines...");
  const { retrieve } = await import("../src/retrieve/index");
  const { score, sources, queries } = await retrieve(arg);

  console.error(`  Visibility: ${(score.visibility * 100).toFixed(1)}% (${score.cited_queries}/${score.total_queries} queries cite the client)`);
  if (sources.length) {
    console.error(`  Domains owning this category:`);
    for (const s of sources.slice(0, 8)) {
      console.error(`    ${s.client_present ? "✓" : " "} ${s.domain.padEnd(30)} ${s.citation_count} citations`);
    }
  }

  // ── Act ───────────────────────────────────────────────────
  console.error("\n▸ Step 2: Auditing site + finding keyword gaps...");
  const { act } = await import("../src/act/index");
  const host = new URL(arg.includes("://") ? arg : `https://${arg}`).hostname;
  const output = await act({
    client: { url: arg, repo: "", name: host },
    queries,
    sources,
    live: { generate: !!process.env.DEEPSEEK_API_KEY },
  });

  // ── Report ────────────────────────────────────────────────
  console.error(`\n▸ Step 3: Report\n`);

  // Keyword gaps
  if (output.gaps.length) {
    console.error("═══ KEYWORD GAPS (add these to your content) ═══\n");
    for (const g of output.gaps) {
      console.error(`  • "${g.keyword}"`);
      console.error(`    Type: ${g.type}  |  Citations: ${g.citations}`);
      if (g.competing_domains?.length) {
        console.error(`    Competing: ${g.competing_domains.join(", ")}`);
      }
      console.error("");
    }
  } else {
    console.error("  No keyword gaps found — the site appears to already target all relevant terms.\n");
  }

  // Metadata update
  const metaAction = output.actions.find((a) => a.type === "meta") as any;
  if (metaAction) {
    console.error("═══ UPDATED METADATA (saved to cited-metadata.txt) ═══\n");
    const metadata = [
      `# CITED — Recommended metadata update for ${arg}`,
      `# Generated: ${new Date().toISOString()}`,
      ``,
      `# BEFORE`,
      `${metaAction.before}`,
      ``,
      `# AFTER`,
      `${metaAction.after}`,
    ].join("\n");

    console.error(metadata);
    console.error("");

    await fs.writeFile(path.join(process.cwd(), "cited-metadata.txt"), metadata + "\n");
    console.error("  Saved to ./cited-metadata.txt\n");
  }

  // Other actions — save each to disk
  for (const a of output.actions) {
    if (a.type === "meta") continue;

    let filename = "";
    const content = (a as any).after ?? "";
    if (!content) continue;

    if (a.type === "robots_txt") {
      filename = "cited-robots.txt";
    } else if (a.type === "llms_txt") {
      filename = "cited-llms.txt";
    } else if (a.type === "new_page") {
      filename = `cited-${(a as any).file?.split("/").pop() ?? "page.md"}`;
    } else {
      filename = `cited-${a.type}.txt`;
    }

    if (filename && content) {
      await fs.writeFile(path.join(process.cwd(), filename), content + "\n");
      console.error(`  Saved to ./${filename}`);
    }
  }

  if (output.actions.filter((a) => a.type !== "meta").length) {
    console.error("");
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.error(`Done in ${elapsed}s\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
