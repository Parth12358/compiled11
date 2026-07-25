"use client";

import type { CSSProperties } from "react";
import type { Gap } from "@/ui/types";
import { useReveal } from "@/ui/motion";
import styles from "./GapGrid.module.css";

interface GapGridProps {
  gaps: Gap[];
}

/** "missing_page" → "missing page" */
function humanizeType(type: string): string {
  return type.replace(/_/g, " ");
}

export function GapGrid({ gaps }: GapGridProps) {
  const gridRef = useReveal<HTMLUListElement>();

  if (gaps.length === 0) return null;

  return (
    <ul
      ref={gridRef}
      className={styles.grid}
      aria-label="Queries the client has no content for"
    >
      {gaps.map((gap, i) => (
        <li
          key={`${gap.type}:${gap.keyword}`}
          className={styles.card}
          style={{ "--d": `${i * 90}ms` } as CSSProperties}
        >
          <div className={styles.meta}>
            <span className={styles.badge}>{humanizeType(gap.type)}</span>
            <span className={styles.citations}>
              {gap.citations} {gap.citations === 1 ? "citation" : "citations"}
            </span>
          </div>
          <p className={styles.keyword}>&laquo;{gap.keyword}&raquo;</p>
        </li>
      ))}
    </ul>
  );
}
