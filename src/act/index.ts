import { promises as fs } from "fs";
import path from "path";
import type { Action, ActInput, ActOutput, BacklinkCallAction, Gap } from "../contract";
import { auditSite } from "./audit";
import { computeGaps } from "./gaps";
import { generateActions } from "./generate";
import { discoverTargets, buildCallBrief } from "./outreach";
import { toPendingAction, runCalls } from "./call";
import { openPR, pingIndexNow } from "./pr";

export type { ActInput, ActOutput } from "../contract";

export async function act(input: ActInput): Promise<ActOutput> {
  if (input.fixture === true) {
    try {
      const raw = await fs.readFile(
        path.join(process.cwd(), "fixture.json"),
        "utf8",
      );
      const fixture = JSON.parse(raw);
      return {
        gaps: fixture.gaps ?? [],
        actions: fixture.actions ?? [],
        pr_url: fixture.pr_url ?? null,
        indexnow_submitted_at: fixture.indexnow_submitted_at ?? null,
      };
    } catch (err) {
      console.error("act: fixture load failed, falling through to live path:", err);
    }
  }

  let audit: Awaited<ReturnType<typeof auditSite>> | null = null;
  let gaps: Gap[] = [];
  let onSiteActions: Action[] = [];
  let callActions: BacklinkCallAction[] = [];

  try {
    audit = await auditSite(input.client.url);
  } catch (err) {
    console.error("act: auditSite failed:", err);
    return { gaps: [], actions: [], pr_url: null, indexnow_submitted_at: null };
  }

  try {
    gaps = computeGaps(input.queries, audit);
  } catch (err) {
    console.error("act: computeGaps failed:", err);
    gaps = [];
  }

  try {
    const [generated, outreachTargets] = await Promise.all([
      generateActions({ client: input.client, audit, gaps }).catch(
        (err): Action[] => {
          console.error("act: generateActions failed:", err);
          return [];
        },
      ),
      discoverTargets({
        client: input.client,
        queries: input.queries,
        sources: input.sources,
        audit,
      }).catch((err) => {
        console.error("act: discoverTargets failed:", err);
        return [];
      }),
    ]);

    onSiteActions = generated;

    let pendingCalls = outreachTargets.map((target) =>
      toPendingAction(target, buildCallBrief(target, input.client)),
    );

    if (
      input.approvedTargets !== undefined &&
      input.approvedTargets.length > 0
    ) {
      const approvedDomains = new Set(
        input.approvedTargets
          .map((t) => t.domain)
          .filter((d): d is string => d !== null),
      );
      pendingCalls = pendingCalls.filter((a) =>
        a.target.domain ? approvedDomains.has(a.target.domain) : false,
      );
    }

    if (pendingCalls.length > 0) {
      try {
        callActions = await runCalls(pendingCalls, {
          live: input.live?.call === true,
          maxCalls: 3,
        });
      } catch (err) {
        console.error("act: runCalls failed:", err);
      }
    }
  } catch (err) {
    console.error("act: generate/outreach stage failed:", err);
  }

  const actions: Action[] = [...onSiteActions, ...callActions];

  let pr_url: string | null = null;
  let indexnow_submitted_at: string | null = null;

  try {
    pr_url = await openPR({
      client: input.client,
      actions,
      live: input.live?.pr === true,
    });
  } catch (err) {
    console.error("act: openPR failed:", err);
  }

  try {
    indexnow_submitted_at = await pingIndexNow({
      client: input.client,
      actions,
      live: input.live?.indexnow === true,
    });
  } catch (err) {
    console.error("act: pingIndexNow failed:", err);
  }

  return { gaps, actions, pr_url, indexnow_submitted_at };
}
