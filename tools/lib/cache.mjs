/* ============================================================
   cache.mjs — a tiny on-disk cache
   ------------------------------------------------------------
   The Wayback is slow and rate-limits hard. Without a cache every
   re-run of the harcher re-downloads the same snapshots. With one,
   a second run costs seconds and the history is preserved between
   runs — which is exactly what a price archive wants.
   ============================================================ */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CACHE_DIR = join(ROOT, "data", ".cache");

function keyToFile(key) {
  const h = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return join(CACHE_DIR, `${h}.json`);
}

export async function cacheGet(key) {
  const f = keyToFile(key);
  if (!existsSync(f)) return undefined;
  try {
    const raw = await readFile(f, "utf8");
    return JSON.parse(raw).value;
  } catch {
    return undefined;
  }
}

export async function cacheSet(key, value) {
  await mkdir(CACHE_DIR, { recursive: true });
  const f = keyToFile(key);
  await writeFile(f, JSON.stringify({ key, at: new Date().toISOString(), value }));
  return value;
}

export async function cacheGetOrSet(key, producer) {
  const hit = await cacheGet(key);
  if (hit !== undefined) return hit;
  const value = await producer();
  if (value !== undefined && value !== null) await cacheSet(key, value);
  return value;
}
