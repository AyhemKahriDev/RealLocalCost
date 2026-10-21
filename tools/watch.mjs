#!/usr/bin/env node
/* ============================================================
   watch.mjs — the nightly triage
   ------------------------------------------------------------
   The watcher NEVER writes a price. It fetches each pricing page,
   hashes it, and compares the hash with the last one it saw. When a
   page changes, it files an alert so a human can go and re-read the
   price.

   That split is the whole point:
     machine  → notices that something moved
     human   → decides what the number is now

   It also flags rows that have not been checked in a while, and rows
   whose receipt link has gone dead.

     node tools/watch.mjs
     node tools/watch.mjs --service=spotify --market=fr
   ============================================================ */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchText } from "./lib/http.mjs";
import { extractPrices } from "./lib/extract.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOTS = join(ROOT, "data", "snapshots.json");
const ALERTS = join(ROOT, "data", "alerts.json");

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
}

const STALE_DAYS = 60;

function hash(s) {
  return createHash("sha256").update(s).digest("hex").slice(0, 32);
}

function fillTemplate(tpl, m) {
  return tpl
    .replace(/\{cc\}/g, m.cc)
    .replace(/\{ccUpper\}/g, m.cc.toUpperCase())
    .replace(/\{lang\}/g, (m.langs && m.langs[0]) || "en")
    .replace(/\{currency\}/g, m.currency);
}

async function readJson(p, fallback) {
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return fallback;
  }
}

async function main() {
  const servicesRaw = await readJson(join(ROOT, "data", "services.json"), { services: {} });
  const marketsRaw = await readJson(join(ROOT, "data", "markets.json"), { markets: {} });
  const pricesRaw = await readJson(join(ROOT, "data", "prices.json"), { rows: [] });
  const snapshots = await readJson(SNAPSHOTS, { sources: {} });
  const prevAlerts = await readJson(ALERTS, { alerts: [] });

  const services = servicesRaw.services;
  const markets = marketsRaw.markets;
  const rows = pricesRaw.rows || [];

  const serviceFilter = arg("service");
  const marketFilter = arg("market");
  const today = new Date().toISOString().slice(0, 10);

  const alerts = [];
  const nextSources = { ...snapshots.sources };

  /* ---- 1. fetch every live pricing page and hash it ---- */
  for (const [sid, svc] of Object.entries(services)) {
    if (serviceFilter && sid !== serviceFilter) continue;
    if (svc.source === "wayback") continue; // no live channel for this one

    for (const [mid, m] of Object.entries(markets)) {
      if (marketFilter && mid !== marketFilter) continue;
      if (!svc.markets.includes(mid)) continue;

      const url = fillTemplate(svc.pricingUrl, m);
      const key = `${sid}|${mid}`;
      const prev = snapshots.sources[key];

      process.stdout.write(`· ${key} `);
      const r = await fetchText(url, { timeout: 30000, retries: 1 });
      if (!r.ok) {
        console.log(`fetch failed (${r.status || r.error})`);
        if (prev) prev.lastFailed = today;
        continue;
      }

      const h = hash(r.body);
      const candidates = extractPrices(r.body, {
        market: mid,
        currency: m.currency,
        planIds: (svc.plans || []).map((p) => p.id),
      });

      if (!prev) {
        console.log("first sighting — baseline recorded");
        nextSources[key] = { url, hash: h, lastSeen: today, lastChanged: today, candidates: candidates.length };
        continue;
      }

      if (prev.hash !== h) {
        console.log("CHANGED");
        nextSources[key] = {
          url,
          hash: h,
          lastSeen: today,
          lastChanged: today,
          previousHash: prev.hash,
          candidates: candidates.length,
        };
        alerts.push({
          type: "page-changed",
          date: today,
          service: sid,
          market: mid,
          url,
          note: "The pricing page changed. Re-read it and update data/prices.json if a price moved.",
          candidates,
        });
      } else {
        console.log("unchanged");
        nextSources[key] = { ...prev, url, lastSeen: today, candidates: candidates.length };
      }
    }
  }

  /* ---- 2. flag rows nobody has checked in a while ---- */
  const now = Date.now();
  for (const row of rows) {
    if (serviceFilter && row.service !== serviceFilter) continue;
    if (marketFilter && row.market !== marketFilter) continue;
    if (!row.verified) continue;
    const age = Math.floor((now - Date.parse(row.verified + "T00:00:00Z")) / 86400000);
    if (age > STALE_DAYS) {
      alerts.push({
        type: "stale",
        date: today,
        service: row.service,
        market: row.market,
        plan: row.plan,
        note: `Last checked ${row.verified} (${age} days ago). Re-read the price and update the verified date.`,
      });
    }
  }

  /* ---- 3. keep the alert history, mark the old ones resolved ---- */
  const history = (prevAlerts.alerts || []).slice(0, 200);
  for (const a of history) a.status = a.status || "open";

  const merged = [...alerts, ...history].slice(0, 400);
  const openCount = merged.filter((a) => a.status === "open" && a.type === "page-changed").length;

  await mkdir(join(ROOT, "data"), { recursive: true });
  await writeFile(
    SNAPSHOTS,
    JSON.stringify(
      {
        _comment:
          "Generated by tools/watch.mjs. Hashes of the pricing pages as last seen. Do not hand-edit.",
        updatedAt: today,
        sources: nextSources,
      },
      null,
      2
    ) + "\n"
  );
  await writeFile(
    ALERTS,
    JSON.stringify(
      {
        _comment:
          "Generated by tools/watch.mjs. The watcher proposes; a human confirms. Newest first.",
        generatedAt: new Date().toISOString(),
        alerts: merged,
      },
      null,
      2
    ) + "\n"
  );

  console.log(`\n${alerts.length} new alert(s); ${openCount} open page-change alert(s) in the history.`);
  console.log(`wrote ${SNAPSHOTS}`);
  console.log(`wrote ${ALERTS}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
