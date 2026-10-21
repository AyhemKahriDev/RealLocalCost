import { escapeHtml, formatPrice, formatDate, formatNumber } from "../lib/fmt.mjs";
import { eci, band } from "../lib/eci.mjs";
import { panel, verifiedBadge, num } from "../layout.mjs";
import { barChart } from "../lib/chart.mjs";
import { servicePath, marketPath, pairPath, pagePath } from "../lib/paths.mjs";
import { flagshipPlan, eciCell, priceCell, planLabel, coverageStats } from "./common.mjs";

/* ============================================================
   The verdict: does this service price per market?

   A service "localises" when the price it charges in a market is
   written in that market's own money. A service that does not
   localise ships one price — usually in dollars — to everybody,
   and the local cost is whatever the exchange rate does to it.

   That is a finding, not a footnote: it is the difference between a
   service that prices for the market and a service that prices for
   the United States and hopes for the best.
   ============================================================ */

/**
 * For each service, work out how it prices.
 * @returns {Array<{sid, svc, rows, currencies, localises, localCount, globalCount, spread}>}
 */
export function pricingVerdicts(data) {
  const out = [];
  for (const [sid, svc] of Object.entries(data.services)) {
    const rows = data.rowsForService(sid);
    if (!rows.length) continue;
    const currencies = [...new Set(rows.map((r) => r.currency))];
    let localCount = 0;
    let globalCount = 0;
    const globalIn = [];
    for (const r of rows) {
      const m = data.markets[r.market];
      const pricedFor =
        r.pricedFor || (r.currency === m.currency && m.currency !== "USD" ? "market" : "global");
      if (pricedFor === "market") {
        localCount++;
      } else {
        globalCount++;
        globalIn.push(r.market);
      }
    }
    const eciVals = rows
      .map((r) => eci(r.price, data.incomeFor(r.market)))
      .filter((v) => v != null);
    out.push({
      sid,
      svc,
      rows,
      currencies,
      localCount,
      globalCount,
      globalIn,
      localises: localCount > globalCount && currencies.length > 1,
      onePrice: currencies.length === 1,
      spread: eciVals.length ? Math.max(...eciVals) - Math.min(...eciVals) : 0,
      cheapest: eciVals.length ? Math.min(...eciVals) : null,
      dearest: eciVals.length ? Math.max(...eciVals) : null,
    });
  }
  out.sort((a, b) => {
    if (a.localises !== b.localises) return a.localises ? -1 : 1;
    return b.rows.length - a.rows.length;
  });
  return out;
}

