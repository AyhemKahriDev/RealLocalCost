#!/usr/bin/env node
/* ============================================================
   auto-update.mjs — the site keeps itself current
   ------------------------------------------------------------
   The rule the rest of this project is built on still holds: the
   machine never invents a price. But a machine CAN notice that the
   page it read yesterday says something different today, and it CAN
   read that difference reliably enough to publish it.

   So this tool draws a line:

     CONFIDENT  → the price is written, with the receipt and the date
     UNSURE     → an alert is raised for a human

   A price is CONFIDENT when all of these hold:

     1. It is quoted in the market's own currency. A page that shows
        a dollar price to a Tunisian subscriber is not a Tunisian
        price, and it is never published as one.
     2. A plan name sits next to it, so we know WHICH plan it is.
     3. It is within a plausible band of the last price we published
        for that plan. Prices move; they do not teleport.
     4. No other plan in the same market claims the same number on
        the same scrape. One price belongs to one plan.

   Anything that fails a rule is escalated rather than guessed.

     node tools/auto-update.mjs
     node tools/auto-update.mjs --service=spotify --market=fr
     node tools/auto-update.mjs --dry-run
   ============================================================ */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchText } from "./lib/http.mjs";
import { extractPrices } from "./lib/extract.mjs";
import { loadRegistry, marketObj, watchPairs } from "./lib/registry.mjs";
import { cacheGetOrSet } from "./lib/cache.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* How far a price may move before we stop trusting ourselves. */
const MIN_RATIO = 0.4;
const MAX_RATIO = 2.5;

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
}

const DRY = process.argv.includes("--dry-run");
const SERVICE_FILTER = arg("service");
const MARKET_FILTER = arg("market");
const TODAY = new Date().toISOString().slice(0, 10);


/* ============================================================
   Reading a price off a page
   ------------------------------------------------------------
   A pricing page says several numbers about the same plan: the
   standing monthly price, an introductory rate, a prepaid bundle
   total, and a yearly equivalent. They are told apart by the words
   around them.

     before the number   after the number
     "pendant 6 mois"    "puis 45 MAD/mois"        → standing price
     "pour 2 mois"       "/mois ensuite"           → the same price, promoted
     "duration: 3 months"                           → a bundle, not a month
   ============================================================ */

const INTRO_BEFORE = /(pendant|pour\s+\d|intro|offre|essai|trial|gratuit|free|promo|\bfor\s+\d|جرب|لفترة)/i;
const STANDING_AFTER = /(ensuite|puis|thereafter|بعد)/i;
/* A bundle: the page says how long the price covers. An introductory
   window ("for 2 months") is NOT a bundle — it is the same monthly
   price, promoted. */
const LONG_PERIOD = /"duration"\s*:\s*"\s*([3-9]|1[0-2])\s*(?:شهور|mo\b|months?)|\b1\s*(?:an|année|year)\b|\b2\s*ans\b|\b12\s*(?:mois|months?)\b|\b[3-9]\s*شهور\b/i;
const MONTHLY = /(شهر\s*1\b|1\s*mois|1\s*month|\/mois|\/mo\b|\bmois\b|\bmonth\b|شهري)/i;
/* A one-off payment is not the recurring price, even when it is for one
   month. "39 EGP a month after that" is the price; "43 EGP for one
   month, paid once" is a top-up. */
/* A one-off payment. Matched on the precise phrase: "Spotify Free" in
   a navigation bar is not a prepaid plan. */
const PREPAID = /(prepaidOption|"prepaid"|prépay|دفع(?:ة)?\s*مرة\s*واحدة|paiement\s+unique|one[-\s]?time|paying\s+once)/i;

/**
 * Score a candidate for "this is the monthly price of that plan".
 * Higher is better. The `quoted` count is part of the score because a
 * page repeats the price it means.
 */
function monthlyScore(c) {
  let s = c.quoted || 1;
  const before = c.before || "";
  const after = c.after || "";
  /* A promotional rate is only a soft penalty: on some pages the
     introductory price and the standing price are the same number. */
  if (INTRO_BEFORE.test(before)) s -= 2;
  if (STANDING_AFTER.test(after)) s += 3;
  if (MONTHLY.test(after)) s += 2;
  return s;
}

/**
 * A bundle total or a one-off payment is never the monthly price, no
 * matter how the page words it. These are rejected outright rather
 * than merely out-scored.
 */
function isBundle(c) {
  const around = `${c.before || ""} ${c.after || ""}`;
  return LONG_PERIOD.test(around) || PREPAID.test(around);
}

async function readJson(p, fallback) {
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return fallback;
  }
}

/**
 * Score a candidate against what we already know.
 * Returns { ok, reason, confidence, price }
 */
