import { escapeHtml, formatPrice, formatPricePlain, formatNumber, formatDate } from "../lib/fmt.mjs";
import { eci, band, changeOver } from "../lib/eci.mjs";
import { panel, kv, verifiedBadge, num } from "../layout.mjs";
import { barChart } from "../lib/chart.mjs";
import { servicePath, marketPath, pairPath, pagePath } from "../lib/paths.mjs";

/** The flagship plan of a service — the one we quote in comparisons. */
export function flagshipPlan(service, rows) {
  const declared = (service.plans || []).find((p) => p.flagship);
  if (declared) return declared.id;
  return rows.length ? rows[0].plan : null;
}

export function eciFor(row, income) {
  return eci(row.price, income);
}

export function eciCell(row, income, locale, t) {
  const v = eciFor(row, income);
  if (v == null) return `<span class="faint">—</span>`;
  const b = band(v);
  return `<span class="eci ${b.cls}">${num(v.toFixed(2))}%</span>`;
}

/** A row's price, formatted in the market's own currency. */
export function priceCell(row, locale) {
  return `<span class="mono">${escapeHtml(formatPrice(row.price, row.currency, locale))}</span>`;
}

export function planLabel(t, planId) {
  return t(`plan.${planId}`) === `plan.${planId}` ? t("plan.unknown") : t(`plan.${planId}`);
}

export function changeChip(row, t, locale) {
  const ch = changeOver(row.history || []);
  if (!ch) return `<span class="faint small">—</span>`;
  const date = formatDate(ch.from.date, locale);
  if (ch.pct > 0) {
    return `<span class="delta up">▲ ${num(ch.pct)}%</span> <span class="faint small">${escapeHtml(t("service.colChange", { date }))}</span>`;
  }
  if (ch.pct < 0) {
    return `<span class="delta down">▼ ${num(Math.abs(ch.pct))}%</span> <span class="faint small">${escapeHtml(t("service.colChange", { date }))}</span>`;
  }
  return `<span class="delta flat">—</span> <span class="faint small">${escapeHtml(t("service.colChange", { date }))}</span>`;
}

/** Coverage: how much of the published data was checked recently. */
export function coverageStats(data) {
  const rows = data.rows || [];
  const now = Date.now();
  let fresh = 0;
  for (const r of rows) {
    if (!r.verified) continue;
    const t = Date.parse(r.verified + "T00:00:00Z");
    if (!Number.isNaN(t) && now - t <= 30 * 86400000) fresh++;
  }
  const points = rows.reduce((n, r) => n + ((r.history || []).length), 0);
  return { total: rows.length, fresh, pct: rows.length ? Math.round((fresh / rows.length) * 100) : 0, points };
}
