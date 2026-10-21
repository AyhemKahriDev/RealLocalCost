/* Data access layer: load the registries and join them. */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function readJson(rel) {
  const raw = await readFile(join(ROOT, rel), "utf8");
  return JSON.parse(raw);
}

export async function loadAll() {
  const [marketsRaw, servicesRaw, pricesRaw, incomeRaw, alternativesRaw, changesRaw] = await Promise.all([
    readJson("data/markets.json"),
    readJson("data/services.json"),
    readJson("data/prices.json").catch(() => ({ rows: [] })),
    readJson("data/income.json").catch(() => ({ markets: {} })),
    readJson("data/alternatives.json").catch(() => ({ entries: [] })),
    readJson("data/changes.json").catch(() => ({ changes: [] })),
  ]);

  const markets = marketsRaw.markets;
  const services = servicesRaw.services;

  /* prices → rows keyed by service/market/plan */
  const rows = pricesRaw.rows || [];
  const byKey = new Map();
  for (const r of rows) {
    byKey.set(`${r.service}|${r.market}|${r.plan}`, r);
  }

  /* which (service, market) pairs actually have data */
  const pairs = new Map();
  for (const r of rows) {
    const k = `${r.service}|${r.market}`;
    if (!pairs.has(k)) pairs.set(k, []);
    pairs.get(k).push(r);
  }

  return {
    markets,
    services,
    income: incomeRaw.markets || {},
    incomeMeta: incomeRaw.indicator || {},
    changes: changesRaw.changes || [],
    pricesUpdatedAt: pricesRaw.updatedAt || null,
    alternatives: alternativesRaw.entries || [],
    rows,
    byKey,
    pairs,
    /** all rows for one service across markets */
    rowsForService(serviceId) {
      return rows.filter((r) => r.service === serviceId);
    },
    /** all rows for one market across services */
    rowsForMarket(marketId) {
      return rows.filter((r) => r.market === marketId);
    },
    row(service, market, plan) {
      return byKey.get(`${service}|${market}|${plan}`) || null;
    },
    incomeFor(marketId) {
      return (incomeRaw.markets || {})[marketId] || null;
    },
    /** markets that have at least one price row */
    activeMarkets() {
      return Object.keys(markets).filter((m) => rows.some((r) => r.market === m));
    },
    /** services that have at least one price row */
    activeServices() {
      return Object.keys(services).filter((s) => rows.some((r) => r.service === s));
    },
  };
}

/** Group rows by plan so a table can list plan-by-plan prices. */
export function groupByPlan(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.plan)) map.set(r.plan, []);
    map.get(r.plan).push(r);
  }
  return map;
}
