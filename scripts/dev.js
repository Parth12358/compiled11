#!/usr/bin/env node
// PRD-C §3: `npm run dev -- --fixture` → fixture mode.
// Next.js doesn't accept unknown CLI flags, so this shim strips `--fixture`,
// sets NEXT_PUBLIC_FIXTURE=1, and spawns `next dev` with everything else.
const { spawn } = require("node:child_process");

const args = process.argv.slice(2);
const fixture = args.includes("--fixture");
const rest = args.filter((a) => a !== "--fixture");

const env = { ...process.env };
if (fixture) env.NEXT_PUBLIC_FIXTURE = "1";

const child = spawn("npx", ["next", "dev", ...rest], { stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));
