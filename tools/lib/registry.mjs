/* ============================================================
   registry.mjs — one place that knows the markets and services
   ============================================================ */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

let cache = null;

export async function loadRegistry() {
  if (cache) return cache;
  const [marketsRaw, servicesRaw] = await Promise.all([
    readFile(join(ROOT, "data", "markets.json"), "utf8"),
    readFile(join(ROOT, "data", "services.json"), "utf8"),
  ]);
  cache = {
    markets: JSON.parse(marketsRaw).markets,
    services: JSON.parse(servicesRaw).services,
  };
  return cache;
}

/**
 * The market object the extractor needs: the market's own currency and
 * the symbol its price pages actually use.
 */
export function marketObj(reg, code) {
  const m = reg.markets[code];
  if (!m) return null;
  return {
    code,
    currency: m.currency,
    symbol: m.symbol,
    aliases: m.aliases || null,
    symbolIsAmbiguous: !!m.symbolIsAmbiguous,
    primaryLang: (m.langs && m.langs[0]) || null,
    cc: m.cc,
    name: m.name,
  };
}

/** Every service/market pair the registry says to watch. */
export function watchPairs(reg) {
  const pairs = [];
  for (const [sid, svc] of Object.entries(reg.services)) {
    for (const mid of svc.markets || []) {
      if (!reg.markets[mid]) continue;
      pairs.push({ service: sid, market: mid });
    }
  }
  return pairs;
}
