#!/usr/bin/env node
/* ============================================================
   check.mjs — the data integrity gate
   ------------------------------------------------------------
   Run before every build and in CI. Catches the mistakes that would
   otherwise ship a wrong number with a receipt attached:

     · a row with no verification date
     · a row with no receipt
     · a history that goes backwards in time
     · a price that is obviously wrong
     · a row for a market that has no income denominator
     · two rows claiming to be the same plan in the same market

     node tools/check.mjs
   ============================================================ */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const errors = [];
const warnings = [];

function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

async function readJson(rel, fallback = null) {
  try {
    return JSON.parse(await readFile(join(ROOT, rel), "utf8"));
  } catch (e) {
    if (fallback !== null) return fallback;
    err(`cannot read ${rel}: ${e.message}`);
    return null;
  }
}

const servicesRaw = await readJson("data/services.json");
const marketsRaw = await readJson("data/markets.json");
const pricesRaw = await readJson("data/prices.json", { rows: [] });
const incomeRaw = await readJson("data/income.json", { markets: {} });
const alternativesRaw = await readJson("data/alternatives.json", { entries: [] });

const services = servicesRaw ? servicesRaw.services : {};
const markets = marketsRaw ? marketsRaw.markets : {};
const rows = pricesRaw.rows || [];

const seen = new Set();
const ISO = /^\d{4}-\d{2}-\d{2}$/;

for (const [i, r] of rows.entries()) {
  const at = `row ${i} (${r.service}/${r.market}/${r.plan})`;

  if (!services[r.service]) err(`${at}: unknown service`);
  if (!markets[r.market]) err(`${at}: unknown market`);
  if (!r.plan) err(`${at}: no plan id`);

  const key = `${r.service}|${r.market}|${r.plan}`;
  if (seen.has(key)) err(`${at}: duplicate row for the same service, market and plan`);
  seen.add(key);

  if (typeof r.price !== "number" || !Number.isFinite(r.price)) err(`${at}: price is not a number`);
  else if (r.price <= 0) err(`${at}: price is not positive`);
  else {
    /* A ceiling in dollars would be wrong: one dollar is sixteen
       thousand rupiah. The only meaningful ceiling is the one that
       matters — a subscription nobody could afford. */
    const inc = (incomeRaw.markets || {})[r.market];
    const monthly = inc && inc.latest ? inc.latest.monthly : null;
    if (monthly && r.price > monthly * 500) {
      err(`${at}: price is ${r.price} ${r.currency} — over 500 months of income (${monthly})`);
    } else if (!monthly && r.price > 100000) {
      err(`${at}: price looks wrong (${r.price})`);
    }
  }

  if (!r.currency) err(`${at}: no currency`);
  else if (r.currency !== markets[r.market]?.currency) {
    warn(`${at}: currency ${r.currency} differs from the market currency ${markets[r.market]?.currency}`);
  }

  if (!r.verified) err(`${at}: no verification date`);
  else if (!ISO.test(r.verified)) err(`${at}: verification date is not YYYY-MM-DD`);

  if (!r.receipt || !r.receipt.url) err(`${at}: no receipt URL`);

  if (!Array.isArray(r.history) || r.history.length === 0) {
    warn(`${at}: no history points`);
  } else {
    let lastDate = "";
    for (const h of r.history) {
      if (!ISO.test(h.date || "")) err(`${at}: history date is not YYYY-MM-DD (${h.date})`);
      if (lastDate && h.date < lastDate) err(`${at}: history goes backwards (${lastDate} → ${h.date})`);
      lastDate = h.date;
      if (typeof h.price !== "number" || h.price <= 0) err(`${at}: history price is not a positive number`);
    }
    const last = r.history[r.history.length - 1];
    if (r.verified && last.price !== r.price) {
      warn(`${at}: current price ${r.price} differs from the last history point ${last.price} (${last.date})`);
    }
  }

  const inc = incomeRaw.markets[r.market];
  if (!inc || !inc.latest || !inc.latest.monthly) {
    err(`${at}: no income denominator for market ${r.market} — run \`npm run income\``);
  }
}

/* every market referenced in alternatives must exist */
for (const a of alternativesRaw.entries || []) {
  if (!markets[a.market]) err(`alternative "${a.name}": unknown market ${a.market}`);
}

/* income coverage */
for (const code of Object.keys(markets)) {
  const inc = incomeRaw.markets[code];
  if (!inc) {
    warn(`market ${code}: no income series (only a problem if it has price rows)`);
    continue;
  }
  if (!inc.series || inc.series.length < 3) warn(`market ${code}: income series is very short`);
}

/* the build output should exist and be complete */
try {
  const sitemap = await readFile(join(ROOT, "site", "sitemap.xml"), "utf8");
  const urls = (sitemap.match(/<loc>/g) || []).length;
  if (urls === 0) err("site/sitemap.xml has no URLs — did the build run?");
  else console.log(`sitemap: ${urls} URLs`);
} catch {
  warn("site/ not built yet — run `npm run build`");
}

/* every internal link must resolve to a real file */
try {
  const { readdir, stat } = await import("node:fs/promises");
  const { join: j } = await import("node:path");

  async function walk(dir, out = []) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = j(dir, e.name);
      if (e.isDirectory()) await walk(p, out);
      else if (e.name.endsWith(".html")) out.push(p);
    }
    return out;
  }

  const files = await walk(join(ROOT, "site"));
  let checked = 0;
  const broken = new Set();

  for (const f of files) {
    const html = await readFile(f, "utf8");
    for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
      const href = m[1];
      if (href.startsWith("/assets/") || href.startsWith("/data/")) continue;
      const target = href.endsWith("/")
        ? j(ROOT, "site", href, "index.html")
        : j(ROOT, "site", href);
      checked++;
      let ok = false;
      try {
        const s = await stat(target);
        ok = s.isFile() || (s.isDirectory() && false);
      } catch {
        ok = false;
      }
      if (!ok) broken.add(`${href}  (from ${f.replace(join(ROOT, "site"), "")})`);
    }
  }

  if (broken.size) {
    for (const b of [...broken].slice(0, 25)) err(`broken link: ${b}`);
    if (broken.size > 25) err(`…and ${broken.size - 25} more broken links`);
  }
  console.log(`links: ${checked} internal hrefs checked across ${files.length} pages`);
} catch (e) {
  warn(`link check skipped: ${e.message}`);
}

console.log(`\n${rows.length} rows, ${errors.length} error(s), ${warnings.length} warning(s)`);
for (const w of warnings) console.log(`  warn  ${w}`);
for (const e of errors) console.log(`  ERROR ${e}`);
if (errors.length) process.exit(1);
