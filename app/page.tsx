"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Report } from "@/ui/types";
import { useReveal } from "@/ui/motion";
import { Hero } from "@/ui/components/Hero";
import { ScanSequence } from "@/ui/components/ScanSequence";
import { InkFlood } from "@/ui/components/InkFlood";
import { VerdictHeader } from "@/ui/components/VerdictHeader";
import { SourceLeaderboard } from "@/ui/components/SourceLeaderboard";
import { GapGrid } from "@/ui/components/GapGrid";
import { DiffViewer } from "@/ui/components/DiffViewer";
import { ShipPanel } from "@/ui/components/ShipPanel";
import { SignInButton, UpgradeCard } from "@/ui/components/UpgradeCard";
import fixtureJson from "../fixture.json";
import styles from "./page.module.css";

const FIXTURE = fixtureJson as Report;

type World = "idle" | "scanning" | "revealed";

// PRD-C §3: hard 3.5s abort — the demo can never stall on network.
async function fetchReport(): Promise<Report | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3500);
  try {
    const res = await fetch("/api/report", { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as Partial<Report>;
    if (
      !j ||
      !j.client ||
      !j.score ||
      !Array.isArray(j.sources) ||
      !Array.isArray(j.gaps) ||
      !Array.isArray(j.actions)
    ) {
      return null;
    }
    return j as Report;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function Sect({
  index,
  eyebrow,
  title,
  note,
  constellation,
  children,
}: {
  index: string;
  eyebrow: string;
  title: string;
  note?: string;
  constellation?: boolean;
  children: React.ReactNode;
}) {
  const ref = useReveal<HTMLElement>(0.12);
  return (
    <section ref={ref} className={`section ${styles.sect} ${constellation ? styles.sectBg : ""}`}>
      <span className={`${styles.secTag} mono`} aria-hidden="true">
        SEC—{index}
      </span>
      <div className={`container ${styles.sectInner}`}>
        <p className={`${styles.secNo} mono`}>{index}</p>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className={styles.h2}>{title}</h2>
        {note && <p className={styles.note}>{note}</p>}
        {children}
      </div>
    </section>
  );
}

export default function Page() {
  const [world, setWorld] = useState<World>("idle");
  const [report, setReport] = useState<Report>(FIXTURE);
  const [demoData, setDemoData] = useState(false);
  const [flood, setFlood] = useState(false);
  const [ranSite, setRanSite] = useState(FIXTURE.client.url);

  const pendingReport = useRef<Promise<Report | null>>(Promise.resolve(null));
  const isCustomRun = useRef(false);

  useEffect(() => {
    document.body.dataset.world = world === "revealed" ? "ink" : "paper";
    if (world === "revealed") window.scrollTo(0, 0);
  }, [world]);

  // Fixture mode (?fixture=1 or NEXT_PUBLIC_FIXTURE=1): straight to the reveal
  // through a fast inversion — the zero-network pre-baked tab (PRD-C §3).
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("fixture") === "1" || process.env.NEXT_PUBLIC_FIXTURE === "1") {
      setFlood(true);
      const t1 = setTimeout(() => setWorld("revealed"), 420);
      const t2 = setTimeout(() => setFlood(false), 1100);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, []);

  const handleRun = useCallback((siteUrl: string, _repo: string, prebaked: boolean) => {
    const site = prebaked ? FIXTURE.client.url : siteUrl;
    isCustomRun.current = !prebaked;
    pendingReport.current = prebaked ? Promise.resolve(null) : fetchReport();
    setRanSite(site);
    setWorld("scanning");
  }, []);

  const handleScanDone = useCallback(async () => {
    const live = await pendingReport.current;
    if (live) {
      setReport(live);
      setDemoData(false);
    } else {
      setReport(FIXTURE);
      setDemoData(isCustomRun.current);
    }
    setFlood(true);
    setTimeout(() => setWorld("revealed"), 420);
    setTimeout(() => setFlood(false), 1100);
  }, []);

  return (
    <main>
      <InkFlood active={flood} />

      {world === "idle" && <Hero onRun={handleRun} />}
      {world === "scanning" && <ScanSequence siteUrl={ranSite} onDone={handleScanDone} />}

      {world === "revealed" && (
        <div className={styles.revealed}>
          <nav className={styles.topbar}>
            <span className={styles.wordmark}>
              CITED<sup className={styles.wordmarkSup}>1</sup>
            </span>
            <span className={`${styles.clientChip} mono`}>{report.client.url.replace(/^https?:\/\//, "")}</span>
            <span className={styles.rightGroup}>
              <SignInButton />
              <button
                type="button"
                className={`${styles.rerun} mono`}
                onClick={() => window.location.assign(window.location.pathname)}
              >
                new run ↺
              </button>
            </span>
          </nav>

          <VerdictHeader report={report} demoData={demoData} />

          <Sect
            index="01"
            eyebrow="the sources"
            title="What the engine actually reads."
            note={`Ranked by citations across ${report.score.total_queries} category queries. Amber marks the sources where ${report.client.name} already appears.`}
            constellation
          >
            <SourceLeaderboard sources={report.sources} clientName={report.client.name} />
          </Sect>

          <Sect
            index="02"
            eyebrow="the gaps"
            title="Questions you have no answer for."
            note="Queries driving citations where the site has no matching content — each one is a page the engine wanted and couldn't find."
          >
            <GapGrid gaps={report.gaps} />
          </Sect>

          <Sect
            index="03"
            eyebrow="the fix"
            title="The fix, already written."
            note="Everything lands in your own repo, behind your review. CITED never posts to sites you don't own — third-party gaps are surfaced for human outreach."
          >
            <DiffViewer actions={report.actions} />
          </Sect>

          <Sect index="04" eyebrow="ship" title="From dashboard to pull request." constellation>
            <ShipPanel
              prUrl={report.pr_url}
              indexnowAt={report.indexnow_submitted_at}
              repo={report.client.repo}
            />
            <UpgradeCard />
            <p className={styles.close}>
              Monitoring tools stop at the dashboard.{" "}
              <span className={styles.closeAmber}>This one opens the pull request.</span>
            </p>
          </Sect>

          <div className={styles.brandClose} aria-hidden="true">
            CITED<sup className={styles.brandSup}>1</sup>
          </div>

          <footer className={`${styles.footer} mono`}>
            <span>1&nbsp;&nbsp;80% figure: 2026 citation-analysis data via campaigncreators</span>
            <span>CITED · c0mpiled startup school hackathon · 24 jul 2026</span>
          </footer>
        </div>
      )}
    </main>
  );
}
