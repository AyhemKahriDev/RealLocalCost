#!/usr/bin/env node
/* ============================================================
   harvest.mjs — collect price evidence
   ------------------------------------------------------------
   The machine PROPOSES. A human CONFIRMS.

   This tool never writes prices.json. It writes data/candidates.json:
   every price token it could find, where it found it, and when.
   A human then copies the confirmed ones into data/prices.json with
   a plan id, a currency and a verification date.

   Channels (both free, both keyless):
     live    — fetch the market's own pricing page
     wayback — read the archived snapshot index, then the snapshots
   ============================================================ */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchText, cdxByYear, waybackUrl, sampleSnapshots } from "./lib/http.mjs";
import { extractPrices } from "./lib/extract.mjs";
import { cacheGetOrSet } from "./lib/cache.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
}

const SERVICE_FILTER = arg("service");
const MARKET_FILTER = arg("market");
const SAMPLES = Number(arg("samples", 8));
const OUT = join(ROOT, "data", "candidates.json");

function fillTemplate(tpl, m) {
  return tpl
    .replace(/\{cc\}/g, m.cc)
    .replace(/\{ccUpper\}/g, m.cc.toUpperCase())
    .replace(/\{lang\}/g, (m.langs && m.langs[0]) || "en")
    .replace(/\{currency\}/g, m.currency);
}

async function harvestLive(service, market) {
  const url = fillTemplate(service.pricingUrl, market);
  const r = await fetchText(url);
  if (!r.ok) {
    return { ok: false, url, status: r.status, error: r.error || `http ${r.status}`, candidates: [] };
  }
  const candidates = extractPrices(r.body, {
    market: market.code,
    currency: market.currency,
    planIds: service.plans.map((p) => p.id),
  });
  return {
    ok: true,
    kind: "live",
    url,
    finalUrl: r.finalUrl,
    redirected: r.finalUrl !== url,
    fetchedAt: new Date().toISOString().slice(0, 10),
    candidates,
  };
}

async function harvestArchive(service, market) {
  if (!service.archive) {
    return { ok: false, error: "no archive config", shots: [], snapshotCount: 0 };
  }
  // The Wayback matches on SURT path segments, so a pattern like
  // "host/cc/path*" only ever sees the exact locale directory. Services
  // also archive their pages under locale-suffixed paths (tn-fr, tn-ar,
  // eg-ar), so ask for the whole market prefix and filter the paths here.
  const cfg = service.archive;
  const prefix = cfg.prefix
    .replace(/\{cc\}/g, market.cc)
    .replace(/\{ccUpper\}/g, market.cc.toUpperCase());
  const pattern = prefix + "*";
  const want = (cfg.path || "").replace(/^\//, "").toLowerCase();

  const list = await cacheGetOrSet(`cdx:${pattern}:2021`, () =>
    cdxByYear(pattern, { fromYear: 2021, perYear: 100 })
  );

  const excludes = cfg.exclude || [];
  const filtered = list.filter((s) => {
    if (s.statuscode !== "200") return false;
    const o = s.original.toLowerCase().split("#")[0].split("?")[0];
    const m = o.match(/^(?:https?:\/\/)?[^/]+(\/.*)$/);
    if (!m) return false;
    const segs = m[1].split("/").filter(Boolean);
    if (!segs.length) return false;

    // The first segment must be the market, or the market with a locale
    // suffix: tn, tn-fr, tn-ar, eg-ar …
    const ccSeg = segs[0];
    if (ccSeg !== market.cc && !ccSeg.startsWith(market.cc + "-")) return false;

    const rest = segs.slice(1).join("/");
    if (want) {
      // The pricing path must be the rest of the URL, or a prefix of it.
      if (rest !== want && !rest.startsWith(want)) return false;
    } else {
      // No path configured: only the market root counts.
      if (rest !== "") return false;
    }
    return !excludes.some((x) => o.includes(x));
  });

  const picks = sampleSnapshots(filtered, SAMPLES);
  const shots = [];

  for (const s of picks) {
    // The extracted candidates for a given snapshot never change, so they
    // are cached. Re-running the harvester is then instant.
    const cands = await cacheGetOrSet(`shot:${s.original}:${s.timestamp}`, async () => {
      const wu = waybackUrl(s.original, s.timestamp);
      const r = await fetchText(wu, { timeout: 45000, retries: 3 });
      if (!r.ok) return null;
      return extractPrices(r.body, {
        market: market.code,
        currency: market.currency,
        planIds: service.plans.map((p) => p.id),
      });
    });

    if (cands == null) {
      shots.push({ ts: s.timestamp, date: snapDate(s.timestamp), url: s.original, ok: false, candidates: [] });
      continue;
    }
    await new Promise((r2) => setTimeout(r2, 700));
    shots.push({
      ts: s.timestamp,
      date: snapDate(s.timestamp),
      url: s.original,
      ok: true,
      candidates: cands,
    });
  }

  return { ok: true, kind: "wayback", pattern, snapshotCount: list.length, matched: filtered.length, shots };
}

function snapDate(ts) {
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
}

async function main() {
  const servicesRaw = JSON.parse(await readFile(join(ROOT, "data", "services.json"), "utf8"));
  const marketsRaw = JSON.parse(await readFile(join(ROOT, "data", "markets.json"), "utf8"));

  const services = Object.entries(servicesRaw.services).filter(
    ([id]) => !SERVICE_FILTER || id === SERVICE_FILTER
  );
  const markets = Object.entries(marketsRaw.markets).filter(
    ([id]) => !MARKET_FILTER || id === MARKET_FILTER
  );

  const out = {
    _comment:
      "Generated by tools/harvest.mjs. Machine proposals only — a human confirms before anything here becomes a published price.",
    harvestedAt: new Date().toISOString(),
    entries: [],
  };

  for (const [sid, service] of services) {
    for (const [mid, m] of markets) {
      if (!service.markets.includes(mid)) continue;
      const market = { ...m, code: mid };
      const entry = { service: sid, market: mid, currency: m.currency, channels: {} };

      if (service.source === "live" || service.source === "both") {
        process.stdout.write(`· ${sid}/${mid} live… `);
        const r = await harvestLive(service, market);
        entry.channels.live = r;
        console.log(
          r.ok ? `${r.candidates.length} candidate(s)${r.redirected ? " [redirected]" : ""}` : `FAILED ${r.error}`
        );
      }

      if (service.source === "wayback" || service.source === "both") {
        process.stdout.write(`· ${sid}/${mid} archive… `);
        const r = await harvestArchive(service, market);
        entry.channels.wayback = r;
        const good = r.shots.filter((s) => s.ok);
        const withPrices = good.filter((s) => s.candidates.length);
        console.log(
          r.snapshotCount
            ? `${r.snapshotCount} snapshots, ${withPrices.length} with prices`
            : "no snapshots"
        );
      }

      out.entries.push(entry);
    }
  }

  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nwrote ${OUT}`);
}

main();
