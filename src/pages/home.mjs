import { escapeHtml, formatPrice, formatNumber, formatDate, arrow } from "../lib/fmt.mjs";
import { eci, band } from "../lib/eci.mjs";
import { panel, verifiedBadge, num } from "../layout.mjs";
import { barChart } from "../lib/chart.mjs";
import { servicePath, marketPath, pairPath, pagePath } from "../lib/paths.mjs";
import { flagshipPlan, eciCell, priceCell, planLabel, changeChip, coverageStats } from "./common.mjs";

export function renderHome(ctx) {
  const { t, locale, data } = ctx;
  const markets = data.markets;
  const services = data.services;
  const activeMarkets = data.activeMarkets();
  const activeServices = data.activeServices();
  const cov = coverageStats(data);

  /* --- the matrix: markets × services, each cell the ECI --- */
  const matrixRows = activeMarkets.map((mid) => {
    const m = markets[mid];
    const income = data.incomeFor(mid);
    const cells = activeServices.map((sid) => {
      const svc = services[sid];
      const rows = data.rowsForService(sid).filter((r) => r.market === mid);
      if (!rows.length) return { sid, value: null };
      const planId = flagshipPlan(svc, rows);
      const row = rows.find((r) => r.plan === planId) || rows[0];
      return { sid, value: eci(row.price, income), row };
    });
    return { mid, m, income, cells };
  });

  const best = matrixRows
    .flatMap((r) => r.cells.map((c) => ({ ...c, mid: r.mid, m: r.m })))
    .filter((c) => c.value != null)
    .sort((a, b) => b.value - a.value);

  const worst = best[0];
  const cheapest = best[best.length - 1];

  const statRow = `
  <div class="statrow">
    <div class="stat"><div class="n">${num(activeMarkets.length)}</div><div class="l">${escapeHtml(t("home.statMarkets"))}</div></div>
    <div class="stat"><div class="n">${num(activeServices.length)}</div><div class="l">${escapeHtml(t("home.statServices"))}</div></div>
    <div class="stat"><div class="n">${num(cov.total)}</div><div class="l">${escapeHtml(t("home.statRows"))}</div></div>
    <div class="stat"><div class="n">${num(cov.points)}</div><div class="l">${escapeHtml(t("home.statPoints"))}</div></div>
  </div>`;

  /* --- matrix table --- */
  const matrix = activeServices.length
    ? `<div class="tablewrap"><table class="matrix">
        <thead><tr>
          <th>${escapeHtml(t("home.colMarket"))}</th>
          ${activeServices.map((sid) => `<th><a href="${escapeHtml(servicePath(sid, locale))}">${escapeHtml(services[sid].name)}</a></th>`).join("")}
        </tr></thead>
        <tbody>
        ${matrixRows
          .map(
            (r) => `<tr>
            <th class="rowhead"><a href="${escapeHtml(marketPath(r.mid, locale))}">${escapeHtml(r.m.nameLocal[locale] || r.m.name)}</a></th>
            ${r.cells
              .map((c) => {
                if (c.value == null) return `<td class="faint">—</td>`;
                const b = band(c.value);
                return `<td><a class="eci ${b.cls}" href="${escapeHtml(pairPath(c.sid, r.mid, locale))}">${num(c.value.toFixed(2))}%</a></td>`;
              })
              .join("")}
          </tr>`
          )
          .join("")}
        </tbody>
      </table></div>
      <p class="small faint" style="margin-top:8px">${escapeHtml(t("home.flagLede"))}</p>`
    : `<div class="emptyblock">${escapeHtml(t("market.noData"))}</div>`;

  /* --- ranking bar chart of the flagship plan across markets --- */
  const chartItems = [];
  for (const sid of activeServices) {
    const svc = services[sid];
    const rows = data.rowsForService(sid);
    if (!rows.length) continue;
    const planId = flagshipPlan(svc, rows);
    for (const r of rows.filter((x) => x.plan === planId)) {
      const v = eci(r.price, data.incomeFor(r.market));
      if (v == null) continue;
      chartItems.push({
        label: `${svc.name} · ${markets[r.market].nameLocal[locale] || markets[r.market].name}`,
        value: v,
      });
    }
  }
  chartItems.sort((a, b) => b.value - a.value);

  const chart = chartItems.length
    ? `<div class="chartbox">${barChart(chartItems.slice(0, 18), {
        title: t("home.flagTitle"),
        valueFmt: (v) => num(v.toFixed(2)) + "%",
        left: 210,
      })}</div>`
    : "";

  /* --- latest changes --- */
  const changes = (data.changes || []).slice(0, 8);
  const wirePreview = changes.length
    ? `<ul class="wire-preview">${changes
        .map((c) => {
          const svc = services[c.service];
          const m = markets[c.market];
          const up = c.to > c.from;
          return `<li>
            <span class="wl-date mono">${escapeHtml(formatDate(c.date, locale))}</span>
            <span class="wl-what"><a href="${escapeHtml(pairPath(c.service, c.market, locale))}">${escapeHtml(svc ? svc.name : c.service)}</a> · ${escapeHtml(m ? (m.nameLocal[locale] || m.name) : c.market)} · ${escapeHtml(planLabel(t, c.plan))}</span>
            <span class="delta ${up ? "up" : "down"}">${escapeHtml(formatPrice(c.from, c.currency, locale))} ${arrow(locale)} ${escapeHtml(formatPrice(c.to, c.currency, locale))}</span>
          </li>`;
        })
        .join("")}</ul>
        <p class="small"><a href="${escapeHtml(pagePath("wire", locale))}">${escapeHtml(t("common.readMore"))} ${arrow(locale)}</a></p>`
    : `<div class="emptyblock">${escapeHtml(t("wire.empty"))}</div>`;

  const body = `
  <section class="hero">
    <h1>${escapeHtml(t("home.title"))}</h1>
    <p class="lede">${escapeHtml(t("home.lede"))}</p>
    ${statRow}
  </section>

  <div class="section-h"><h2>${escapeHtml(t("home.flagTitle"))}</h2></div>
  ${matrix}

  ${chart ? `<div class="section-h"><h2>${escapeHtml(t("home.colShare"))}</h2></div>${chart}` : ""}

  <div class="section-h"><h2>${escapeHtml(t("home.latestTitle"))}</h2></div>
  ${wirePreview}

  <div class="two-col">
    ${panel(
      t("home.methodTitle"),
      `<p>${escapeHtml(t("home.methodLede"))}</p>
       <p class="formula-lite"><b>ECI</b> = ${escapeHtml(t("method.formulaLede").replace(/^ECI = /, ""))}</p>
       <p class="small faint">${escapeHtml(t("method.denNote"))}</p>
       <p><a class="btn" href="${escapeHtml(pagePath("method", locale))}">${escapeHtml(t("nav.method"))} ${arrow(locale)}</a></p>`
    )}
    ${panel(
      t("home.dataTitle"),
      `<p>${escapeHtml(t("home.dataLede"))}</p>
       <p class="small faint">${escapeHtml(t("method.coverageLede"))} <b>${num(cov.pct)}%</b></p>
       <p><a class="btn" href="${escapeHtml(pagePath("data", locale))}">${escapeHtml(t("nav.data"))} ${arrow(locale)}</a></p>`
    )}
  </div>
  `;

  return {
    title: t("home.title"),
    description: t("home.lede"),
    body,
  };
}
