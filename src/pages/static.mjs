import { escapeHtml, formatPrice, formatDate } from "../lib/fmt.mjs";
import { panel, num } from "../layout.mjs";
import { coverageStats } from "./common.mjs";
import { servicePath, marketPath, pairPath } from "../lib/paths.mjs";

/* ---------------------------------------------------------------
   /method
   --------------------------------------------------------------- */
export function renderMethod(ctx) {
  const { t, locale, data } = ctx;
  const cov = coverageStats(data);

  const body = `
  <h1>${escapeHtml(t("method.title"))}</h1>
  <p class="lede">${escapeHtml(t("method.lede"))}</p>

  ${panel(
    t("method.formulaTitle"),
    `<div class="formula"><pre><b>ECI</b> = local monthly price ÷ monthly GNI per capita × 100</pre></div>
     <p>${escapeHtml(t("method.formulaLede"))}</p>
     <p class="small faint">${escapeHtml(t("method.formulaNote"))}</p>`
  )}

  <div class="two-col">
    ${panel(
      t("method.denTitle"),
      `<p>${escapeHtml(t("method.denLede"))}</p>
       <p class="small faint">${escapeHtml(t("method.denNote"))}</p>
       <p class="small"><a href="https://data.worldbank.org/indicator/NY.GNP.PCAP.CN" rel="noopener" target="_blank">World Bank · NY.GNP.PCAP.CN ↗</a></p>`
    )}
    ${panel(
      t("method.priceTitle"),
      `<p>${escapeHtml(t("method.priceLede"))}</p>
       <p class="small faint">${escapeHtml(t("method.priceNote"))}</p>`
    )}
  </div>

  ${panel(
    t("method.watchTitle"),
    `<p>${escapeHtml(t("method.watchLede"))}</p>
     <div class="formula"><pre>fetch → hash → changed? → alert a human → human re-reads → price written down</pre></div>`
  )}

  ${panel(
    t("method.coverageTitle"),
    `<p>${escapeHtml(t("method.coverageLede"))}</p>
     <div class="statrow">
       <div class="stat"><div class="n">${num(cov.pct)}%</div><div class="l">${escapeHtml(t("method.coverageLede"))}</div></div>
       <div class="stat"><div class="n">${num(cov.total)}</div><div class="l">${escapeHtml(t("home.statRows"))}</div></div>
       <div class="stat"><div class="n">${num(cov.points)}</div><div class="l">${escapeHtml(t("home.statPoints"))}</div></div>
     </div>`
  )}
  `;

  return { title: t("method.title"), description: t("method.lede"), body };
}

/* ---------------------------------------------------------------
   /wire
   --------------------------------------------------------------- */
export function renderWire(ctx) {
  const { t, locale, data } = ctx;
  const changes = data.changes || [];

  const list = changes.length
    ? `<div class="wire">${changes
        .map((c) => {
          const svc = data.services[c.service];
          const m = data.markets[c.market];
          const up = c.to > c.from;
          const pct = c.from ? Math.round(((c.to - c.from) / c.from) * 1000) / 10 : 0;
          return `<div class="wire-item">
            <div class="wl-date mono">${escapeHtml(formatDate(c.date, locale))}</div>
            <div class="wl-body">
              <div class="wl-title"><a href="${escapeHtml(pairPath(c.service, c.market, locale))}">${escapeHtml(svc ? svc.name : c.service)}</a> · ${escapeHtml(m ? (m.nameLocal[locale] || m.name) : c.market)} · ${escapeHtml(c.plan)}</div>
              <div class="wl-delta">
                <span class="mono">${escapeHtml(formatPrice(c.from, c.currency, locale))}</span>
                <span class="arrow">→</span>
                <span class="mono ${up ? "up" : "down"}">${escapeHtml(formatPrice(c.to, c.currency, locale))}</span>
                <span class="delta ${up ? "up" : "down"}">${up ? "▲" : "▼"} ${num(Math.abs(pct))}%</span>
              </div>
              ${c.note ? `<div class="wl-note">${escapeHtml(c.note)}</div>` : ""}
              ${c.receipt ? `<div class="wl-receipt"><a href="${escapeHtml(c.receipt)}" rel="noopener" target="_blank">${escapeHtml(t("common.source"))} ↗</a></div>` : ""}
            </div>
          </div>`;
        })
        .join("")}</div>`
    : `<div class="emptyblock">${escapeHtml(t("wire.empty"))}</div>`;

  const body = `
  <h1>${escapeHtml(t("wire.title"))}</h1>
  <p class="lede">${escapeHtml(t("wire.lede"))}</p>
  ${list}
  `;

  return { title: t("wire.title"), description: t("wire.lede"), body };
}

/* ---------------------------------------------------------------
   /data
   --------------------------------------------------------------- */
export function renderData(ctx) {
  const { t, locale, data } = ctx;
  const cov = coverageStats(data);

  const schema = [
    ["service", t("common.source"), "Service id, matches the /{service}/ path."],
    ["market", t("common.source"), "Market code, matches the /m/{market}/ path."],
    ["plan", t("data.rowPlan"), "individual, family, duo, standard…"],
    ["price", t("market.colPrice"), "Monthly price in the market's own currency."],
    ["currency", t("data.rowCurrency"), "ISO code: TND, EGP, EUR…"],
    ["history", t("data.rowHistory"), "Array of {date, price} — every dated point."],
    ["verified", t("data.rowVerified"), "The date a human last read this price."],
    ["receipt", t("data.rowReceipt"), "Where the price was read from."],
  ];

  const body = `
  <h1>${escapeHtml(t("data.title"))}</h1>
  <p class="lede">${escapeHtml(t("data.lede"))}</p>

  <div class="dl-grid">
    <a class="dl" href="/data/prices.json" download><strong>${escapeHtml(t("data.jsonTitle"))}</strong><span>${escapeHtml(t("data.jsonLede"))}</span><code>prices.json</code></a>
    <a class="dl" href="/data/prices.csv" download><strong>${escapeHtml(t("data.csvTitle"))}</strong><span>${escapeHtml(t("data.csvLede"))}</span><code>prices.csv</code></a>
    <a class="dl" href="/data/income.json" download><strong>${escapeHtml(t("data.incomeTitle"))}</strong><span>${escapeHtml(t("data.incomeLede"))}</span><code>income.json</code></a>
  </div>

  ${panel(
    t("data.schemaTitle"),
    `<p class="small faint">${escapeHtml(t("data.schemaLede"))}</p>
     <div class="tablewrap"><table class="rows method-t">
      <thead><tr><th>${escapeHtml(t("data.colField"))}</th><th>${escapeHtml(t("data.colMeaning"))}</th></tr></thead>
      <tbody>${schema
        .map(
          (s) =>
            `<tr><td class="mono">${escapeHtml(s[0])}</td><td>${escapeHtml(s[1])} — ${escapeHtml(s[2])}</td></tr>`
        )
        .join("")}</tbody>
    </table></div>`
  )}

  ${panel(
    t("data.coverageTitle"),
    `<p>${escapeHtml(t("data.coverageLede"))}</p>
     <div class="statrow">
       <div class="stat"><div class="n">${num(cov.pct)}%</div><div class="l">${escapeHtml(t("method.coverageLede"))}</div></div>
       <div class="stat"><div class="n">${num(cov.total)}</div><div class="l">${escapeHtml(t("home.statRows"))}</div></div>
       <div class="stat"><div class="n">${num(cov.points)}</div><div class="l">${escapeHtml(t("home.statPoints"))}</div></div>
     </div>`
  )}
  `;

  return { title: t("data.title"), description: t("data.lede"), body };
}
