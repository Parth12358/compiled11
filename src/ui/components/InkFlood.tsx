"use client";

import styles from "./InkFlood.module.css";

/** The Inversion — a circle of ink flooding up from the run point (PRD-C §2). */
export function InkFlood({ active }: { active: boolean }) {
  return <div className={`${styles.flood} ${active ? styles.active : ""}`} aria-hidden="true" />;
}
