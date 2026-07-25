"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { prefersReducedMotion } from "@/ui/motion";
import styles from "./ScanSequence.module.css";

interface ScanSequenceProps {
  siteUrl: string;
  onDone: () => void;
}

const CHIP_POOL = [
  "g2.com",
  "reddit.com",
  "capterra.com",
  "medium.com",
  "github.com",
  "youtube.com",
  "news.ycombinator.com",
  "producthunt.com",
  "dev.to",
  "quora.com",
  "softwareadvice.com",
  "trustradius.com",
];

// Themed queries for the pre-baked case; templates for a live domain.
const LUMEN_QUERIES = [
  "best product analytics for startups",
  "lumen analytics vs amplitude",
  "open source product analytics",
  "product analytics pricing comparison",
  "self hosted analytics tools",
  "posthog alternatives",
  "session replay tools for saas",
  "funnel analysis software",
  "product analytics free tier",
  "mixpanel vs amplitude vs lumen",
  "analytics for seed stage startups",
  "gdpr compliant product analytics",
  "best analytics for b2b saas",
  "retention analysis tools",
  "event tracking setup guide",
  "product analytics on your own infra",
  "warehouse native analytics",
  "amplitude startup program worth it",
  "cheap mixpanel alternative",
  "analytics tools developers like",
  "how to pick product analytics",
  "north star metric tracking tools",
  "open source session replay",
  "product analytics for mobile apps",
  "analytics without cookies",
  "self serve analytics dashboards",
  "best free analytics 2026",
  "product analytics comparison 2026",
  "startup analytics stack",
  "when to switch off google analytics",
];

function hash(i: number): number {
  let x = (i + 1) * 2654435761;
  x = (x ^ (x >> 16)) >>> 0;
  return x;
}

function buildQueries(siteUrl: string): string[] {
  let domain = "";
  try {
    domain = new URL(siteUrl).hostname.replace(/^www\./, "");
  } catch {
    domain = "";
  }
  if (!domain || domain === "lumenanalytics.io") return LUMEN_QUERIES;
  const base = domain.split(".")[0];
  const templates = [
    `best alternatives to ${domain}`,
    `${base} reviews 2026`,
    `is ${base} worth it`,
    `tools like ${domain}`,
    `${base} pricing explained`,
    `${base} vs competitors`,
    `best tools in ${base}'s category`,
    `${base} for startups`,
    `open source ${base} alternative`,
    `${base} setup guide`,
  ];
  const out: string[] = [];
  for (let i = 0; i < 30; i++) {
    const t = templates[i % templates.length];
    out.push(i < templates.length ? t : `${t} · variant ${Math.floor(i / templates.length) + 1}`);
  }
  return out;
}

interface Line {
  q: string;
  chips: string[];
}

export function ScanSequence({ siteUrl, onDone }: ScanSequenceProps) {
  const queries = useMemo(() => buildQueries(siteUrl), [siteUrl]);
  const [count, setCount] = useState(0);
  const [aggregating, setAggregating] = useState(false);
  const doneRef = useRef(false);

  const domain = useMemo(() => {
    try {
      return new URL(siteUrl).hostname.replace(/^www\./, "");
    } catch {
      return "lumenanalytics.io";
    }
  }, [siteUrl]);

  useEffect(() => {
    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone();
    };

    if (prefersReducedMotion()) {
      setCount(queries.length);
      setAggregating(true);
      const t = setTimeout(finish, 900);
      return () => clearTimeout(t);
    }

    const interval = setInterval(() => {
      setCount((c) => {
        if (c >= queries.length) {
          clearInterval(interval);
          return c;
        }
        return c + 1;
      });
    }, 145);

    const total = queries.length * 145 + 350;
    const aggT = setTimeout(() => setAggregating(true), total);
    const doneT = setTimeout(finish, total + 650);
    return () => {
      clearInterval(interval);
      clearTimeout(aggT);
      clearTimeout(doneT);
    };
  }, [queries, onDone]);

  const lines: Line[] = [];
  const start = Math.max(0, count - 7);
  for (let i = start; i < count; i++) {
    const h = hash(i);
    const n = h % 4; // 0..3 citation chips
    const chips: string[] = [];
    for (let k = 0; k < n; k++) chips.push(CHIP_POOL[(h + k * 5) % CHIP_POOL.length]);
    lines.push({ q: queries[i], chips });
  }

  const progress = Math.min(100, (count / queries.length) * 100);

  return (
    <div className={styles.scan}>
      <div className={styles.inner}>
        <div className={`${styles.head} mono`}>
          <span>answer engine · category scan · {domain}</span>
          <span className={styles.counter}>
            {Math.min(count, queries.length)} / {queries.length}
          </span>
        </div>
        <div className={styles.rule} role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <div className={styles.ruleFill} style={{ width: `${progress}%` }} />
        </div>

        <ol className={`${styles.lines} mono`}>
          {lines.map((l, idx) => {
            const isLast = idx === lines.length - 1;
            return (
              <li key={`${l.q}-${idx}`} className={`${styles.line} ${isLast ? styles.current : styles.past}`}>
                <span className={styles.q}>
                  {l.q}
                  {isLast && !aggregating && <span className={styles.caret} />}
                </span>
                {l.chips.length > 0 && (
                  <span className={styles.chips}>
                    {l.chips.map((c, ci) => (
                      <span key={ci} className={styles.chip} style={{ animationDelay: `${180 + ci * 120}ms` }}>
                        {c}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            );
          })}
          {aggregating && <li className={`${styles.line} ${styles.agg}`}>aggregating citations by domain…</li>}
        </ol>
      </div>
    </div>
  );
}
