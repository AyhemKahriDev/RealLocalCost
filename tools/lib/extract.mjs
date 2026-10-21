/* ============================================================
   extract.mjs — price extraction for The Real Local Cost
   ------------------------------------------------------------
   ZERO DEPENDENCIES. Node built-ins only.

   Design note: this module never *decides* what a number means.
   It proposes candidates; a human confirms the plan mapping.
   That split is deliberate — see README "The honesty model".
   ============================================================ */

/* ---------- digit normalisation ---------- */

/* Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) → ASCII */
import { classify, DISTINCTIVE, AMBIGUOUS, KNOWN_CODES, containsSymbol } from "./currencies.mjs";

const AR_DIGITS = /[٠-٩۰-۹]/g;
const AR_DECIMAL = "٫";

export function normalizeDigits(input) {
  if (input == null) return "";
  let s = String(input);
  s = s.replace(AR_DIGITS, (c) => {
    const code = c.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
  s = s.split(AR_DECIMAL).join(".");
  return s;
}

/* ---------- number parsing ---------- */

/**
 * Parse a human-formatted number. Handles "1,50" (EU), "1,299.00" (US),
 * "1 299" (fr-CH), "1.299" (de). Returns null when it is not a number.
 */
export function parseNumber(raw) {
  if (raw == null) return null;
  let s = normalizeDigits(raw).replace(/[\s  ]/g, "");
  s = s.replace(/[^\d.,\-+]/g, "");
  if (!s) return null;

  const neg = s.startsWith("-");
  if (neg || s.startsWith("+")) s = s.slice(1);

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  if (lastDot >= 0 && lastComma >= 0) {
    // The rightmost separator is the decimal one.
    const dec = Math.max(lastDot, lastComma);
    const thou = Math.min(lastDot, lastComma);
    if (thou > 0) s = s.slice(0, thou) + s.slice(thou + 1);
    s = s.slice(0, dec) + "." + s.slice(dec + 1);
  } else if (lastComma >= 0) {
    const tail = s.length - lastComma - 1;
    // "1,50" → decimal.  "1,500" → thousands.  "1,234,567" → thousands.
    const groups = s.split(",");
    const allGroups3 = groups.slice(1).every((g) => g.length === 3);
    s = tail === 3 && (groups.length > 2 || allGroups3) && groups.length > 2
      ? groups.join("")
      : allGroups3 && groups.length > 2
        ? groups.join("")
        : s.replace(",", ".");
    if (groups.length > 2) s = groups.join("");
    else if (tail === 3) s = groups.join("");
  } else if (lastDot >= 0) {
    const tail = s.length - lastDot - 1;
    const groups = s.split(".");
    if (groups.length > 2) s = groups.join("");
    else if (tail === 3) s = groups.join("");
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/* ---------- currencies ---------- */

/* ---------- currencies ---------- */

/* The classification rules live in currencies.mjs: the market's own
   symbol wins, a currency code beats a symbol, a symbol only one
   currency uses beats a shared one, and anything unclassifiable stays
   unknown rather than being guessed. */
export { KNOWN_CODES, containsSymbol };
export const detectCurrency = classify;

/* ---------- plan keywords (EN / FR / AR) ---------- */

export const PLAN_KEYWORDS = {
  individual: [
    "premium individual", "premium individuel", "premium personnel", "premium solo",
    "personnel", "individuel", "individual", "un compte", "1 compte",
    "للأفراد", "فرد", "فردي", "اشتراك فردي",
  ],
  duo: ["premium duo", "duo", "deux comptes", "2 comptes", "للزوجين", "زوجي"],
  family: [
    "premium famille", "premium family", "famille", "family", "jusqu'à 6 comptes",
    "up to 6 accounts", "للعائلة", "عائلي", "أسرة",
  ],
  student: [
    "premium étudiant", "premium student", "étudiant", "student",
    "للطلاب", "طالب", "طلابي",
  ],
  adfree: ["sans pub", "no ads", "ad-free", "adfree", "بدون إعلانات", "خالي من الإعلانات"],
  withads: [
    "avec publicité", "with ads", "ads", "pub", "بالإعلانات", "إعلانات",
  ],
  basic: ["basic", "basique", "أساسي", "بالأساس"],
  standard: ["standard", "standart", "قياسي"],
  premium: ["premium", "بريميوم", "مميز"],
  mobile: ["mobile", "جوال", "هاتف", "الهاتف"],
  pro: ["pro", "pro+", "برو"],
  team: ["team", "business", "équipe", "فريق", "أعمال"],
  platinum: ["premium platinum", "platinum", "بلاتينيوم", "platine"],
  free: ["free", "gratuit", "مجاني"],
};

const PLAN_ALIASES = {
  individual: "individual",
  duo: "duo",
  family: "family",
  student: "student",
  adfree: "adfree",
  withads: "withads",
  basic: "basic",
  standard: "standard",
  premium: "premium",
  mobile: "mobile",
  pro: "pro",
  team: "team",
  platinum: "platinum",
  free: "free",
};

/**
 * Find the plan mentioned closest to a price occurrence.
 *
 * The distance matters as much as the name. "Premium Duo 16,50 DT" is a
 * strong signal; a plan name 200 characters away, with three other prices
 * in between, is not. We look at every plan name in the surrounding text
 * and take the one whose distance from the number is smallest, in either
 * direction — pricing copy puts the name before the price most of the
 * time, but not always.
 *
 * @param {string} context   text around the number
 * @param {number} numPos    where the number sits inside that context
 * @param {number} window    how far a plan name may be and still count
 * @param {string[]|null} planIds  scope to the plans the service has
 * @returns {{plan:string, dist:number}|null}
 */
export function guessPlanWithDistance(context, numPos, window = 90, planIds = null) {
  if (!context) return null;
  const text = normalizeDigits(context).toLowerCase();
  let best = null;

  for (const [plan, words] of Object.entries(PLAN_KEYWORDS)) {
    if (planIds && !planIds.includes(plan)) continue;
    for (const w of words) {
      let idx = text.indexOf(w);
      while (idx !== -1) {
        const centre = idx + w.length / 2;
        const dist = Math.abs(centre - numPos);
        if (dist <= window && (!best || dist < best.dist)) {
          best = { plan: PLAN_ALIASES[plan], dist };
        }
        idx = text.indexOf(w, idx + 1);
      }
    }
  }
  return best;
}

/** Just the plan id, for callers that do not care how far away it was. */
export function guessPlan(context, window = 70, planIds = null) {
  const g = guessPlanWithDistance(context, context.length / 2, window, planIds);
  return g ? g.plan : null;
}


/* Every plan name in the text, in reading order. */
function namesInOrder(text, planIds) {
  const lower = text.toLowerCase();
  const out = [];
  for (const [plan, words] of Object.entries(PLAN_KEYWORDS)) {
    if (planIds && !planIds.includes(plan)) continue;
    for (const w of words) {
      let idx = lower.indexOf(w);
      while (idx !== -1) {
        out.push({ plan: PLAN_ALIASES[plan], pos: idx, centre: idx + w.length / 2 });
        idx = lower.indexOf(w, idx + 1);
      }
    }
  }
  out.sort((a, b) => a.pos - b.pos);
  /* Collapse repeats of the same name a few characters apart. */
  const collapsed = [];
  for (const n of out) {
    const prev = collapsed[collapsed.length - 1];
    if (prev && prev.plan === n.plan && n.pos - prev.pos < 12) continue;
    collapsed.push(n);
  }
  return collapsed;
}

/**
 * Pair names with prices, keeping the order.
 *
 * The objective is lexicographic: make as many pairs as possible, and
 * among the pairings that do that, make them as close as possible.
 * (Minimising distance alone would be satisfied by pairing nothing at
 * all, which is not the point.)
 *
 * Dynamic program over (name index, price index).
 * Returns a map from price position to { plan, dist }.
 */
function assignMonotonic(names, hits, maxDist) {
  const out = new Map();
  const m = names.length;
  const k = hits.length;
  if (!m || !k) return out;

  const count = Array.from({ length: m + 1 }, () => new Int32Array(k + 1).fill(-1));
  const cost = Array.from({ length: m + 1 }, () => new Float64Array(k + 1).fill(Infinity));
  const choice = Array.from({ length: m + 1 }, () => new Int8Array(k + 1).fill(0));

  for (let j = 0; j <= k; j++) {
    count[m][j] = 0;
    cost[m][j] = 0;
  }
  for (let i = 0; i <= m; i++) {
    count[i][k] = 0;
    cost[i][k] = 0;
  }

  const better = (c1, d1, c2, d2) => (c1 !== c2 ? c1 > c2 : d1 < d2);

  for (let i = m - 1; i >= 0; i--) {
    for (let j = k - 1; j >= 0; j--) {
      /* skip this price */
      let bestC = count[i][j + 1];
      let bestD = cost[i][j + 1];
      let bestCh = 0;
      /* skip this name */
      if (better(count[i + 1][j], cost[i + 1][j], bestC, bestD)) {
        bestC = count[i + 1][j];
        bestD = cost[i + 1][j];
        bestCh = 1;
      }
      /* pair them */
      const d = Math.abs(names[i].centre - hits[j].pos);
      if (d <= maxDist) {
        const c = count[i + 1][j + 1] + 1;
        const k2 = cost[i + 1][j + 1] + d;
        if (better(c, k2, bestC, bestD)) {
          bestC = c;
          bestD = k2;
          bestCh = 2;
        }
      }
      count[i][j] = bestC;
      cost[i][j] = bestD;
      choice[i][j] = bestCh;
    }
  }

  let i = 0;
  let j = 0;
  while (i < m && j < k) {
    const c = choice[i][j];
    if (c === 2) {
      out.set(hits[j].pos, { plan: names[i].plan, dist: Math.abs(names[i].centre - hits[j].pos) });
      i++;
      j++;
    } else if (c === 0) {
      j++;
    } else {
      i++;
    }
  }
  return out;
}

/* ---------- the extractor ---------- */

const TAG_RE = /<[^>]+>/g;
const SCRIPT_RE = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
const STYLE_RE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;

/* A plan name further than this from a price is not that price's name. */
const NAME_MAX_DISTANCE = 60;

const NUM = String.raw`\d{1,3}(?:[ , . ]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;

/**
 * Extract price candidates from an HTML document.
 *
 * @param {string} html
 * @param {object} opts
 * @param {string} opts.market       market code, for currency disambiguation
 * @param {string} opts.currency     market default currency
 * @param {string[]} opts.currencySymbols  extra symbols to look for
 * @returns {Array<{value:number,currency:string,raw:string,plan:?string,context:string}>}
 */
export function extractPrices(html, opts = {}) {
  const marketObj = typeof opts.market === "object" && opts.market ? opts.market : null;
  const marketCode = marketObj ? marketObj.code : (opts.market || "");
  const currency = marketObj ? marketObj.currency : (opts.currency || "USD");
  const { planIds = null, currencySymbols = [] } = opts;
  const aliases = marketObj ? marketObj.aliases : null;
  const ownSymbol = marketObj ? marketObj.symbol : null;
  const syms = [
    ...new Set([
      ...currencySymbols,
      ...(ownSymbol ? [ownSymbol] : []),
      ...Object.values(DISTINCTIVE).flat(),
      ...Object.values(AMBIGUOUS).flat(),
      ...KNOWN_CODES,
    ]),
  ];
  // Longest first so "US$" wins over "$", "د.م." over "م".
  syms.sort((a, b) => b.length - a.length);
  const symRe = syms.map(escapeRe).join("|");
  const re = new RegExp(`(?:${symRe})\\s*(${NUM})|(${NUM})\\s*(?:${symRe})`, "g");

  const results = [];
  const seen = new Set();

  const add = (raw, context, numPos, assignment, dist, before = "", after = "") => {
    const value = parseNumber(raw);
    if (value == null || value <= 0 || value > 100000) return;
    const cur = detectCurrency(context, { currency, symbol: ownSymbol, aliases });
    const g = assignment ? { plan: assignment.plan, dist } : null;
    const key = `${value}|${cur}|${g ? g.plan : ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({
      value: Math.round(value * 100) / 100,
      currency: cur,
      raw: normalizeDigits(raw).trim(),
      plan: g ? g.plan : null,
      planDist: g ? g.dist : null,
      before: normalizeDigits(before).replace(/\s+/g, " ").trim(),
      after: normalizeDigits(after).replace(/\s+/g, " ").trim(),
      context: normalizeDigits(context).replace(/\s+/g, " ").trim().slice(-260),
    });
  };

  // 1) Visible text (tags stripped) — the primary source.
  const visible = String(html || "")
    .replace(SCRIPT_RE, " ")
    .replace(STYLE_RE, " ")
    .replace(TAG_RE, " ");
  scan(visible);

  // 2) Embedded JSON payloads — Spotify and friends ship "price":"…" blobs.
  const scripts = [];
  let m;
  SCRIPT_RE.lastIndex = 0;
  while ((m = SCRIPT_RE.exec(String(html || "")))) scripts.push(m[1]);
  for (const s of scripts) {
    const re2 = new RegExp(`"price"\\s*:\\s*"([^"]{0,40})"`, "g");
    let mm;
    while ((mm = re2.exec(s))) {
      const around = s.slice(Math.max(0, mm.index - 400), mm.index + 60);
      const val = parseNumber(mm[1]);
      if (val == null || val <= 0) continue;
      const cur = detectCurrency(mm[1], { currency, symbol: ownSymbol, aliases });
      /* The price sits inside the JSON, so the words around it are the
         JSON around it: "duration":"3 months" before, "checkoutUrl"
         after. */
      const pStart = around.length - 60;
      const jsonBefore = around.slice(Math.max(0, pStart - 110), pStart);
      const jsonAfter = around.slice(pStart, pStart + 32);
      const g2 = guessPlanWithDistance(around, around.length / 2, 90, planIds);
      const key = `${Math.round(val * 100) / 100}|${cur}|${g2 ? g2.plan : ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        value: Math.round(val * 100) / 100,
        currency: cur,
        raw: normalizeDigits(mm[1]).trim(),
        plan: g2 ? g2.plan : null,
        planDist: g2 ? g2.dist : null,
        before: normalizeDigits(jsonBefore).replace(/\s+/g, " ").trim(),
        after: normalizeDigits(jsonAfter).replace(/\s+/g, " ").trim(),
        context: normalizeDigits(around).replace(/\s+/g, " ").trim().slice(-260),
      });
    }
  }

  /* How often is each price quoted? A monthly price is repeated in the
     plan card, the price list and the FAQ; a prepaid bundle total is
     mentioned once. The number a page repeats is the price of the
     plan; the one it mentions in passing is usually something else. */
  const counts = new Map();
  for (const r of results) {
    const k = `${r.plan || "?"}|${r.value}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  for (const r of results) {
    r.quoted = counts.get(`${r.plan || "?"}|${r.value}`) || 1;
  }

  results.sort((a, b) => a.value - b.value);
  return results;

  function scan(text) {
    /* Pass 1 — every price in the text, with its position. */
    const hits = [];
    let mm;
    re.lastIndex = 0;
    while ((mm = re.exec(text))) {
      const raw = mm[1] || mm[2];
      if (!raw) continue;
      const value = parseNumber(raw);
      if (value == null || value <= 0 || value > 100000) continue;
      hits.push({ raw, value, pos: mm.index + mm[0].indexOf(raw) });
    }
    if (!hits.length) return;

    /* Pass 2 and 3 — pair plan names with prices.

       In a price list the names and the prices run in the same order, so
       the pairing has to be MONOTONIC: if "Premium Duo" is the second
       name, it is the second price. Finding the pairing that minimises
       total distance while staying in order is a small dynamic program,
       and it is what keeps "Premium Personnel 12,50" from being read as
       the plan for the price on the far side of "Premium Duo".

       The greedy nearest-neighbour version of this gets it wrong on
       exactly the pages that matter. This does not. */
    const names = namesInOrder(text, planIds);
    const assignment = assignMonotonic(names, hits, NAME_MAX_DISTANCE);

    /* Pass 4 — build the candidates. */
    for (const h of hits) {
      const a = assignment.get(h.pos);
      const ctxStart = Math.max(0, h.pos - 160);
      const ctxEnd = Math.min(text.length, h.pos + 120);
      const context = text.slice(ctxStart, ctxEnd);
      /* The words immediately before a number say what it is ("for 6
         months, 22,50 MAD"); the words immediately after say what
         happens next ("45 MAD/mois ensuite" — and then). Keeping the
         two apart is what separates a standing price from a
         promotional one. */
      const before = text.slice(Math.max(0, h.pos - 110), h.pos);
      const after = text.slice(h.pos, Math.min(text.length, h.pos + 32));
      add(h.raw, context, h.pos - ctxStart, a && !a.ambiguous ? a : null, a ? a.dist : null, before, after);
    }
  }
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
