import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Handoff seam for Persons A + B: when the retrieval/action pipeline finishes,
// it writes `report.json` (fixture.json shape) at the repo root. The UI polls
// this route once per run with a 3.5s abort; 404 → bundled fixture fallback.
import demoReport from "../../../report.demo.json";

export async function GET() {
  // Live pipeline output first; else the statically-bundled snapshot of a real
  // verified run (report.demo.json — includes the live PR link), so the
  // deployed app shows a genuine result. The static import guarantees the
  // snapshot survives serverless bundling; fs is only for fresh local runs.
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "report.json"), "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(demoReport);
  }
}
