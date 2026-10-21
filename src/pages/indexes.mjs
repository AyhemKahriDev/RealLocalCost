import { escapeHtml, formatPrice, formatNumber, formatDate } from "../lib/fmt.mjs";
import { eci, band } from "../lib/eci.mjs";
import { panel, verifiedBadge, num } from "../layout.mjs";
import { barChart } from "../lib/chart.mjs";
import { servicePath, marketPath, pairPath } from "../lib/paths.mjs";
import { flagshipPlan, eciCell, priceCell, planLabel, coverageStats } from "./common.mjs";

/* ---------------------------------------------------------------
   /services — every service we track
   --------------------------------------------------------------- */
export function renderServices(ctx) {
  const { t, locale, data } = ctx;
  const services = data.activeServices();

  const rows = services.map((sid) => {
    const svc = data.services[sid];
    const srows = data.rowsForService(sid);
    const planId = flagshipPlan(svc, srows);
    const flag = srows.find((r) => r.plan === planId) || srows[0];
    const markets = [...new Set(srows.map((r) => r.market))];
    const eciVals = srows.map((r) => eci(r.price, data.incomeFor(r.market))).filter((v) => v != null);
    return {
      sid, svc, srows, flag, planId, markets,
      cheapest: eciVals.length ? Math.min(...eciVals) : null,
      dearest: eciVals.length ? Math.max(...eciVals) : null,
    };
  });

  const table = `<div class="tablewrap"><table class="rows">
    <thead><tr>
      <th>${escapeHtml(t("home.colService"))}</th>
      <th>${escapeHtml(t("home.colMarket"))}</th>
      <th>${escapeHtml(t("service.colPrice"))}</th>
      <th>${escapeHtml(t("service.colShare"))}</th>
      <th>${escapeHtml(t("service.colVerified"))}</th>
    </tr></thead>
    <tbody>${rows
      .map((r) => {
        const v = r.flag ? eci(r.flag.price, data.incomeFor(r.flag.market)) : null;
        return `<tr>
        <td class="rowhead"><a href="${escapeHtml(servicePath(r.sid, locale))}">${escapeHtml(r.svc.name)}</a>
          <span class="faint small">${escapeHtml(r.svc.category)}</span></td>
        <td>${num(r.markets.length)}</td>
        <td class="num">${r.flag ? priceCell(r.flag, locale) : "—"}</td>
        <td class="num"><span class="eci ${band(v).cls}">${num(v != null ? v.toFixed(2) : "—")}%</span></td>
        <td>${r.flag ? verifiedBadge(t, r.flag) : ""}</td>
      </tr>`;
      })
      .join("")}</tbody>
  </table></div>`;

  const body = `
  <h1>${escapeHtml(t("nav.services"))}</h1>
  <p class="lede">${escapeHtml(t("nav.servicesLede"))}</p>
  ${panel(t("home.flagTitle"), table)}
  `;

  return { title: t("nav.services"), description: t("nav.servicesLede"), body };
}

/* ---------------------------------------------------------------
   /markets — every market we price
   --------------------------------------------------------------- */
export function renderMarkets(ctx) {
  const { t, locale, data } = ctx;
  const markets = data.activeMarkets();

  const items = markets.map((mid) => {
    const m = data.markets[mid];
    const income = data.incomeFor(mid);
    const mrows = data.rowsForMarket(mid);
    const flag = mrows.find((r) => {
      const svc = data.services[r.service];
      return (svc.plans || []).some((p) => p.id === r.plan && p.flagship);
    }) || mrows[0];
    const v = flag ? eci(flag.price, income) : null;
    return { mid, m, income, mrows, flag, v };
  });

  const table = `<div class="tablewrap"><table class="rows">
    <thead><tr>
      <th>${escapeHtml(t("home.colMarket"))}</th>
      <th>${escapeHtml(t("market.colService"))}</th>
      <th>${escapeHtml(t("market.perMonth"))}</th>
      <th>${escapeHtml(t("service.colShare"))}</th>
    </tr></thead>
    <tbody>${items
      .map(
        (it) => `<tr>
        <td class="rowhead"><a href="${escapeHtml(marketPath(it.mid, locale))}">${escapeHtml(it.m.nameLocal[locale] || it.m.name)}</a></td>
        <td>${num(it.mrows.length)}</td>
        <td class="num mono">${it.income ? num(Math.round(it.income.latest.monthly)) + " " + escapeHtml(it.m.currency) : "—"}</td>
        <td class="num"><span class="eci ${band(it.v).cls}">${num(it.v != null ? it.v.toFixed(2) : "—")}%</span></td>
      </tr>`
      )
      .join("")}</tbody>
  </table></div>`;

  const chartItems = items
    .filter((it) => it.v != null)
    .map((it) => ({ label: it.m.nameLocal[locale] || it.m.name, value: it.v }))
    .sort((a, b) => b.value - a.value);

  const chart = chartItems.length
    ? `<div class="chartbox">${barChart(chartItems, {
        title: t("market.rankTitle"),
        valueFmt: (v) => num(v.toFixed(2)) + "%",
        left: 170,
      })}</div>`
    : "";

  const body = `
  <h1>${escapeHtml(t("nav.markets"))}</h1>
  <p class="lede">${escapeHtml(t("nav.marketsLede"))}</p>
  ${panel(t("market.rankTitle"), table)}
  ${chart ? `<div class="section-h"><h2>${escapeHtml(t("market.rankTitle"))}</h2></div>${chart}` : ""}
  `;

  return { title: t("nav.markets"), description: t("nav.marketsLede"), body };
}
