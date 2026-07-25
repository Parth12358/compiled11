import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type {
  Action,
  MetaAction,
  SchemaAction,
  RobotsTxtAction,
  LlmsTxtAction,
  NewPageAction,
  AuditResult,
  Gap,
  Client,
} from "../contract";

const AI_CRAWLER_NAMES = [
  "GPTBot",
  "OAI-SearchBot",
  "PerplexityBot",
  "ClaudeBot",
  "Claude-SearchBot",
  "Google-Extended",
] as const;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function titleCase(text: string): string {
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
}

async function complete(system: string, user: string): Promise<string | null> {
  const timeoutMs = 30_000;

  async function doComplete(): Promise<string | null> {
    if (process.env.ANTHROPIC_API_KEY) {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const resp = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content: user }],
      });
      const textBlock = resp.content.find(
        (b): b is { type: "text"; text: string } => b.type === "text"
      );
      return textBlock?.text ?? null;
    }

    if (process.env.OPENROUTER_API_KEY) {
      const client = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
      });
      const resp = await client.chat.completions.create({
        model: "anthropic/claude-sonnet-5",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      return resp.choices[0]?.message?.content ?? null;
    }

    return null;
  }

  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    return await Promise.race([doComplete(), timeout]);
  } catch {
    return null;
  }
}

export function buildRobotsAction(audit: AuditResult): RobotsTxtAction | null {
  if (!audit.robots_txt) return null;

  const existing = new Set(audit.ai_crawlers_allowed);
  const missing = (AI_CRAWLER_NAMES as readonly string[]).filter((b) => !existing.has(b));
  if (missing.length === 0) return null;

  let after = audit.robots_txt.trimEnd() + "\n";
  for (const bot of missing) {
    after += `\nUser-agent: ${bot}\nAllow: /\n`;
  }

  const hasSitemap = /^Sitemap:\s*./im.test(audit.robots_txt);
  if (!hasSitemap) {
    const origin = (() => {
      try {
        return new URL(audit.url).origin;
      } catch {
        return null;
      }
    })();
    if (origin) {
      after += `\nSitemap: ${origin}/sitemap.xml\n`;
    }
  }

  return {
    type: "robots_txt",
    file: "robots.txt",
    before: audit.robots_txt,
    after: after.trimEnd() + "\n",
    rationale:
      missing.length === (AI_CRAWLER_NAMES as readonly string[]).length
        ? "The site was blocking every AI search crawler. Nothing else in this report can work until this is fixed."
        : `${missing.length} of ${AI_CRAWLER_NAMES.length} AI search crawler(s) are not explicitly allowed. Answer engines that power AI search cannot index the site without these stanzas.`,
  };
}

function hasOrganizationJsonLd(jsonLd: unknown[]): boolean {
  for (const ld of jsonLd) {
    if (typeof ld !== "object" || ld === null) continue;
    const obj = ld as Record<string, unknown>;
    const types = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]];
    if (
      types.some(
        (t) =>
          typeof t === "string" &&
          (t === "Organization" ||
            t === "LocalBusiness" ||
            t.endsWith("Business") ||
            t.endsWith("Organization"))
      )
    ) {
      return true;
    }
  }
  return false;
}

export function buildSchemaAction(audit: AuditResult, client: Client): SchemaAction | null {
  if (hasOrganizationJsonLd(audit.json_ld)) return null;

  const schemaType = audit.category_hint || "LocalBusiness";

  const schemaObj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: audit.nap.name ?? client.name,
    url: client.url,
  };

  if (audit.nap.phone) {
    schemaObj.telephone = audit.nap.phone;
  }

  const hasAddress =
    audit.nap.city || audit.nap.state || audit.nap.has_street;
  if (hasAddress) {
    const addr: Record<string, unknown> = {
      "@type": "PostalAddress",
    };
    if (audit.nap.city) addr.addressLocality = audit.nap.city;
    if (audit.nap.state) addr.addressRegion = audit.nap.state;
    schemaObj.address = addr;
  }

  const after =
    "<script type=\"application/ld+json\">\n" +
    JSON.stringify(schemaObj, null, 2) +
    "\n</script>";

  const kind = client.name ? `for ${client.name}` : "for this business";
  return {
    type: "schema",
    file: "index.html",
    before: "",
    after,
    rationale: `No Organization or LocalBusiness structured data was found ${kind}. JSON-LD gives search engines an unambiguous canonical name, URL${audit.nap.phone ? ", phone" : ""}${audit.nap.city ? ", and location" : ""} to surface in knowledge panels and local packs.`,
  };
}

