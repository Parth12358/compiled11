// Generate metadata rewrites, new pages, and config fixes using DeepSeek.
// Consumes Gap[] + AuditResult, produces Action[] for pr.ts to commit.
//
// DeepSeek is routed through the OpenAI SDK (OpenAI-compatible API at
// api.deepseek.com). The model has no built-in web search — we prompt it
// directly with the audit context and gap keywords.

import OpenAI from "openai";
import type {
  Action,
  AuditResult,
  Gap,
  LlmsTxtAction,
  MetaAction,
  NewPageAction,
  RobotsTxtAction,
} from "../contract";

const DEEPSEEK_MODEL = "deepseek-v4-pro";
const DEEPSEEK_BASE = "https://api.deepseek.com";
const TIMEOUT_MS = 60_000;

let _client: OpenAI | null | undefined;
function client(): OpenAI | null {
  if (_client !== undefined) return _client;
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) { _client = null; return null; }
  _client = new OpenAI({ apiKey: key as string, baseURL: DEEPSEEK_BASE });
  return _client;
}

async function ask(system: string, user: string): Promise<string | null> {
  const c = client();
  if (!c) return null;
  try {
    const res = await c.chat.completions.create(
      {
        model: DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      { timeout: TIMEOUT_MS }
    );
    return (res as any).choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

function defang(str: string | null | undefined): string {
  return (str ?? "").trim() || "(none)";
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

async function generateMeta(audit: AuditResult, gaps: Gap[]): Promise<MetaAction | null> {
  if (!gaps.length) return null;

  const system = `You are an SEO metadata expert. Given a site's current title and description, plus keyword gaps where the site is invisible to AI answer engines, produce a rewritten <title> and <meta name="description"> that targets the most important gap keyword naturally. Return ONLY a JSON object with "title" and "description" keys. No markdown, no explanation.`;

  const top = gaps.slice(0, 3).map((g) => g.keyword).join(", ");
  const user = [
    `Current title: ${defang(audit.title)}`,
    `Current description: ${defang(audit.meta_description)}`,
    `Top gap keywords to target (pick the best fit, blend 1-2 naturally): ${top}`,
    `Business name: ${defang(audit.nap.name)}`,
    `Return: {"title": "...", "description": "..."}`,
  ].join("\n");

  const raw = await ask(system, user);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    const title = String(obj.title ?? "").trim();
    const desc = String(obj.description ?? "").trim();
    if (!title && !desc) return null;
    return {
      type: "meta",
      file: "index.html",
      before: `title: ${defang(audit.title)}\ndescription: ${defang(audit.meta_description)}`,
      after: `title: ${title}\ndescription: ${desc}`,
      rationale: `Targets gap keywords: ${top}`,
    };
  } catch {
    return null;
  }
}

async function generatePage(gap: Gap, audit: AuditResult): Promise<NewPageAction | null> {
  const system = `You are a content writer. Write a complete landing page in Markdown that ranks well in AI answer engines for a specific keyword. 
Include:
- An SEO-optimized h1
- A compelling intro paragraph
- 3-5 sections with subheadings (h2)
- One comparison table (markdown table) comparing the client against the competing domains
- A concluding call-to-action

Return ONLY the Markdown. No preamble, no "here is your content".`;

  const user = [
    `Target keyword: "${gap.keyword}"`,
    `Business name: ${defang(audit.nap.name)}`,
    `Site title: ${defang(audit.title)}`,
    `Category: ${defang(audit.category_hint)}`,
    `Competing domains this keyword is associated with: ${(gap.competing_domains ?? []).join(", ") || "various sources"}`,
    `Goal: Write a page that makes ${defang(audit.nap.name)} the clear answer for "${gap.keyword}". Be factual and compelling.`,
  ].join("\n");

  const raw = await ask(system, user);
  if (!raw) return null;

  const slug = gap.keyword
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return {
    type: "new_page",
    file: `content/${slug}.md`,
    after: raw,
    targets_keyword: gap.keyword,
    rationale: `Generated page targeting top gap keyword "${gap.keyword}" (${gap.citations} citations, ${gap.type}).`,
  };
}

async function generateLlmsTxt(
  audit: AuditResult,
  gaps: Gap[]
): Promise<LlmsTxtAction | null> {
  const system = `You generate llms.txt files — a standard for telling LLMs which pages on a site are important. The format:
# Site name
> Brief description

## Pages
- page-url: description
- page-url: description

Only include pages that exist (inferred from the sitemap or brand). Return ONLY the llms.txt content. No markdown wrapper.`;

  const pages = audit.pages.slice(0, 10);
  const user = [
    `Site: ${audit.url}`,
    `Title: ${defang(audit.title)}`,
    `Description: ${defang(audit.meta_description)}`,
    `Category: ${defang(audit.category_hint)}`,
    `Keyword gaps the site needs to address: ${gaps.slice(0, 5).map((g) => g.keyword).join(", ")}`,
    `Known pages in sitemap:`,
    ...pages.map((p, i) => `  ${i + 1}. ${p.url}`),
    `Generate an llms.txt that helps LLMs understand this site's content and surface it for relevant queries.`,
  ].join("\n");

  const raw = await ask(system, user);
  if (!raw) return null;

  return {
    type: "llms_txt",
    file: "llms.txt",
    after: raw,
    rationale: "Site had no llms.txt — generated to improve AI answer engine discoverability.",
  };
}

async function generateRobotsFix(audit: AuditResult): Promise<RobotsTxtAction | null> {
  if (!audit.robots_txt) {
    const after = [
      "User-agent: *",
      "Allow: /",
      "",
      "User-agent: GPTBot",
      "Allow: /",
      "",
      "User-agent: OAI-SearchBot",
      "Allow: /",
      "",
      "User-agent: PerplexityBot",
      "Allow: /",
      "",
      "User-agent: ClaudeBot",
      "Allow: /",
    ].join("\n");

    return {
      type: "robots_txt",
      file: "robots.txt",
      before: "(no robots.txt found)",
      after,
      rationale: "No robots.txt detected — generated one that allows all AI crawlers.",
    };
  }

  const system = `You fix robots.txt files to allow AI crawlers. Given the current robots.txt, produce a fixed version that adds Allow: / directives for these blocked crawlers: GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended, Claude-SearchBot. Preserve all existing rules. Return ONLY the fixed robots.txt. No markdown, no explanation.`;

  const blocked = ["GPTBot", "OAI-SearchBot", "PerplexityBot", "ClaudeBot", "Google-Extended", "Claude-SearchBot"]
    .filter((b) => !audit.ai_crawlers_allowed.includes(b));

  if (!blocked.length) return null;

  const after = await ask(system, `Current robots.txt:\n${audit.robots_txt}\n\nBlocked crawlers to allow: ${blocked.join(", ")}`);

  if (!after) return null;

  return {
    type: "robots_txt",
    file: "robots.txt",
    before: audit.robots_txt,
    after,
    rationale: `AI crawlers currently blocked: ${blocked.join(", ")}. Generated fix to allow them.`,
  };
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export async function generateActions(
  gaps: Gap[],
  audit: AuditResult
): Promise<Action[]> {
  const c = client();
  if (!c) return [];

  const tasks: Promise<Action | null>[] = [
    generateMeta(audit, gaps),
    gaps.length > 0 ? generatePage(gaps[0], audit) : Promise.resolve(null),
    !audit.has_llms_txt ? generateLlmsTxt(audit, gaps) : Promise.resolve(null),
    audit.ai_crawlers_allowed.length < 3 ? generateRobotsFix(audit) : Promise.resolve(null),
  ];

  const results = await Promise.allSettled(tasks);
  const actions: Action[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) actions.push(r.value);
  }
  return actions;
}