export function renderLocalises(ctx) {
  const { t, locale, data } = ctx;
  const verdicts = pricingVerdicts(data);
  const localising = verdicts.filter((v) => v.localises);
  const global = verdicts.filter((v) => !v.localises);

  const row = (v) => {
    const spread = v.spread;
    const b = band(v.dearest);
    return `<tr>
      <td class="rowhead"><a href="${escapeHtml(servicePath(v.sid, locale))}">${escapeHtml(v.svc.name)}</a>
        <span class="faint small">${escapeHtml(v.svc.category || "")}</span></td>
      <td>${
        v.localises
          ? `<span class="chip t">${escapeHtml(t("localises.verdictLocal"))}</span>`
          : v.onePrice
            ? `<span class="chip r">${escapeHtml(t("localises.verdictOnePrice"))}</span>`
            : `<span class="chip a">${escapeHtml(t("localises.verdictMixed"))}</span>`
      }</td>
      <td class="num">${num(v.localCount)}</td>
      <td class="num">${num(v.globalCount)}</td>
      <td class="num"><span class="eci ${b.cls}">${num(spread.toFixed(2))}pp</span></td>
      <td class="num small faint">${escapeHtml(v.currencies.join(", "))}</td>
    </tr>`;
  };

  const table = `<div class="tablewrap"><table class="rows">
    <thead><tr>
      <th>${escapeHtml(t("home.colService"))}</th>
      <th>${escapeHtml(t("localises.verdict"))}</th>
      <th>${escapeHtml(t("localises.localMarkets"))}</th>
      <th>${escapeHtml(t("localises.globalMarkets"))}</th>
      <th>${escapeHtml(t("localises.spread"))}</th>
      <th>${escapeHtml(t("localises.currencies"))}</th>
    </tr></thead>
    <tbody>${verdicts.map(row).join("")}</tbody>
  </table></div>`;

  /* the biggest gap between a service's cheapest and dearest market */
  const ranked = [...verdicts]
    .filter((v) => v.localises && v.spread > 0)
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 12);

  const chart = ranked.length
    ? `<div class="chartbox">${barChart(
        ranked.map((v) => ({ label: v.svc.name, value: v.spread })),
        {
          title: t("localises.spread"),
          valueFmt: (x) => num(x.toFixed(2)) + "pp",
          left: 190,
        }
      )}</div>`
    : "";

  /* The headline: a service that does not localise costs the same
     number of dollars everywhere, and that number is a completely
     different share of a month's income depending on where you live. */
  const globalStories = global
    .filter((v) => v.rows.length >= 8)
    .map((v) => {
      const items = v.rows
        .map((r) => ({ mid: r.market, value: eci(r.price, data.incomeFor(r.market)), row: r }))
        .filter((x) => x.value != null)
        .sort((a, b) => b.value - a.value);
      if (items.length < 8) return null;
      const dear = items[0];
      const cheap = items[items.length - 1];
      return {
        v,
        items,
        dear,
        cheap,
        ratio: dear.value / cheap.value,
        quote: v.rows.find((r) => r.quoted) || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.ratio - a.ratio);

  const story = globalStories[0];

  const storyBlock = story
    ? `<div class="story">
        <p class="story-lede">${escapeHtml(
          t("localises.storyLede", {
            service: story.v.svc.name,
            quoted: story.quote ? formatPrice(story.quote.quoted.price, story.quote.quoted.currency, locale) : "—",
            dear: data.markets[story.dear.mid].nameLocal[locale] || data.markets[story.dear.mid].name,
            dearShare: num(story.dear.value.toFixed(2)),
            cheap: data.markets[story.cheap.mid].nameLocal[locale] || data.markets[story.cheap.mid].name,
            cheapShare: num(story.cheap.value.toFixed(2)),
            times: num(story.ratio.toFixed(1)),
          })
        )}</p>
        <div class="chartbox">${barChart(
          story.items.slice(0, 16).map((x) => ({
            label: data.markets[x.mid].nameLocal[locale] || data.markets[x.mid].name,
            value: x.value,
          })),
          {
            title: t("localises.storyTitle", { service: story.v.svc.name }),
            valueFmt: (v) => num(v.toFixed(2)) + "%",
            left: 190,
          }
        )}</div>
        <p class="small faint">${escapeHtml(t("localises.storyLede2", { service: story.v.svc.name }))}</p>
      </div>`
    : "";

  /* which services charge the American price outside America */
  const globalList = global
    .filter((v) => v.globalCount > 0)
    .map(
      (v) => `<li>
        <span class="alt-name">${escapeHtml(v.svc.name)}</span>
        <span class="alt-what">${escapeHtml(
          t("localises.globalIn", { count: num(v.globalCount) })
        )}</span>
        <a href="${escapeHtml(servicePath(v.sid, locale))}">${escapeHtml(t("common.readMore"))} →</a>
      </li>`
    )
    .join("");

  const body = `
  <h1>${escapeHtml(t("localises.title"))}</h1>
  <p class="lede">${escapeHtml(t("localises.lede"))}</p>

  <div class="statrow">
    <div class="stat"><div class="n">${num(localising.length)}</div><div class="l">${escapeHtml(t("localises.statLocal"))}</div></div>
    <div class="stat"><div class="n">${num(global.length)}</div><div class="l">${escapeHtml(t("localises.statGlobal"))}</div></div>
    <div class="stat"><div class="n">${num(verdicts.length)}</div><div class="l">${escapeHtml(t("localises.statTracked"))}</div></div>
  </div>

  ${
    story
      ? `<div class="section-h"><h2>${escapeHtml(t("localises.storyHead"))}</h2></div>${storyBlock}`
      : ""
  }

  ${panel(t("localises.verdict"), table)}

  ${chart ? `<div class="section-h"><h2>${escapeHtml(t("localises.spreadTitle"))}</h2></div>${chart}` : ""}

  ${
    globalList
      ? panel(
          t("localises.globalTitle"),
          `<ul class="altlist">${globalList}</ul>
           <p class="small faint">${escapeHtml(t("localises.globalLede"))}</p>`
        )
      : ""
  }
  `;

  return { title: t("localises.title"), description: t("localises.lede"), body };
}

/* ============================================================
   The calculator — "what does it cost where I live?"
   ============================================================ */
export function renderCalculator(ctx) {
  const { t, locale, data } = ctx;

  const options = [];
  for (const [sid, svc] of Object.entries(data.services)) {
    for (const [mid, m] of Object.entries(data.markets)) {
      const row = data.rows.find(
        (r) => r.service === sid && r.market === mid && (svc.plans || []).some((p) => p.id === r.plan && p.flagship)
      );
      if (!row) continue;
      options.push({
        service: sid,
        market: mid,
        label: `${svc.name} — ${m.nameLocal[locale] || m.name}`,
        price: row.price,
        currency: row.currency,
        eci: eci(row.price, data.incomeFor(mid)),
      });
    }
  }

  const body = `
  <h1>${escapeHtml(t("calc.title"))}</h1>
  <p class="lede">${escapeHtml(t("calc.lede"))}</p>

  <div class="calc" id="calc">
    <div class="calc-controls">
      <label for="calc-service">${escapeHtml(t("calc.service"))}</label>
      <select id="calc-service">
        ${[...new Set(options.map((o) => o.service))]
          .map(
            (s) => `<optgroup label="${escapeHtml(data.services[s].name)}">${options
              .filter((o) => o.service === s)
              .map((o) => `<option value="${escapeHtml(o.service + "|" + o.market)}">${escapeHtml(o.label)}</option>`)
              .join("")}</optgroup>`
          )
          .join("")}
      </select>
    </div>
    <div class="calc-out" id="calc-out"></div>
    <p class="small faint calc-share" id="calc-share"></p>
  </div>

  <script id="calc-data" type="application/json">${JSON.stringify(
    Object.fromEntries(
      options.map((o) => [
        `${o.service}|${o.market}`,
        {
          price: o.price,
          currency: o.currency,
          eci: o.eci,
          label: o.label,
          market: data.markets[o.market].nameLocal[locale] || data.markets[o.market].name,
          service: data.services[o.service].name,
        },
      ])
    )
  )}</script>
  <script src="/assets/calculator.js" defer></script>
  `;

  return { title: t("calc.title"), description: t("calc.lede"), body };
}
