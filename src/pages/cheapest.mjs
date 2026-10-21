import { escapeHtml, formatPrice } from "../lib/fmt.mjs";
import { eci, band } from "../lib/eci.mjs";
import { panel, num } from "../layout.mjs";
import { servicePath, marketPath, pairPath, pagePath } from "../lib/paths.mjs";
import { flagshipPlan, planLabel, priceCell } from "./common.mjs";

/* ============================================================
   "The cheapest way to watch" — the answer for one market at a time.
   Ranked by what the subscription costs as a share of a month's
   income, because that is the number that decides whether it is
   worth paying for.
   ============================================================ */
export function renderCheapest(ctx) {
  const { t, locale, data } = ctx;

  const markets = data.activeMarkets();

  const blocks = [];
  for (const mid of markets) {
    const m = data.markets[mid];
    const income = data.incomeFor(mid);
    const rows = data.rowsForMarket(mid);
    if (!rows.length) continue;

    /* one row per service: its flagship plan */
    const byService = new Map();
    for (const r of rows) {
      const svc = data.services[r.service];
      const flag = (svc.plans || []).some((p) => p.id === r.plan && p.flagship);
      const cur = byService.get(r.service);
      if (!cur || (flag && !cur.flag)) byService.set(r.service, { row: r, flag });
    }

    const ranked = [...byService.values()]
      .map((x) => ({ row: x.row, v: eci(x.row.price, income) }))
      .filter((x) => x.v != null)
      .sort((a, b) => a.v - b.v);

    if (!ranked.length) continue;

    const alts = (data.alternatives || []).filter((a) => a.market === mid);

    blocks.push(`<section class="cheapest-block" id="m-${escapeHtml(mid)}">
      <div class="cb-head">
        <h2><a href="${escapeHtml(marketPath(mid, locale))}">${escapeHtml(m.nameLocal[locale] || m.name)}</a></h2>
        <span class="cb-income mono">${escapeHtml(t("cheapest.income"))}: ${num(Math.round(income.latest.monthly))} ${escapeHtml(m.currency)}</span>
      </div>
      <div class="tablewrap"><table class="rows">
        <thead><tr>
          <th>${escapeHtml(t("home.colService"))}</th>
          <th>${escapeHtml(t("market.colPlan"))}</th>
          <th>${escapeHtml(t("market.colPrice"))}</th>
          <th>${escapeHtml(t("market.colShare"))}</th>
        </tr></thead>
        <tbody>${ranked
          .map(
            ({ row, v }) => `<tr>
            <td class="rowhead"><a href="${escapeHtml(pairPath(row.service, mid, locale))}">${escapeHtml(data.services[row.service].name)}</a></td>
            <td>${escapeHtml(planLabel(t, row.plan))}</td>
            <td class="num">${priceCell(row, locale)}</td>
            <td class="num"><span class="eci ${band(v).cls}">${num(v.toFixed(2))}%</span></td>
          </tr>`
          )
          .join("")}</tbody>
      </table></div>
      ${
        alts.length
          ? `<p class="small alt-line">${escapeHtml(t("cheapest.alternatives"))}: ${alts
              .map((a) => `<a href="${escapeHtml(a.url || "#")}" rel="nofollow sponsored noopener" target="_blank">${escapeHtml(a.name)}</a>`)
              .join(" · ")}</p>`
          : ""
      }
    </section>`);
  }

  const body = `
  <h1>${escapeHtml(t("cheapest.title"))}</h1>
  <p class="lede">${escapeHtml(t("cheapest.lede"))}</p>
  ${blocks.join("")}
  `;

  return { title: t("cheapest.title"), description: t("cheapest.lede"), body };
}
