import { HexclaveHandler } from "@hexclave/next";
import { hexclaveServerApp } from "@/hexclave/server";

export const dynamic = "force-dynamic";

// Hosted auth surface: /handler/sign-in, /handler/sign-up, account settings, etc.
export default function Handler(props: unknown) {
  if (!hexclaveServerApp) {
    return (
      <main style={{ padding: 48, fontFamily: "var(--font-mono), monospace", fontSize: 13 }}>
        Hexclave isn&apos;t linked yet — run `npm run dev` and finish onboarding, then sign-in
        lives here.
      </main>
    );
  }
  return <HexclaveHandler fullPage app={hexclaveServerApp} routeProps={props} />;
}
