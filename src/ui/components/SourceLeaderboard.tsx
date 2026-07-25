"use client";

import type { CSSProperties } from "react";
import type { Source } from "@/ui/types";
import { useReveal } from "@/ui/motion";
import styles from "./SourceLeaderboard.module.css";

interface SourceLeaderboardProps {
  sources: Source[];
  clientName: string;
}

export function SourceLeaderboard({ sources, clientName }: SourceLeaderboardProps) {
  const listRef = useReveal<HTMLOListElement>();

  if (sources.length === 0) return null;

  const ranked = [...sources].sort((a, b) => b.citation_count - a.citation_count);
  const max = Math.max(1, ranked[0].citation_count);

  return (
    <ol
      ref={listRef}
      className={styles.list}
      aria-label={`Most cited domains — ${clientName} presence`}
    >
      {ranked.map((source, i) => (
        <li
          key={source.domain}
          className={
            source.client_present ? `${styles.row} ${styles.present}` : styles.row
          }
          title={`${source.domain} — ${source.citation_count} citations`}
          style={
            {
              "--w": `${(source.citation_count / max) * 100}%`,
              "--d": `${i * 70}ms`,
            } as CSSProperties
          }
        >
          <span className={styles.rank}>{String(i + 1).padStart(2, "0")}</span>
          <span className={styles.domain}>{source.domain}</span>
          <span className={styles.barTrack} aria-hidden="true">
            <span
              className={
                source.client_present
                  ? `${styles.fill} ${styles.fillPresent}`
                  : `${styles.fill} ${styles.fillAbsent}`
              }
            />
          </span>
          <span className={styles.count}>{source.citation_count}</span>
          <span
            className={
              source.client_present
                ? `${styles.presence} ${styles.cited}`
                : `${styles.presence} ${styles.absent}`
            }
          >
            {source.client_present ? "● cited" : "— absent"}
          </span>
        </li>
      ))}
    </ol>
  );
}
