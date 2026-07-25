"use client";

import { useMemo } from "react";
import type { Report } from "@/ui/types";
import { ScoreArc } from "@/ui/components/ScoreArc";
import styles from "./VerdictHeader.module.css";

interface VerdictHeaderProps {
  report: Report;
  demoData: boolean;
}

export function VerdictHeader({ report, demoData }: VerdictHeaderProps) {
  const { client, score, sources } = report;

  const { topDomain, presentCount, clientIsTop } = useMemo(() => {
    const sorted = [...sources].sort((a, b) => b.citation_count - a.citation_count);
    const top = sorted[0];
    let host = "";
    try {
      host = new URL(client.url).hostname.replace(/^www\./, "");
    } catch {
      host = "";
    }
    return {
      topDomain: top?.domain ?? "nobody",
      presentCount: sources.filter((s) => s.client_present).length,
      clientIsTop: !!top && host !== "" && top.domain === host,
    };
  }, [sources, client.url]);

  return (
    <header className={styles.verdict}>
      <div className={styles.beam} aria-hidden="true" />
      <div className={`container ${styles.grid}`}>
        <div className={styles.copy}>
          <p className="eyebrow">the verdict</p>
          <h1 className={styles.line}>
            {clientIsTop ? (
              <>You own this category.</>
            ) : (
              <>
                <span className={styles.owner}>{topDomain}</span> owns your category.
              </>
            )}
          </h1>
          <p className={styles.sub}>
            {client.name} appears in{" "}
            <strong className={styles.strong}>
              {score.cited_queries} of {score.total_queries}
            </strong>{" "}
            sampled answers, and on {presentCount} of {sources.length} cited sources.
          </p>
          {demoData && <span className={`${styles.demoChip} mono`}>pre-baked demo data</span>}
        </div>
        <div className={styles.arc}>
          <ScoreArc score={score} clientName={client.name} />
        </div>
      </div>
    </header>
  );
}
