/* ============================================================
   currencies.mjs — knowing what a number is worth
   ------------------------------------------------------------
   The hard part of pricing things across markets is that price
   pages write money in symbols that collide: "$" means dollars in
   New York and pesos in Buenos Aires, "kr" means kronor in Sweden
   and kroner in Denmark, "Rs" means rupees in three different
   countries, and "R" is rand in Johannesburg and part of "Rp",
   "R$" and "RM" everywhere else.

   So the rule here is: THE MARKET WINS. A price is in the
   market's own currency unless the text says otherwise in a way
   that is unambiguous (a currency code, or a symbol only one
   currency uses).

   Anything we cannot classify is left unknown rather than
   guessed. An unknown currency is a missing row; a wrong one is
   a wrong number on a website.
   ============================================================ */

/** Symbols that only one currency uses — safe to match anywhere. */
export const DISTINCTIVE = {
  USD: ["US$", "USD"],
  EUR: ["€"],
  GBP: ["£"],
  JPY: ["¥", "￥"],
  CNY: ["CN", "元"],
  KRW: ["₩"],
  INR: ["₹"],
  RUB: ["₽", "руб"],
  ILS: ["₪", "₪"],
  TRY: ["₺"],
  THB: ["฿"],
  VND: ["₫"],
  NGN: ["₦"],
  PHP: ["₱"],
  UAH: ["₴"],
  IDR: ["Rp", "IDR"],
  PLN: ["zł"],
  CZK: ["Kč"],
  HUF: ["Ft"],
  MYR: ["RM"],
  KES: ["KSh"],
  BDT: ["৳", "ট"],
  NPR: ["रू", "रु"],
  CRC: ["₡"],
  PYG: ["₲"],
  GHS: ["₵"],
  ZMW: ["ZK"],
  MNT: ["₮"],
  LAK: ["₭"],
  KHR: ["៛"],
  AFN: ["؋"],
  IRR: ["﷼"],
  LBP: ["ل.ل"],
  SYP: ["£", "ل.س"],
  YER: ["﷼"],
  SDG: ["ج.س"],
  EGP: ["ج.م", "جنيه", "EGP"],
  SAR: ["ر.س", "ريال سعودي"],
  AED: ["د.إ", "درهم"],
  QAR: ["ر.ق"],
  KWD: ["د.ك"],
  BHD: ["د.ب"],
  OMR: ["ر.ع"],
  JOD: ["د.ا"],
  IQD: ["ع.د"],
  TND: ["د.ت", "دينار"],
  DZD: ["د.ج"],
  MAD: ["د.م."],
  LYD: ["د.ل"],
  KES2: ["KSh"],
  BRL: ["R$"],
  MXN: ["MX$"],
  TWD: ["NT$"],
  HKD: ["HK$"],
  SGD: ["S$"],
  NZD: ["NZ$"],
  AUD: ["A$", "AU$"],
  CAD: ["CA$", "C$"],
};

/** Symbols several currencies share. The market's own use wins. */
export const AMBIGUOUS = {
  USD: ["$", "US$"],
  SEK: ["kr"],
  NOK: ["kr"],
  DKK: ["kr"],
  ISK: ["kr"],
  PKR: ["Rs"],
  LKR: ["Rs"],
  INR2: ["Rs"],
  NGN2: ["₦"],
  ZAR: ["R"],
  MAD2: ["DH"],
  AED2: ["DH", "د.إ"],
  KES3: ["KSh"],
  JOD2: ["JD"],
  BRL2: ["BRL"],
  CHF: ["CHF"],
  RON: ["lei", "RON"],
  RUB2: ["RUB"],
  USD2: ["USD"],
  EUR2: ["EUR"],
  GBP2: ["GBP"],
  SEK2: ["SEK"],
  NOK2: ["NOK"],
  DKK2: ["DKK"],
  PKR2: ["PKR"],
  LKR2: ["LKR"],
  ZAR2: ["ZAR"],
  JPY2: ["JPY"],
  KRW2: ["KRW"],
  PLN2: ["PLN"],
  CZK2: ["CZK"],
  HUF2: ["HUF"],
  INR3: ["INR"],
  CAD2: ["CAD"],
  AUD2: ["AUD"],
  NZD2: ["NZD"],
  SGD2: ["SGD"],
  HKD2: ["HKD"],
  TWD2: ["TWD"],
  VND2: ["VND"],
  THB2: ["THB"],
  MYR2: ["MYR"],
  ILS2: ["ILS"],
  UAH2: ["UAH"],
  COP: ["COL$"],
  CLP: ["CLP$"],
  PEN: ["S/"],
  ARS: ["$"],
};

/**
 * Does the text contain this symbol, without matching it inside a
 * longer word? "R" must not match "Rp" or "Rs"; "Rs" must not match
 * "Rsomething".
 */
