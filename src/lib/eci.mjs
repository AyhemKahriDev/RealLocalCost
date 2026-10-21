/* ============================================================
   eci.mjs — the Effective Cost Index
   ------------------------------------------------------------
   ECI = local monthly price ÷ monthly GNI per capita × 100

   "What share of a month of per-capita national income does this
   subscription eat?"

   The denominator is World Bank indicator NY.GNP.PCAP.CN (GNI per
   capita, current local currency) ÷ 12. It is the same measure
   international media use for "what a person earns per month":
   an AVERAGE per person, not a median wage. We say so everywhere.

   Why an average and not a median: the World Bank series is free,
   keyless, and covers every country with 60+ years of history.
   A true median wage would be better but is not available as a free,
   comparable, machine-readable series across markets. The trade is
   documented on /method, not hidden.
   ============================================================ */

/**
 * @param {number} price     monthly local price
 * @param {object} income    income record from data/income.json
 *                           ({ latest: { monthly }, ... } or { monthly })
 * @returns {number|null}    ECI as a percentage, or null
 */
export function eci(price, income) {
  if (!price || !income) return null;
  const monthly = income.monthly != null ? income.monthly : income.latest && income.latest.monthly;
  if (!monthly) return null;
  const v = (price / monthly) * 100;
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.round(v * 1000) / 1000;
}

/**
 * How many times dearer this is than the reference market's price,
 * for the same service and plan. Both sides are normalised by income,
 * so this is a like-for-like affordability gap, not an FX artefact.
 */
export function eciRatio(eciValue, referenceEci) {
  if (!eciValue || !referenceEci) return null;
  return Math.round((eciValue / referenceEci) * 100) / 100;
}

/** Simple verdict band, so the number always comes with a reading. */
export function band(value) {
  if (value == null) return { key: "unknown", cls: "faint" };
  if (value < 0.5) return { key: "light", cls: "g" };
  if (value < 1.5) return { key: "moderate", cls: "t" };
  if (value < 3) return { key: "heavy", cls: "a" };
  return { key: "brutal", cls: "r" };
}

/**
 * Percentage change between the first and last point of a history.
 * Returns { pct, from, to } or null.
 */
export function changeOver(history) {
  if (!history || history.length < 2) return null;
  const first = history[0];
  const last = history[history.length - 1];
  if (!first.price || !last.price) return null;
  return {
    pct: Math.round(((last.price - first.price) / first.price) * 1000) / 10,
    from: first,
    to: last,
    absolute: Math.round((last.price - first.price) * 1000) / 1000,
  };
}