function judge(cand, existing, market, claimedValues) {
  if (!existing) {
    /* A price we have never published: the bar is higher. We need the
       currency and a plan, and we will not accept a value that another
       plan is also claiming. */
    if (cand.currency !== market.currency) {
      return { ok: false, reason: `currency ${cand.currency} is not ${market.currency}`, confidence: 0 };
    }
    if (!cand.plan) return { ok: false, reason: "no plan name next to the price", confidence: 20 };
    if (claimedValues.has(cand.value)) {
      return { ok: false, reason: "another plan claims the same number", confidence: 30 };
    }
    return { ok: true, reason: "new price, currency and plan confirmed", confidence: 80 };
  }

  if (cand.currency !== market.currency) {
    return { ok: false, reason: `currency ${cand.currency} is not ${market.currency}`, confidence: 0 };
  }
  if (!cand.plan) return { ok: false, reason: "no plan name next to the price", confidence: 20 };
  if (cand.plan !== existing.plan) {
    return { ok: false, reason: `plan guess ${cand.plan} does not match ${existing.plan}`, confidence: 25 };
  }
  const ratio = cand.value / existing.price;
  if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
    return {
      ok: false,
      reason: `price moved from ${existing.price} to ${cand.value} (${ratio.toFixed(2)}x) — too far to trust`,
      confidence: 40,
    };
  }

  if (cand.value === existing.price) {
    return { ok: true, reason: "unchanged", confidence: 100, unchanged: true };
  }
  return {
    ok: true,
    reason: `moved from ${existing.price} to ${cand.value}`,
    confidence: 90,
  };
}

