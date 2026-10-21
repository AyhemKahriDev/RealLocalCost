import { escapeHtml, formatPrice, formatPricePlain, formatDate } from "../lib/fmt.mjs";
import { eci, band, changeOver } from "../lib/eci.mjs";
import { panel, verifiedBadge, num } from "../layout.mjs";
import { lineChart } from "../lib/chart.mjs";
import { servicePath, marketPath, pairPath } from "../lib/paths.mjs";
import { flagshipPlan, eciCell, priceCell, planLabel, changeChip } from "./common.mjs";

/* ---------------------------------------------------------------
   Service hub — one service across every market we have verified.
   --------------------------------------------------------------- */
export function renderService(ctx, serviceId) {
  const { t, locale, data } = ctx;
  const svc = data.services[serviceId];
  if (!svc) return null;

  const rows = data.rowsForService(serviceId);
  const byMarket = new Map();
  for (const r of rows) {
    if (!byMarket.has(r.market)) byMarket.set(r.market, []);
    byMarket.get(r.market).push(r);
  }
  const markets = [...byMarket.keys()];

  const planId = flagshipPlan(svc, rows);
  const flagRows = rows.filter((r) => r.plan === planId);

  const ranked = flagRows
    .map((r) => ({ row: r, income: data.incomeFor(r.market), v: eci(r.price, data.incomeFor(r.market)) }))
    .filter((x) => x.v != null)
    .sort((a, b) => a.v - b.v);

  const tableRows = [];
  for (const mid of markets) {
    const m = data.markets[mid];
    const income = data.incomeFor(mid);
    for (const r of byMarket.get(mid)) {
      tableRows.push(`<tr>
        <td class="rowhead"><a href="${escapeHtml(marketPath(mid, locale))}">${escapeHtml(m.nameLocal[locale] || m.name)}</a></td>
        <td>${escapeHtml(planLabel(t, r.plan))}</td>
        <td class="num">${priceCell(r, locale)}</td>
        <td class="num">${eciCell(r, income, locale, t)}</td>
        <td class="num">${changeChip(r, t, locale)}</td>
        <td>${verifiedBadge(t, r)}</td>
        <td><a href="${escapeHtml(pairPath(serviceId, mid, locale))}">${escapeHtml(t("common.readMore"))} →</a></td>
      </tr>`);
    }
  }

  /* one line per market on the flagship plan */
  const series = [];
  for (const mid of markets) {
    const r = byMarket.get(mid).find((x) => x.plan === planId);
    if (!r || !(r.history || []).length) continue;
    series.push({
      label: data.markets[mid].nameLocal[locale] || data.markets[mid].name,
      points: r.history.map((h) => ({ date: h.date, value: h.price })),
    });
  }
  const chart = series.length
    ? `<div class="chartbox">${lineChart(series, {
        title: t("service.historyTitle"),
        yFmt: (v) => num(v),
        w: 760,
        h: 280,
      })}</div>`
    : `<div class="emptyblock">${escapeHtml(t("service.noData"))}</div>`;

  const cheapest = ranked[0];
  const dearest = ranked[ranked.length - 1];

  const body = `
  <div class="breadcrumb"><a href="/">${escapeHtml(t("common.back"))} ${escapeHtml(t("common.index"))}</a> / ${escapeHtml(svc.name)}</div>
  <h1>${escapeHtml(t("service.title", { service: svc.name }))}</h1>
  <p class="lede">${escapeHtml(t("service.lede", { service: svc.name }))}</p>

  <div class="two-col">
    ${panel(
      t("service.tableTitle"),
      `<div class="tablewrap"><table class="rows">
        <thead><tr>
          <th>${escapeHtml(t("home.colMarket"))}</th>
          <th>${escapeHtml(t("service.colPlan"))}</th>
          <th>${escapeHtml(t("service.colPrice"))}</th>
          <th>${escapeHtml(t("service.colShare"))}</th>
          <th>${escapeHtml(t("service.colChange", { date: "" }))}</th>
          <th>${escapeHtml(t("service.colVerified"))}</th>
          <th></th>
        </tr></thead>
        <tbody>${tableRows.join("")}</tbody>
      </table></div>`
    )}
    <div>
      ${panel(
        t("service.historyTitle"),
        `${chart}<p class="small faint">${escapeHtml(t("service.historyLede"))}</p>`
      )}
      ${
        cheapest && dearest
          ? panel(
              "",
              `<div class="kv"><span class="kv-k">${escapeHtml(t("service.cheapest"))}</span><span class="kv-v"><a href="${escapeHtml(pairPath(serviceId, cheapest.row.market, locale))}">${escapeHtml(data.markets[cheapest.row.market].nameLocal[locale] || data.markets[cheapest.row.market].name)}</a> · ${num(cheapest.v.toFixed(2))}%</span></div>
               <div class="kv"><span class="kv-k">${escapeHtml(t("service.dearest"))}</span><span class="kv-v"><a href="${escapeHtml(pairPath(serviceId, dearest.row.market, locale))}">${escapeHtml(data.markets[dearest.row.market].nameLocal[locale] || data.markets[dearest.row.market].name)}</a> · ${num(dearest.v.toFixed(2))}%</span></div>`
            )
          : ""
      }
    </div>
  </div>
  `;

  return {
    title: t("service.title", { service: svc.name }),
    description: t("service.lede", { service: svc.name }),
    body,
  };
}

