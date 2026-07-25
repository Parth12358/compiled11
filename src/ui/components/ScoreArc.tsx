"use client";

import type { CSSProperties } from "react";
import type { Score } from "@/ui/types";
import { useCountUp, useReveal } from "@/ui/motion";
import styles from "./ScoreArc.module.css";

/**
 * 270° gauge geometry — starts bottom-left, sweeps clockwise, opening at the
 * bottom. Computed once from the 230-unit viewBox; pathLength={100} lets the
 * dash math speak in percentages.
 */
const R = 100;
const C = 115;
const K = R * Math.SQRT1_2; // 45° endpoint offset from center
const ARC_D = `M ${(C - K).toFixed(2)} ${(C + K).toFixed(2)} A ${R} ${R} 0 1 1 ${(C + K).toFixed(2)} ${(C + K).toFixed(2)}`;

interface ScoreArcProps {
  score: Score;
  clientName: string;
}

export function ScoreArc({ score, clientName }: ScoreArcProps) {
  const ref = useReveal<HTMLElement>();
  const fraction = Math.min(1, Math.max(0, score.visibility));
  const value = useCountUp(fraction * 100);

  return (
    <figure
      ref={ref}
      className={styles.root}
      style={{ "--arc-offset": (100 - fraction * 100).toFixed(3) } as CSSProperties}
    >
      <div className={styles.dial}>
        <svg
          className={styles.svg}
          viewBox="0 0 230 230"
          aria-hidden="true"
          focusable="false"
        >
          <path className={styles.track} d={ARC_D} pathLength={100} />
          {fraction > 0 && (
            <path className={styles.progress} d={ARC_D} pathLength={100} />
          )}
        </svg>
        <div className={styles.center}>
          <span className={styles.value}>{Math.round(value)}%</span>
          <span className={styles.detail}>
            {score.cited_queries} of {score.total_queries} answers
          </span>
        </div>
      </div>
      <figcaption className={styles.caption}>
        queries where {clientName} is cited
      </figcaption>
    </figure>
  );
}
