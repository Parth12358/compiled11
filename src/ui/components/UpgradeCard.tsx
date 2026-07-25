"use client";

import { Component, Suspense, useState, type ReactNode } from "react";
import { useHexclaveApp, useUser } from "@hexclave/next";
import { hexclaveEnabled } from "@/hexclave/client";
import styles from "./UpgradeCard.module.css";

// Matches the "Pro Plan" product in the Hexclave dashboard
// (Apps → Payments → Products): $99.99/mo, 3-day free trial.
const PRO_PRODUCT_ID = "pro-plan";

/** Hexclave not linked yet must never break the demo page. */
class Guard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function CheckoutButton() {
  const app = useHexclaveApp();
  const user = useUser();
  const [busy, setBusy] = useState(false);

  const buy = async () => {
    if (busy) return;
    if (!user) {
      app.redirectToSignIn();
      return;
    }
    setBusy(true);
    try {
      const url = await user.createCheckoutUrl({
        productId: PRO_PRODUCT_ID,
        returnUrl: window.location.href,
      });
      window.location.href = url;
    } catch {
      setBusy(false);
    }
  };

  return (
    <button type="button" className={`${styles.buy} mono`} onClick={buy} disabled={busy}>
      {busy ? "opening checkout…" : "start pro — $99.99/mo"}
    </button>
  );
}

function SignInInner() {
  const app = useHexclaveApp();
  return (
    <button
      type="button"
      className={`${styles.signin} mono`}
      onClick={() => app.redirectToSignIn()}
    >
      client login
    </button>
  );
}

export function SignInButton() {
  // No provider mounted (keyless run) → render nothing; hooks never execute.
  if (!hexclaveEnabled) return null;
  return (
    <Guard fallback={null}>
      <Suspense fallback={null}>
        <SignInInner />
      </Suspense>
    </Guard>
  );
}

export function UpgradeCard() {
  const fallbackBtn = (
    <button
      type="button"
      className={`${styles.buy} mono`}
      disabled
      title="Connect Hexclave to enable checkout"
    >
      start pro — $99.99/mo
    </button>
  );

  return (
    <aside className={styles.card}>
      <div>
        <p className={`${styles.label} mono`}>go live</p>
        <h3 className={styles.title}>Run this every month.</h3>
        <p className={styles.copy}>
          CITED re-scans your category, re-scores your visibility, and opens the next pull
          request. Cancel any time.
        </p>
      </div>
      <div className={styles.buyCol}>
        {hexclaveEnabled ? (
          <Guard fallback={fallbackBtn}>
            <Suspense fallback={fallbackBtn}>
              <CheckoutButton />
            </Suspense>
          </Guard>
        ) : (
          fallbackBtn
        )}
        <span className={`${styles.note} mono`}>3-day free trial · payments via hexclave</span>
      </div>
    </aside>
  );
}
