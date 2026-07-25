// File-based response cache. Every successful API response is written to disk so
// the demo can re-run instantly (and survive an API outage). Keys expire after 1h.

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const CACHE_DIR = path.join(process.cwd(), "cache");
const MAX_AGE_MS = 60 * 60 * 1000;

function keyToFile(key: string): string {
  const safe = key.replace(/[^a-z0-9]+/gi, "_").slice(0, 100);
  const hash = crypto.createHash("md5").update(key).digest("hex").slice(0, 8);
  return path.join(CACHE_DIR, `${safe}_${hash}.json`);
}

/** Returns parsed JSON if a fresh (<1h) cache file exists, otherwise null. */
export async function getCache(key: string): Promise<unknown | null> {
  try {
    const file = keyToFile(key);
    const stat = await fs.stat(file);
    if (Date.now() - stat.mtimeMs > MAX_AGE_MS) return null;
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

/** Persist a value to the cache. Silently no-ops on failure. */
export async function setCache(key: string, data: unknown): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(keyToFile(key), JSON.stringify(data), "utf8");
  } catch {
    // caching is best-effort
  }
}
