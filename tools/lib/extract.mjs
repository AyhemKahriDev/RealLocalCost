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

/**
 * Currency detectors, most specific first.
 * `hint` = the market's default currency, used when a symbol is ambiguous
 * (a bare "$" means USD in TN and ARS in AR).
 */
export const CURRENCIES = {
  TND: { symbols: ["TND", "DT", "د.ت", "دينار"], ambiguous: false },
  EGP: { symbols: ["EGP", "ج.م", "ج.م.", "LE", "E£", "جنيه"], ambiguous: false },
  EUR: { symbols: ["EUR", "€"], ambiguous: false },
  USD: { symbols: ["US$", "USD", "$"], ambiguous: true },
  MAD: { symbols: ["MAD", "DH", "د.م."], ambiguous: false },
  SAR: { symbols: ["SAR", "ر.س", "ريال"], ambiguous: false },
  AED: { symbols: ["AED", "د.إ"], ambiguous: false },
  TRY: { symbols: ["TRY", "₺", "TL"], ambiguous: false },
  ARS: { symbols: ["ARS"], ambiguous: false },
  JOD: { symbols: ["JOD"], ambiguous: false },
  DZD: { symbols: ["DZD"], ambiguous: false },
  GBP: { symbols: ["GBP", "£"], ambiguous: false },
};

const CURRENCY_ORDER = Object.keys(CURRENCIES);

/**
 * Find a currency in a price token.
 * @param {string} token e.g. "12,50 DT", "US$9.99", "EGP 49.99", "9,99 €"
 * @param {string} hint  market default currency code
 */
export function detectCurrency(token, hint) {
  const t = normalizeDigits(token);
  const compact = t.replace(/\s+/g, " ");
  for (const code of CURRENCY_ORDER) {
    const def = CURRENCIES[code];
    for (const sym of def.symbols) {
      if (compact.includes(sym)) {
        // A bare "$" is ambiguous; prefer the market hint.
        if (sym === "$" && hint && CURRENCIES[hint]) return hint;
        return code;
      }
    }
  }
  return hint || null;
}

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
 * Scans backwards first (EN/FR pricing copy usually reads
 * "Premium Personnel 12,50 DT"), then forwards.
 *
 * `planIds` scopes the search to the plans the service actually has, so
 * Spotify's "Premium" (the product tier) is not mistaken for a plan called
 * "premium" (Netflix, Disney+).
 */
export function guessPlan(context, window = 220, planIds = null) {
  if (!context) return null;
  const text = normalizeDigits(context).toLowerCase();
  const head = text.slice(Math.max(0, text.length - window));
  const tail = text.slice(0, Math.min(window, text.length));

  let best = null;
  let bestPos = -1;

  for (const [plan, words] of Object.entries(PLAN_KEYWORDS)) {
    if (planIds && !planIds.includes(plan)) continue;
    for (const w of words) {
      const i = head.lastIndexOf(w);
      if (i >= 0 && (bestPos < 0 || i > bestPos)) {
        bestPos = i;
        best = plan;
      }
    }
  }
  if (best) return PLAN_ALIASES[best];

  for (const [plan, words] of Object.entries(PLAN_KEYWORDS)) {
    if (planIds && !planIds.includes(plan)) continue;
    for (const w of words) {
      const i = tail.indexOf(w);
      if (i >= 0 && (bestPos < 0 || i < bestPos)) {
        bestPos = i;
        best = plan;
      }
    }
  }
  return best;
}

/* ---------- the extractor ---------- */

const TAG_RE = /<[^>]+>/g;
const SCRIPT_RE = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
const STYLE_RE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;

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
  const { market = "", currency = "USD", currencySymbols = [], planIds = null } = opts;
  const syms = [...new Set([...currencySymbols, ...Object.values(CURRENCIES).flatMap((c) => c.symbols)])];
  // Longest first so "US$" wins over "$", "د.م." over "م".
  syms.sort((a, b) => b.length - a.length);
  const symRe = syms.map(escapeRe).join("|");
  const re = new RegExp(`(?:${symRe})\\s*(${NUM})|(${NUM})\\s*(?:${symRe})`, "g");

  const results = [];
  const seen = new Set();

  const add = (raw, context) => {
    const value = parseNumber(raw);
    if (value == null || value <= 0 || value > 100000) return;
    const cur = detectCurrency(context, currency);
    const key = `${value}|${cur}|${guessPlan(context, 220, planIds) || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({
      value: Math.round(value * 100) / 100,
      currency: cur,
      raw: normalizeDigits(raw).trim(),
      plan: guessPlan(context, 220, planIds),
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
      const cur = detectCurrency(mm[1], currency);
      const key = `${Math.round(val * 100) / 100}|${cur}|${guessPlan(around, 220, planIds) || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        value: Math.round(val * 100) / 100,
        currency: cur,
        raw: normalizeDigits(mm[1]).trim(),
        plan: guessPlan(around, 220, planIds),
        context: normalizeDigits(around).replace(/\s+/g, " ").trim().slice(-260),
      });
    }
  }

  results.sort((a, b) => a.value - b.value);
  return results;

  function scan(text) {
    let mm;
    re.lastIndex = 0;
    while ((mm = re.exec(text))) {
      const raw = mm[1] || mm[2];
      if (!raw) continue;
      const start = mm.index;
      const context = text.slice(Math.max(0, start - 200), Math.min(text.length, start + 90));
      add(raw, context);
    }
  }
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