export function buildLlmsTxtAction(
  audit: AuditResult,
  client: Client,
  gaps: Gap[]
): LlmsTxtAction | null {
  if (audit.has_llms_txt) return null;

  const name = client.name || audit.url;
  const summary = audit.meta_description || audit.title || `Website for ${name}`;

  let after = `# ${name}\n\n> ${summary}\n`;

  const pageList =
    audit.pages.length > 0
      ? audit.pages.slice(0, 10)
      : [{ url: client.url, title: "Home" }];
  after += "\n## Pages\n";
  for (const p of pageList) {
    const label = p.title || p.url;
    after += `- [${label}](${p.url})\n`;
  }

  after += "\n## Practical\n";
  let practicalLines = 0;
  if (audit.nap.name) {
    after += `- Name: ${audit.nap.name}\n`;
    practicalLines++;
  }
  if (audit.nap.phone) {
    after += `- Phone: ${audit.nap.phone}\n`;
    practicalLines++;
  }
  if (audit.nap.city || audit.nap.state) {
    const parts = [audit.nap.city, audit.nap.state].filter(Boolean);
    after += `- Location: ${parts.join(", ")}\n`;
    practicalLines++;
  }
  if (practicalLines === 0) {
    after += `- Website: ${client.url}\n`;
  }

  const gapKeywords = gaps.slice(0, 3).map((g) => g.keyword).join("; ");
  return {
    type: "llms_txt",
    file: "llms.txt",
    after,
    rationale: gapKeywords
      ? `Answer engines currently infer details about ${name} from third-party pages. An llms.txt gives them one authoritative summary to draw from for queries like "${gapKeywords}".`
      : `Answer engines currently infer details about ${name} from third-party pages. An llms.txt gives them one authoritative summary to draw from.`,
  };
}

const META_SYSTEM_PROMPT = `You are an SEO meta-tag rewriter. Given a website audit and its top content gaps, produce a rewritten <title> and <meta name="description"> that help the site rank for the gap keywords while staying truthful to what the audit found on the page.

Rules:
- Title must be <= 60 characters.
- Description must be <= 155 characters.
- Do NOT invent phone numbers, street addresses, business names, products, services, credentials, certifications, awards, pricing, or statistics that are not present in the audit data provided to you.
- Only use information verifiably present in the audit.

Return ONLY a JSON object with keys "title", "description", and "rationale". No other text.`;

