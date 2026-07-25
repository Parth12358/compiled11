import type { Action, Client } from "../contract";
import { Octokit } from "@octokit/rest";

type FileAction = Extract<Action, { file: string; after: string }>;

function isFileAction(action: Action): action is FileAction {
  return action.type !== "backlink_call";
}

const REPO_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

export function actionsToFiles(actions: Action[]): { path: string; content: string }[] {
  const lastIdx = new Map<string, number>();
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    if (!isFileAction(a)) continue;
    // meta and schema target existing HTML files and cannot be blindly
    // overwritten — they are rendered as a diff in the UI rather than
    // committed because we do not have the file's full original contents.
    if (a.type === "meta" || a.type === "schema") continue;
    if (lastIdx.has(a.file)) {
      console.error(`pr: duplicate path "${a.file}" — using last occurrence`);
    }
    lastIdx.set(a.file, i);
  }
  return Array.from(lastIdx.entries()).map(([path, idx]) => {
    const a = actions[idx] as FileAction;
    return { path, content: a.after };
  });
}

export async function openPR(input: {
  client: Client;
  actions: Action[];
  live?: boolean;
}): Promise<string | null> {
  if (input.live !== true) {
    const files = actionsToFiles(input.actions);
    const shortTs = Date.now().toString(36);
    console.error(
      `pr: [dry run] would open PR on ${input.client.repo} branch ` +
      `cited/aeo-fixes-${shortTs} with ${files.length} files`
    );
    return null;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("pr: GITHUB_TOKEN is not set");
    return null;
  }

  if (!input.client.repo || !REPO_RE.test(input.client.repo)) {
    console.error(`pr: invalid repo "${input.client.repo}" — expected owner/name`);
    return null;
  }

  const [owner, repo] = input.client.repo.split("/");
  const octokit = new Octokit({ auth: token });

  try {
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;

    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });
    const baseSha = refData.object.sha;

    const shortTs = Date.now().toString(36);
    const branch = `cited/aeo-fixes-${shortTs}`;

    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: baseSha,
    });

    const files = actionsToFiles(input.actions);
    for (const file of files) {
      try {
        let sha: string | undefined;
        try {
          const { data: existing } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: file.path,
            ref: branch,
          });
          if (!Array.isArray(existing) && "sha" in existing) {
            sha = (existing as { sha: string }).sha;
          }
        } catch {
          /* file does not exist on the branch — create from scratch */
        }

        await octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: file.path,
          message: `CITED: ${file.path}`,
          content: Buffer.from(file.content).toString("base64"),
          branch,
          sha,
        });
      } catch (err) {
        console.error(`pr: failed to commit "${file.path}":`, err);
      }
    }

    const fileActions = input.actions.filter(isFileAction);
    const bodyLines = fileActions
      .map((a) => `- **${a.file}**${a.rationale ? ` — ${a.rationale}` : ""}`);

    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: "CITED: AI answer-engine fixes",
      body: bodyLines.join("\n"),
      head: branch,
      base: defaultBranch,
    });

    return pr.html_url;
  } catch (err) {
    console.error("pr: failed to open PR:", err);
    return null;
  }
}

export async function pingIndexNow(input: {
  client: Client;
  actions: Action[];
  live?: boolean;
}): Promise<string | null> {
  if (input.live !== true) {
    console.error("indexnow: [dry run] would ping IndexNow for new_page URLs");
    return null;
  }

  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.error("indexnow: INDEXNOW_KEY is not set");
    return null;
  }

  let host: string;
  try {
    host = new URL(input.client.url).hostname;
  } catch {
    console.error(`indexnow: invalid client URL "${input.client.url}"`);
    return null;
  }

  const urlSet = new Set<string>();
  urlSet.add(input.client.url);
  for (const a of input.actions) {
    if (a.type === "new_page") {
      try {
        urlSet.add(new URL(a.file, input.client.url).href);
      } catch {
        /* skip malformed URL */
      }
    }
  }
  const urlList = Array.from(urlSet);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const resp = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (resp.status === 200 || resp.status === 202) {
      return new Date().toISOString();
    }
    console.error(`indexnow: unexpected status ${resp.status}`);
    return null;
  } catch (err) {
    console.error("indexnow: ping failed:", err);
    return null;
  }
}
