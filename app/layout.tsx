import type { Metadata } from "next";
import { HexclaveProvider, HexclaveTheme } from "@hexclave/next";
import { hexclaveClientApp } from "@/hexclave/client";
import { fraunces, instrument, plexMono } from "@/ui/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "CITED — who owns your category inside AI answers",
  description:
    "Point CITED at a site and its repo. It finds who answer engines actually cite for your category, shows where you're invisible, and opens the PR that fixes it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        data-world="paper"
        suppressHydrationWarning
        className={`${fraunces.variable} ${instrument.variable} ${plexMono.variable}`}
      >
        {hexclaveClientApp ? (
          <HexclaveProvider app={hexclaveClientApp}>
            <HexclaveTheme>{children}</HexclaveTheme>
          </HexclaveProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
