// Person B — Action orchestrator.
// Pipeline: audit → gaps → generate → output.
// PR creation is decoupled — act reports keywords + downloadable metadata.
// Use `openPR()` from pr.ts directly if you need GitHub integration.

import { auditSite } from "./audit";
import { computeGaps } from "./gaps";
import { generateActions } from "./generate";
import type { ActInput, ActOutput, QueryResult } from "../contract";

const GENERATE_TIMEOUT_MS = parseInt(process.env.ACT_GENERATE_TIMEOUT ?? "90000", 10);

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms));
}

export async function act(input: ActInput): Promise<ActOutput> {
  const { client, queries } = input;
  const live = input.live ?? {};
  const fixture = input.fixture ?? false;

  if (fixture) {
    return { gaps: [], actions: [], pr_url: null, indexnow_submitted_at: null };
  }

  const audit = await auditSite(client.url);
  const gaps = computeGaps(queries, audit);

  const actions = live.generate !== false
    ? await Promise.race([
        generateActions(gaps, audit),
        timeoutAfter(GENERATE_TIMEOUT_MS).then(() => [] as any),
      ]).catch(() => [] as any)
    : [];

  return { gaps, actions, pr_url: null, indexnow_submitted_at: null };
}

export { auditSite, computeGaps, generateActions };
export { openPR } from "./pr";
export type { QueryResult };
