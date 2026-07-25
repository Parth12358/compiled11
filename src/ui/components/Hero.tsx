"use client";

import { useState } from "react";
import { HERO_GRAPH } from "@/ui/ascii";
import styles from "./Hero.module.css";

interface HeroProps {
  onRun: (siteUrl: string, repo: string, prebaked: boolean) => void;
}

// Print registration marks pinning the frame at grid points.
const CROSSES: Array<{ top: string; left: string }> = [
  { top: "10%", left: "28%" },
  { top: "8%", left: "72%" },
  { top: "38%", left: "94%" },
  { top: "62%", left: "4%" },
  { top: "88%", left: "60%" },
  { top: "80%", left: "90%" },
];

function normalizeSite(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const candidate = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(candidate);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function Hero({ onRun }: HeroProps) {
  const [site, setSite] = useState("");
  const [repo, setRepo] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = normalizeSite(site);
    if (!url) {
      setError("Enter a site URL like https://example.com");
      return;
    }
    const r = repo.trim();
    if (r && !/^[\w.-]+\/[\w.-]+$/.test(r)) {
      setError("Repo looks like org/repo — or leave it empty");
      return;
    }
    setError("");
    onRun(url, r, false);
  };

  return (
    <div className={styles.hero}>
      <div className={styles.field} aria-hidden="true">
        <pre className={`${styles.ascii} mono`}>{HERO_GRAPH}</pre>
        {CROSSES.map((c, i) => (
          <span key={i} className={`${styles.cross} mono`} style={{ top: c.top, left: c.left }}>
            +
          </span>
        ))}
      </div>

      <header className={styles.topbar}>
        <span className={styles.wordmark}>
          CITED<sup className={styles.wordmarkSup}>1</sup>
        </span>
        <span className={`${styles.tag} mono`}>c0mpiled startup school · 24 jul 2026</span>
      </header>

      <div className={`container ${styles.center}`}>
        <h1 className={styles.headline}>
          <span className={styles.lineOne}>You rank on Google.</span>
          <span className={styles.lineTwo}>
            That&apos;s not where <mark className={styles.hl}>buyers ask</mark>.
          </span>
        </h1>

        <p className={styles.lede}>
          80% of the URLs AI answer engines cite don&apos;t rank in Google&apos;s top 100
          <sup className={styles.sup}>1</sup>. CITED finds who owns your category inside the
          answers — and opens the pull request that fixes it.
        </p>

        <form className={styles.card} onSubmit={submit} noValidate>
          <div className={styles.inputs}>
            <label className={styles.fieldWrap}>
              <span className={`${styles.label} mono`}>site url</span>
              <input
                className={styles.input}
                type="text"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://yoursite.com"
                value={site}
                onChange={(e) => setSite(e.target.value)}
              />
            </label>
            <label className={styles.fieldWrap}>
              <span className={`${styles.label} mono`}>github repo · optional</span>
              <input
                className={styles.input}
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="org/repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
              />
            </label>
            <button className={`${styles.run} mono`} type="submit">
              run the scan
            </button>
          </div>
          <p className={`${styles.error} mono`} role="alert">
            {error}
          </p>
        </form>

        <button className={`${styles.prebaked} mono`} type="button" onClick={() => onRun("", "", true)}>
          or load the pre-baked case →
        </button>
      </div>

      <footer className={`${styles.foot} mono`}>
        <span>
          1&nbsp;&nbsp;citation-analysis data, 2026 — via campaigncreators
        </span>
      </footer>
    </div>
  );
}
