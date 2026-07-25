import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Handoff seam for Persons A + B: when the retrieval/action pipeline finishes,
// it writes `report.json` (fixture.json shape) at the repo root. The UI polls
// this route once per run with a 3.5s abort; 404 → bundled fixture fallback.
export async function GET() {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "report.json"), "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "no report yet" }, { status: 404 });
  }
}