export async function buildMetaAction(
  audit: AuditResult,
  client: Client,
  gaps: Gap[]
): Promise<MetaAction | null> {
  const currentTitle = audit.title || client.name;
  const currentDesc = audit.meta_description || "";
  const beforeHtml = `<title>${currentTitle}</title>${currentDesc ? `\n<meta name="description" content="${currentDesc}">` : ""}`;

  const gapKeywords = gaps.map((g) => g.keyword).join(", ");
  const napLines = [
    audit.nap.phone ? `phone=${audit.nap.phone}` : null,
    audit.nap.city ? `city=${audit.nap.city}` : null,
    audit.nap.state ? `state=${audit.nap.state}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const userPrompt = `Audit data:
url: ${audit.url}
title: ${currentTitle}
meta_description: ${currentDesc || "(none)"}
category_hint: ${audit.category_hint || "(unknown)"}
nap: ${napLines || "(none)"}
pages_count: ${audit.pages.length}
gap_keywords: ${gapKeywords || "(none)"}`;

  const llmResult = await complete(META_SYSTEM_PROMPT, userPrompt);

  if (llmResult) {
    try {
      const trimmed = llmResult.trim();
      const parsed = JSON.parse(trimmed);
      if (typeof parsed.title === "string" && typeof parsed.description === "string") {
        const title = String(parsed.title).slice(0, 60);
        const desc = String(parsed.description).slice(0, 155);
        const rationale =
          typeof parsed.rationale === "string"
            ? parsed.rationale
            : "Original title lacked keyword and location signals.";

        return {
          type: "meta",
          file: "index.html",
          before: beforeHtml,
          after: `<title>${title}</title>\n<meta name="description" content="${desc}">`,
          rationale,
        };
      }
    } catch {
      console.error("Failed to parse LLM meta response, falling back to deterministic");
    }
  }

  if (!audit.title && !client.name) return null;

  const primaryGap = gaps[0]?.keyword;
  const detTitle = primaryGap
    ? `${titleCase(primaryGap)} | ${client.name || audit.title}`
    : `${client.name || audit.title} | ${audit.category_hint || ""}`;

  const descParts: string[] = [];
  if (audit.meta_description) descParts.push(audit.meta_description);
  if (primaryGap) descParts.push(primaryGap);
  if (audit.nap.city) descParts.push(audit.nap.city);
  const detDesc = descParts.join(". ") || client.name || "";

  return {
    type: "meta",
    file: "index.html",
    before: beforeHtml,
    after: `<title>${detTitle}</title>\n<meta name="description" content="${detDesc}">`,
    rationale: `Enriched the title with the primary gap keyword${audit.nap.city ? ` and location (${audit.nap.city})` : ""} so answer engines can match local-intent queries.`,
  };
}

const PAGE_SYSTEM_PROMPT = `You are a content writer for a business website. Generate a single markdown page optimized for one keyword. Follow the rules below exactly.

RULES:
1. Start with YAML front matter:
---
title: "<compelling page title>"
description: "<meta description, <=155 chars>"
---
2. Then an H1 heading.
3. The first paragraph must give a direct, helpful answer to what the keyword asks. Be factual and useful.
4. Write 2–4 content sections with ## headings.
5. End with a short FAQ of 3–4 questions and answers.
6. NEVER fabricate specific prices, credentials, certifications, awards, years in business, staff counts, exact street addresses, phone numbers, or statistics about the client that are not provided. If you must mention something, use qualifiers like "typically" or "in most cases" based on general knowledge of the industry — NOT specific claims about this business.
7. The tone should be helpful, clear, and professional. Write for humans but optimize for the keyword.
8. Return ONLY a JSON object with keys "content" (the full markdown) and "rationale" (one sentence explaining the strategic choice). No other text.`;

export async function buildGapPageAction(
  gap: Gap,
  client: Client,
  audit: AuditResult
): Promise<NewPageAction | null> {
  const slug = slugify(gap.keyword).slice(0, 80) || "untitled";
  const file = `blog/${slug}.md`;

  const napLines = [
    audit.nap.name ? `name=${audit.nap.name}` : null,
    audit.nap.phone ? `phone=${audit.nap.phone}` : null,
    audit.nap.city ? `city=${audit.nap.city}` : null,
    audit.nap.state ? `state=${audit.nap.state}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const userPrompt = `Business:
name: ${client.name}
url: ${client.url}
category_hint: ${audit.category_hint || "(unknown)"}
nap: ${napLines || "(none)"}
existing_meta_description: ${audit.meta_description || "(none)"}

Keyword to target: "${gap.keyword}"
Type: ${gap.type}
Citations: ${gap.citations}
Competing domains: ${(gap.competing_domains || []).join(", ") || "(none)"

Generate a markdown page targeting this keyword.`;

  const llmResult = await complete(PAGE_SYSTEM_PROMPT, userPrompt);

  if (llmResult) {
    try {
      const trimmed = llmResult.trim();
      const parsed = JSON.parse(trimmed);
      if (typeof parsed.content === "string") {
        return {
          type: "new_page",
          file,
          after: parsed.content,
          targets_keyword: gap.keyword,
          rationale:
            typeof parsed.rationale === "string"
              ? parsed.rationale
              : `Targets gap keyword "${gap.keyword}" with ${gap.citations} citations${gap.competing_domains?.length ? ` to ${gap.competing_domains.length} competing domains` : ""}.`,
        };
      }
    } catch {
      console.error("Failed to parse LLM gap page response, falling back to deterministic");
    }
  }

  const fallbackContent = `---
title: "${titleCase(gap.keyword)}"
description: "Information about ${gap.keyword} from ${client.name}.${audit.meta_description ? ` ${audit.meta_description}` : ""}"
---

# ${titleCase(gap.keyword)}

TODO: A page targeting the keyword "${gap.keyword}". This stub exists so the page is live and indexable while the full content is prepared.

## Why this matters

${gap.citations} search citations reference this topic${gap.competing_domains?.length ? ` on domains like ${gap.competing_domains.slice(0, 3).join(", ")}` : ""}. A dedicated page gives search engines a clear signal that ${client.name} covers this subject.

## FAQ

**Q: What is this page about?**
A: This page covers "${gap.keyword}" as it relates to ${client.name || audit.category_hint || "our services"}.

**Q: Is this content complete?**
A: This is a starting point. More detailed content will be added.
`;

  return {
    type: "new_page",
    file,
    after: fallbackContent,
    targets_keyword: gap.keyword,
    rationale: `Deterministic stub targeting gap keyword "${gap.keyword}" because the LLM was unavailable. The page is live and indexable while content is refined.`,
  };
}

export async function generateActions(input: {
  client: Client;
  audit: AuditResult;
  gaps: Gap[];
}): Promise<Action[]> {
  const { client, audit, gaps } = input;
  const actions: Action[] = [];

  try {
    const robotsAction = buildRobotsAction(audit);
    if (robotsAction) actions.push(robotsAction);
  } catch (err) {
    console.error("buildRobotsAction failed:", err);
  }

  try {
    const [metaAction, schemaAction, llmsAction, gapPageAction] = await Promise.all([
      buildMetaAction(audit, client, gaps),
      Promise.resolve(buildSchemaAction(audit, client)),
      Promise.resolve(buildLlmsTxtAction(audit, client, gaps)),
      gaps.length > 0
        ? buildGapPageAction(gaps[0], client, audit)
        : Promise.resolve(null),
    ]);

    if (metaAction) actions.push(metaAction);
    if (schemaAction) actions.push(schemaAction);
    if (llmsAction) actions.push(llmsAction);
    if (gapPageAction) actions.push(gapPageAction);
  } catch (err) {
    console.error("generateActions async batch failed:", err);
  }

  return actions;
}