export function containsSymbol(text, sym) {
  if (!sym) return false;
  if (sym.length <= 2 && /[A-Za-z]/.test(sym)) {
    const esc = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^A-Za-z])${esc}($|[^A-Za-z])`).test(text);
  }
  return text.includes(sym);
}

/** All the currency codes we know about, for code matching. */
export const KNOWN_CODES = new Set([
  "USD", "EUR", "GBP", "TND", "EGP", "MAD", "SAR", "AED", "QAR", "KWD", "BHD", "OMR",
  "JOD", "IQD", "TRY", "ARS", "BRL", "MXN", "SEK", "NOK", "DKK", "ISK", "PLN", "CZK",
  "HUF", "INR", "PKR", "LKR", "NPR", "BDT", "IDR", "PHP", "NGN", "KES", "ZAR", "JPY",
  "KRW", "CNY", "TWD", "HKD", "SGD", "NZD", "AUD", "CAD", "VND", "THB", "ILS", "UAH",
  "RON", "CHF", "MYR", "DZD", "LYD", "SDG", "LBP", "SYP", "YER", "IRR", "AFN", "NOK",
  "COP", "CLP", "PEN", "RUB", "KHR", "LAK", "MNT", "BGN", "HRK", "RUB", "ISK",
]);

/**
 * Classify a price token.
 *
 * @param {string} token      the text around the number
 * @param {object} market     { currency, symbol, aliases }
 * @returns {string|null}     the currency code, or null if unknown
 */
export function classify(token, market = {}) {
  const t = String(token || "");
  if (!t) return null;

  /* 1. An explicit currency code always wins. */
  const codeMatch = t.match(/\b([A-Z]{3})\b/);
  if (codeMatch && KNOWN_CODES.has(codeMatch[1])) return codeMatch[1];

  /* 2. A symbol only one currency uses. This comes before the
        market's own claim on purpose: "US$20" must not be read as
        twenty Argentine pesos, because the Argentine storefront
        writes pesos with a bare "$" and the two look alike. */
  for (const [code, syms] of Object.entries(DISTINCTIVE)) {
    if (!KNOWN_CODES.has(code)) continue;
    for (const sym of syms) {
      if (containsSymbol(t, sym)) return code;
    }
  }

  /* 3. The market's own symbol. "kr" in Sweden is SEK; "kr" in
        Denmark is DKK, and the market already knows which it is.
        A market whose symbol is a bare "$" says so with
        symbolIsAmbiguous: on an English page a "$" is a dollar. The
        local currency wins only when the page is written in the
        market's own language — the Argentine storefront is in
        Spanish and writes pesos as "$ 4.499". */
  const own = market.symbol;
  let ownWins = true;
  if (market.symbolIsAmbiguous && own === "$") {
    const primary = market.primaryLang;
    const lang = market.pageLang;
    ownWins = !!(primary && lang && (lang === primary || lang.startsWith(primary + "-")));
  }
  if (own && ownWins && containsSymbol(t, own)) return market.currency;

  /* 4. A symbol the market has explicitly claimed. */
  if (market.aliases) {
    for (const [sym, code] of Object.entries(market.aliases)) {
      if (containsSymbol(t, sym)) return code;
    }
  }

  /* 5. A shared symbol: the market's currency if it uses it, else the
        most common owner of that symbol. */
  for (const [code, syms] of Object.entries(AMBIGUOUS)) {
    if (!KNOWN_CODES.has(code)) continue;
    for (const sym of syms) {
      if (containsSymbol(t, sym)) return code;
    }
  }

  /* 6. Nothing found: unknown. Not a guess. */
  return null;
}

/**
 * Currencies that write a comma for the decimal point, and currencies
 * that use three decimal places.
 *
 * The general rule is the universal one: THREE digits after a
 * separator means thousands, one or two means a decimal point. That
 * handles "12,50" (twelve fifty) and "4.950" (four thousand nine
 * hundred and fifty, Chilean pesos) with the same code.
 *
 * These two sets are the exceptions:
 *   DECIMAL_COMMA — the page writes 12,50 and the market reads it that
 *                   way, even when a bare three-digit group would
 *                   normally be thousands.
 *   DECIMAL_THREE — the currency is quoted in thousandths, so 1.125
 *                   really is one point one two five.
 */
export const DECIMAL_COMMA = new Set([
  "EUR", "EGP", "TND", "MAD", "DZD", "SAR", "AED", "QAR", "KWD", "OMR",
  "JOD", "IQD", "TRY", "BRL", "CLP", "COP", "PEN", "PKR", "LKR", "NGN",
  "KES", "ZAR", "IDR", "PHP", "VND", "THB", "MYR", "INR", "PLN", "CZK",
  "HUF", "RON", "UAH", "ILS", "ARS", "KZT", "UZS", "CRC", "GTQ", "HNL",
  "PAB", "DOP", "BOB", "PYG", "VES", "XOF", "XAF", "RWF", "BIF", "DJF",
  "GNF", "MGA", "MUR", "SYP", "IQD", "LYD", "SDG", "LBP",
]);

export const DECIMAL_THREE = new Set([
  "BHD", "KWD", "OMR", "JOD", "IQD", "JSD", "KMF", "DJF", "GNF", "VUV",
  "XAF", "XOF", "XPF", "LYD", "DJF",
]);
