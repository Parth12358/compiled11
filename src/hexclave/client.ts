import { HexclaveClientApp } from "@hexclave/next";

// True once a Hexclave project is linked (env injected by `hexclave dev`
// or the deployments-alpha connection). Cheap to check anywhere — no SDK
// construction happens unless this is true, so keyless demo runs never
// touch Hexclave internals.
export const hexclaveEnabled = !!(
  process.env.NEXT_PUBLIC_HEXCLAVE_PROJECT_ID || process.env.HEXCLAVE_PROJECT_ID
);

function create() {
  if (!hexclaveEnabled) return null;
  try {
    return new HexclaveClientApp({
      tokenStore: "cookie",
      urls: { default: { type: "hosted" } },
    });
  } catch {
    return null;
  }
}

export const hexclaveClientApp = create();
