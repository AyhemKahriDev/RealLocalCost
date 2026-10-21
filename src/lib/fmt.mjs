/* Locale-aware formatting. Uses Intl where the runtime has it, with
   hand-rolled fallbacks so a build never fails on a missing locale.

   One rule everywhere: DIGITS ARE ALWAYS LATIN. The site exists to
   compare numbers across markets, and the source pages disagree —
   Spotify's Egyptian storefront quotes ٧٩ ج.م while the Tunisian one
   quotes 12,50 DT. A reader comparing them needs one numeral system,
   so Arabic-Indic digits are converted on the way out. */

const CURRENCY_DECIMALS = {
  TND: 2, EGP: 2, EUR: 2, SAR: 2, MAD: 2, TRY: 2, ARS: 2, USD: 2, JOD: 3, DZD: 2, GBP: 2,
};

export function decimalsFor(currency) {
  return CURRENCY_DECIMALS[currency] != null ? CURRENCY_DECIMALS[currency] : 2;
}

/** Arabic-Indic digits and separators → Latin. */
export function normalizeNumerals(s) {
  if (s == null) return "";
  return String(s)
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
}

/**
 * Format a price the way a local reader expects:
 *   12.14 EUR → "12,14 €"   (fr)
 *   12.14 EUR → "12.14 €"   (en)
 *   12.5  TND → "12.50 DT"  (ar)
 */
export function formatPrice(value, currency, locale = "en") {
  if (value == null || !Number.isFinite(value)) return "—";
  const dec = decimalsFor(currency);
  const tag = locale === "ar" ? "ar-EG" : locale === "fr" ? "fr-FR" : "en-US";
  const nf = new Intl.NumberFormat(tag, {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
  const num = normalizeNumerals(nf.format(value));
  const symbol = { TND: "DT", EGP: "ج.م", EUR: "€", SAR: "ر.س", MAD: "DH", TRY: "₺", ARS: "$", USD: "US$", JOD: "د.ا", GBP: "£", DZD: "د.ج" }[currency];
  if (!symbol) return `${num} ${currency}`;
  if (currency === "EUR" || currency === "TRY" || currency === "GBP") return `${num} ${symbol}`;
  if (currency === "USD") return `${symbol}${num}`;
  return `${num} ${symbol}`;
}

/** Format a price with the currency code spelled out — used in tables. */
export function formatPricePlain(value, currency, locale = "en") {
  if (value == null || !Number.isFinite(value)) return "—";
  const dec = decimalsFor(currency);
  const tag = locale === "ar" ? "ar-EG" : locale === "fr" ? "fr-FR" : "en-US";
  const nf = new Intl.NumberFormat(tag, {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
  return `${normalizeNumerals(nf.format(value))} ${currency}`;
}

export function formatNumber(value, locale = "en", opts = {}) {
  if (value == null || !Number.isFinite(value)) return "—";
  const tag = locale === "ar" ? "ar-EG" : locale === "fr" ? "fr-FR" : "en-US";
  return normalizeNumerals(new Intl.NumberFormat(tag, opts).format(value));
}

export function formatDate(iso, locale = "en") {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00Z" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  const tag = locale === "ar" ? "ar-EG" : locale === "fr" ? "fr-FR" : "en-GB";
  return normalizeNumerals(
    new Intl.DateTimeFormat(tag, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(d)
  );
}

export function formatMonth(ym, locale = "en") {
  if (!ym) return "—";
  const d = new Date(ym + "-01T00:00:00Z");
  if (Number.isNaN(d.getTime())) return ym;
  const tag = locale === "ar" ? "ar-EG" : locale === "fr" ? "fr-FR" : "en-GB";
  return new Intl.DateTimeFormat(tag, { year: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

export function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/** Latin digits for Arabic locales: the site quotes numbers, and the
    Latin numerals are what a reader can compare across markets. */
export function latinDigits(s) {
  return String(s)
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}
