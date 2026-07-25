import { HexclaveServerApp } from "@hexclave/next";

// Same env gate as client.ts: no construction unless a project is linked.
const enabled = !!(
  process.env.HEXCLAVE_PROJECT_ID || process.env.NEXT_PUBLIC_HEXCLAVE_PROJECT_ID
);

function create() {
  if (!enabled) return null;
  try {
    return new HexclaveServerApp({
      tokenStore: "cookie",
      urls: { default: { type: "hosted" } },
    });
  } catch {
    return null;
  }
}

export const hexclaveServerApp = create();