async function main() {
  const reg = await loadRegistry();
  const pricesRaw = await readJson(join(ROOT, "data", "prices.json"), { rows: [] });
  const alertsRaw = await readJson(join(ROOT, "data", "alerts.json"), { alerts: [] });

  const rows = pricesRaw.rows || [];
  const byKey = new Map();
  for (const r of rows) byKey.set(`${r.service}|${r.market}|${r.plan}`, r);

  const newAlerts = [];
  const updates = [];
  let fetched = 0;
  let checked = 0;
  let unchanged = 0;

  const pairs = watchPairs(reg).filter(
    (p) =>
      (!SERVICE_FILTER || p.service === SERVICE_FILTER) &&
      (!MARKET_FILTER || p.market === MARKET_FILTER) &&
      reg.services[p.service].source !== "wayback"
  );

  for (const { service: sid, market: mid } of pairs) {
    const svc = reg.services[sid];
    const m = marketObj(reg, mid);
    if (!m) continue;

    const url = svc.pricingUrl
      .replace("{cc}", m.cc)
      .replace("{ccUpper}", m.cc.toUpperCase())
      .replace("{lang}", (reg.markets[mid].langs || ["en"])[0])
      .replace("{tld}", reg.markets[mid].tld || m.cc)
      .replace("{currency}", m.currency);

    fetched++;
    const r = await fetchText(url, { timeout: 30000, retries: 1 });
    if (!r.ok) {
      newAlerts.push({
        type: "fetch-failed",
        date: TODAY,
        service: sid,
        market: mid,
        url,
        note: `Could not read the page (${r.status || r.error}). The published price is still the last verified one.`,
      });
      continue;
    }

    const candidates = extractPrices(r.body, {
      market: m,
      planIds: (svc.plans || []).map((p) => p.id),
    });

    /* only prices in the market's own currency are even candidates */
    const local = candidates.filter((c) => c.currency === m.currency);
    if (!local.length) continue;

    /* One price belongs to one plan. If two DIFFERENT plans claim the
       same number on this scrape, neither of them can be trusted from
       it — a price we already published for that plan is still fine,
       because that pairing was confirmed by a human. */
    const byValue = new Map();
    for (const c of local) {
      if (!c.plan) continue;
      if (!byValue.has(c.value)) byValue.set(c.value, new Set());
      byValue.get(c.value).add(c.plan);
    }
    const ambiguous = new Set(
      [...byValue.entries()].filter(([, plans]) => plans.size > 1).map(([v]) => v)
    );

    /* For each plan there is usually one standing monthly price and a
       crowd of other numbers. The winner has to win DECISIVELY: if two
       candidates score the same, the page has not actually told us
       which one the plan costs, and a human has to look. */
    const byPlan = new Map();
    for (const c of local) {
      if (!c.plan) continue;
      if (!byPlan.has(c.plan)) byPlan.set(c.plan, []);
      byPlan.get(c.plan).push(c);
    }
    const chosen = [];
    for (const [plan, cs] of byPlan) {
      const scored = cs.map((c) => ({ c, score: monthlyScore(c) }));
      scored.sort((a, b) => b.score - a.score);
      const top = scored[0];
      const second = scored[1];
      /* one candidate for the plan: nothing to compare it against, so
         it wins by default */
      const margin = second ? top.score - second.score : Infinity;
      /* A bundle total or a one-off payment is not the monthly price,
         whatever else it might be. If that is all the page offers for
         this plan, a human has to find the real one. */
      if (isBundle(top.c)) {
        newAlerts.push({
          type: "needs-a-human",
          date: TODAY,
          service: sid,
          market: mid,
          plan,
          url,
          note: `The only number tied to this plan on the page is a bundle or a one-off payment (${top.c.value} ${top.c.currency}). The standing monthly price was not found in the text.`,
        });
        continue;
      }
      if (margin < 2) {
        /* too close to call */
        newAlerts.push({
          type: "needs-a-human",
          date: TODAY,
          service: sid,
          market: mid,
          plan,
          url,
          note: `The page offers several prices for this plan (${scored
            .slice(0, 4)
            .map((x) => `${x.c.value} (${x.c.currency}, score ${x.score})`)
            .join(", ")}). Too close to call from the text alone.`,
        });
        continue;
      }
      chosen.push(top.c);
    }

    for (const c of chosen) {
      if (!c.plan) continue;
      const key = `${sid}|${mid}|${c.plan}`;
      const existing = byKey.get(key);
      /* an ambiguous number is only trusted when it is the price we
         already published for this very plan */
      if (ambiguous.has(c.value) && !(existing && existing.price === c.value)) {
        newAlerts.push({
          type: "needs-a-human",
          date: TODAY,
          service: sid,
          market: mid,
          plan: c.plan,
          price: c.value,
          currency: c.currency,
          url,
          note: `Two plans claim ${c.value} ${c.currency} on the same page, so neither can be read from it.`,
          context: c.context,
        });
        continue;
      }
      const verdict = judge(c, existing, m, new Set());
      checked++;

      if (!verdict.ok) {
        newAlerts.push({
          type: "needs-a-human",
          date: TODAY,
          service: sid,
          market: mid,
          plan: c.plan,
          price: c.value,
          currency: c.currency,
          url,
          note: `${verdict.reason}. Last published: ${existing ? existing.price + " " + existing.currency : "none"}.`,
          context: c.context,
        });
        continue;
      }

      if (verdict.unchanged) {
        unchanged++;
        if (existing && existing.verified !== TODAY) {
          existing.verified = TODAY;
          updates.push({ service: sid, market: mid, plan: c.plan, kind: "re-verified", price: c.value });
        }
        continue;
      }

      /* CONFIDENT: publish it */
      const receipt = {
        url,
        kind: "live",
        archived: existing && existing.receipt ? existing.receipt.archived : undefined,
        archivedDate: existing && existing.receipt ? existing.receipt.archivedDate : undefined,
      };
      const history = (existing && existing.history ? existing.history : []).slice();
      const last = history[history.length - 1];
      if (!last || last.price !== c.value) history.push({ date: TODAY, price: c.value });

      if (existing) {
        existing.price = c.value;
        existing.history = history;
        existing.verified = TODAY;
        existing.receipt = receipt;
        updates.push({
          service: sid, market: mid, plan: c.plan, kind: "price-changed",
          from: last ? last.price : null, to: c.value,
        });
      } else {
        const row = {
          service: sid, market: mid, plan: c.plan, price: c.value,
          currency: m.currency, history, verified: TODAY, receipt,
          note: "Added automatically: the page showed this price in the market's own currency, next to a plan name, and no other plan claimed it.",
          addedBy: "auto",
        };
        rows.push(row);
        byKey.set(key, row);
        updates.push({ service: sid, market: mid, plan: c.plan, kind: "added", to: c.value });
      }
    }
  }

  console.log(
    `\nfetched ${fetched} pricing pages, judged ${checked} price claims: ` +
      `${updates.filter((u) => u.kind === "price-changed").length} changed, ` +
      `${updates.filter((u) => u.kind === "added").length} added, ` +
      `${unchanged} unchanged, ${newAlerts.length} need a human`
  );

  for (const u of updates) {
    console.log(
      `  ${u.kind.padEnd(13)} ${u.service}/${u.market}/${u.plan}` +
        (u.from != null ? ` ${u.from} → ${u.to}` : u.to != null ? ` ${u.to}` : "")
    );
  }
  for (const a of newAlerts.slice(0, 12)) {
    console.log(`  NEEDS HUMAN   ${a.service}/${a.market}${a.plan ? "/" + a.plan : ""} — ${a.note}`);
  }
  if (newAlerts.length > 12) console.log(`  …and ${newAlerts.length - 12} more`);

  if (DRY) {
    console.log("\n(dry run — nothing written)");
    return;
  }

  pricesRaw.rows = rows;
  pricesRaw.updatedAt = TODAY;
  await writeFile(join(ROOT, "data", "prices.json"), JSON.stringify(pricesRaw, null, 2) + "\n");

  const merged = [...newAlerts, ...(alertsRaw.alerts || []).filter((a) => a.status !== "resolved")].slice(0, 500);
  await writeFile(
    join(ROOT, "data", "alerts.json"),
    JSON.stringify(
      {
        _comment:
          "Generated by tools/auto-update.mjs. The machine publishes what it is confident about and escalates the rest. Do not hand-edit.",
        generatedAt: new Date().toISOString(),
        alerts: merged,
      },
      null,
      2
    ) + "\n"
  );

  console.log("\nwrote data/prices.json and data/alerts.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