/* ---------------------------------------------------------------
   Market hub — every service in one market.
   --------------------------------------------------------------- */
export function renderMarket(ctx, marketId) {
  const { t, locale, data } = ctx;
  const m = data.markets[marketId];
  if (!m) return null;

  const rows = data.rowsForMarket(marketId);
  const income = data.incomeFor(marketId);

  const ranked = rows
    .map((r) => ({ row: r, v: eci(r.price, income) }))
    .filter((x) => x.v != null)
    .sort((a, b) => b.v - a.v);

  const table = ranked.length
    ? `<div class="tablewrap"><table class="rows">
        <thead><tr>
          <th>${escapeHtml(t("market.colService"))}</th>
          <th>${escapeHtml(t("market.colPlan"))}</th>
          <th>${escapeHtml(t("market.colPrice"))}</th>
          <th>${escapeHtml(t("market.colShare"))}</th>
          <th>${escapeHtml(t("service.colVerified"))}</th>
        </tr></thead>
        <tbody>${ranked
          .map(
            ({ row, v }) => `<tr>
            <td class="rowhead"><a href="${escapeHtml(pairPath(row.service, marketId, locale))}">${escapeHtml(data.services[row.service].name)}</a></td>
            <td>${escapeHtml(planLabel(t, row.plan))}</td>
            <td class="num">${priceCell(row, locale)}</td>
            <td class="num"><span class="eci ${band(v).cls}">${num(v.toFixed(2))}%</span></td>
            <td>${verifiedBadge(t, row)}</td>
          </tr>`
          )
          .join("")}</tbody>
      </table></div>`
    : `<div class="emptyblock">${escapeHtml(t("market.noData"))}</div>`;

  const altEntries = (data.alternatives || []).filter((a) => a.market === marketId);
  const alternatives = altEntries.length
    ? `<ul class="altlist">${altEntries
        .map(
          (a) => `<li>
            <span class="alt-name">${escapeHtml(a.name)}</span>
            <span class="alt-what">${escapeHtml(a.what || "")}</span>
            ${a.price != null ? `<span class="alt-price mono">${escapeHtml(formatPrice(a.price, a.currency || m.currency, locale))}</span>` : ""}
            ${a.url ? `<a href="${escapeHtml(a.url)}" rel="nofollow sponsored noopener" target="_blank">${escapeHtml(a.cta || t("common.readMore"))} ↗</a>` : ""}
          </li>`
        )
        .join("")}</ul>`
    : `<p class="faint small">${escapeHtml(t("market.noData"))}</p>`;

  const incomePanel = income
    ? panel(
        t("market.incomeTitle"),
        `<div class="kv"><span class="kv-k">${escapeHtml(t("method.denTitle"))}</span><span class="kv-v mono">${num(Math.round(income.latest.monthly))} ${escapeHtml(m.currency)} / ${escapeHtml(t("market.perMonth"))}</span></div>
         <div class="kv"><span class="kv-k">&nbsp;</span><span class="kv-v mono">${num(Math.round(income.latest.annual))} ${escapeHtml(m.currency)} / ${escapeHtml(t("market.perYear"))}</span></div>
         <div class="kv"><span class="kv-k">${escapeHtml(t("common.source"))}</span><span class="kv-v"><a href="https://data.worldbank.org/indicator/NY.GNP.PCAP.CN" rel="noopener" target="_blank">World Bank, ${escapeHtml(String(income.latest.year))}</a></span></div>
         <p class="small faint">${escapeHtml(t("method.denNote"))}</p>`
      )
    : "";

  const body = `
  <div class="breadcrumb"><a href="/">${escapeHtml(t("common.back"))} ${escapeHtml(t("common.index"))}</a> / ${escapeHtml(m.nameLocal[locale] || m.name)}</div>
  <h1>${escapeHtml(t("market.title", { market: m.nameLocal[locale] || m.name }))}</h1>
  <p class="lede">${escapeHtml(t("market.lede", { market: m.nameLocal[locale] || m.name }))}</p>

  <div class="two-col">
    ${panel(t("market.rankTitle"), `${table}<p class="small faint">${escapeHtml(t("market.rankLede"))}</p>`)}
    <div>
      ${incomePanel}
      ${panel(
        t("market.altTitle"),
        `${alternatives}<p class="small faint">${escapeHtml(t("market.altLede", { market: m.nameLocal[locale] || m.name }))}</p>`
      )}
    </div>
  </div>
  `;

  return {
    title: t("market.title", { market: m.nameLocal[locale] || m.name }),
    description: t("market.lede", { market: m.nameLocal[locale] || m.name }),
    body,
  };
}
