import localFont from "next/font/local";

// All fonts vendored in src/ui/fonts/ — zero network at build, dev, or runtime (PRD-C §2).

export const fraunces = localFont({
  src: "./fonts/fraunces-var.woff2",
  variable: "--font-display",
  weight: "300 900",
  display: "swap",
});

export const instrument = localFont({
  src: "./fonts/instrument-sans-var.woff2",
  variable: "--font-sans",
  weight: "400 700",
  display: "swap",
});

export const plexMono = localFont({
  src: [
    { path: "./fonts/plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/plex-mono-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});
