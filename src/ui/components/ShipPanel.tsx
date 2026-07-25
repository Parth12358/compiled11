"use client";

// ShipPanel — the last beat: the fix leaves the building.
// Two cards: the pull request (or the ghost of one) and IndexNow discovery.
// Renders exactly what props provide — no fabricated URLs or timestamps.

import { useReveal } from "@/ui/motion";
import styles from "./ShipPanel.module.css";

export interface ShipPanelProps {
  prUrl: string | null;
  indexnowAt: string | null;
  repo: string;
}

/** ISO → local HH:MM; invalid input falls back to the raw string. */
function formatSubmittedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export function ShipPanel({ prUrl, indexnowAt, repo }: ShipPanelProps) {
  const revealRef = useReveal<HTMLDivElement>();

  return (
    <div ref={revealRef} className={styles.grid}>
      <section className={styles.card} aria-label="Pull request">
        <p className={styles.label}>ship it</p>
        <h3 className={styles.title}>Pull request</h3>
        {prUrl !== null ? (
          <>
            <a
              className={styles.prLink}
              href={prUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View pull request ↗
            </a>
            <p className={styles.repo}>{repo}</p>
          </>
        ) : (
          <>
            <button type="button" className={styles.ghostBtn}>
              Connect repo →
            </button>
            <p className={styles.caption}>
              PR opens here once GitHub is connected · the patch above is the
              artifact
            </p>
          </>
        )}
      </section>

      <section className={styles.card} aria-label="Discovery">
        <p className={styles.label}>indexnow</p>
        <h3 className={styles.title}>Discovery</h3>
        {indexnowAt !== null ? (
          <>
            <p className={styles.status}>
              <span className={`${styles.dot} ${styles.dotLive}`} aria-hidden="true" />
              <span suppressHydrationWarning>
                Submitted {formatSubmittedAt(indexnowAt)}
              </span>
            </p>
            <p className={styles.caption}>
              Bing + partner engines pinged. Indexing runs hours-to-a-day.
            </p>
          </>
        ) : (
          <>
            <p className={styles.status}>
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.statusIdle}>Ready to submit</span>
            </p>
            <p className={styles.caption}>Fires automatically on the next run.</p>
          </>
        )}
      </section>
    </div>
  );
}
