import { escapeHtml, formatPrice, formatDate } from "../lib/fmt.mjs";
import { eci, band, changeOver } from "../lib/eci.mjs";
import { panel, verifiedBadge, num } from "../layout.mjs";
import { lineChart } from "../lib/chart.mjs";
import { servicePath, marketPath, pairPath } from "../lib/paths.mjs";
import { eciCell, priceCell, planLabel, changeChip } from "./common.mjs";

/* ---------------------------------------------------------------
   The flagship page: one service, one market.
   --------------------------------------------------------------- */
export function renderPair(ctx, serviceId, marketId) {
  const { t, locale, data } = ctx;
  const svc = data.services[serviceId];
  const m = data.markets[marketId];
  if (!svc || !m) return null;

  const rows = data.rowsForService(serviceId).filter((r) => r.market === marketId);
  if (!rows.length) return null;

  const income = data.incomeFor(marketId);
  const flag = rows.find((r) => (svc.plans || []).some((p) => p.id === r.plan && p.flagship)) || rows[0];
  const flagEci = eci(flag.price, income);
  const b = band(flagEci);

  const priceText = formatPrice(flag.price, flag.currency, locale);
  const isGlobal = flag.pricedFor === "global";
  const quotedText = flag.quoted ? formatPrice(flag.quoted.price, flag.quoted.currency, locale) : null;

  /* reference market: the same plan in the cheapest market we track for
     this service, so the comparison is like-for-like */
  const allRows = data.rowsForService(serviceId);
  const refRow = allRows
    .filter((r) => r.plan === flag.plan)
    .map((r) => ({ r, v: eci(r.price, data.incomeFor(r.market)) }))
    .filter((x) => x.v != null && x.r.market !== marketId)
    .sort((a, b2) => a.v - b2.v)[0];

  const ch = changeOver(flag.history || []);

  const plansTable = `<div class="tablewrap"><table class="rows">
    <thead><tr>
      <th>${escapeHtml(t("pair.colPlan"))}</th>
      <th>${escapeHtml(t("pair.colPrice"))}</th>
      <th>${escapeHtml(t("pair.colShare"))}</th>
      <th>${escapeHtml(t("pair.colVerified"))}</th>
    </tr></thead>
    <tbody>${rows
      .map(
        (r) => `<tr>
        <td class="rowhead">${escapeHtml(planLabel(t, r.plan))}${
          r.discontinued ? ` <span class="chip r" title="${escapeHtml(t("pair.discontinuedLede"))}">${escapeHtml(t("badge.discontinued"))}</span>` : ""
        }</td>
        <td class="num">${priceCell(r, locale)}</td>
        <td class="num">${eciCell(r, income, locale, t)}</td>
        <td>${verifiedBadge(t, r)}</td>
      </tr>`
      )
      .join("")}</tbody>
  </table></div>`;

  const chart = (flag.history || []).length >= 2
    ? `<div class="chartbox">${lineChart(
        [
          {
            label: `${svc.name} · ${m.nameLocal[locale] || m.name}`,
            points: flag.history.map((h) => ({ date: h.date, value: h.price })),
          },
        ],
        {
          title: t("pair.historyTitle"),
          yFmt: (v) => num(v),
          w: 760,
          h: 250,
        }
      )}</div>`
    : `<div class="emptyblock">${escapeHtml(
        (flag.history || []).length === 1 ? t("pair.historyOnce") : t("pair.historyLede", {
          service: svc.name,
          market: m.nameLocal[locale] || m.name,
        })
      )}</div>`;

  const receiptUrl = flag.receipt && (flag.receipt.archived || flag.receipt.url);
  const receipt = panel(
    t("pair.receiptTitle"),
    `<p class="small">${escapeHtml(t("pair.receiptLede"))}</p>
     <div class="kv"><span class="kv-k">${escapeHtml(t("common.source"))}</span><span class="kv-v"><a href="${escapeHtml(flag.receipt ? flag.receipt.url : "#")}" rel="noopener" target="_blank">${escapeHtml(flag.receipt ? flag.receipt.url : "—")}</a></span></div>
     ${
       flag.receipt && flag.receipt.archived
         ? `<div class="kv"><span class="kv-k">Archive</span><span class="kv-v"><a href="${escapeHtml(flag.receipt.archived)}" rel="noopener" target="_blank">${escapeHtml(formatDate(flag.receipt.archivedDate || flag.verified, locale))}</a></span></div>`
         : ""
     }
     <div class="kv"><span class="kv-k">${escapeHtml(t("common.checked"))}</span><span class="kv-v mono">${escapeHtml(flag.verified || "—")}</span></div>
     ${flag.note ? `<p class="small faint">${escapeHtml(flag.note)}</p>` : ""}`
  );

  const altEntries = (data.alternatives || []).filter(
    (a) => a.market === marketId && (!a.for || a.for === serviceId)
  );
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
    : "";

  /* the practical note: how people in this market actually pay */
  const marketNotes = data.notes && data.notes[marketId] ? data.notes[marketId] : {};
  const howNote = marketNotes[serviceId] || null;

  const related = data.rowsForMarket(marketId).filter((r) => r.service !== serviceId);
  const relatedList = related.length
    ? `<div class="tablewrap"><table class="rows">
        <thead><tr>
          <th>${escapeHtml(t("market.colService"))}</th>
          <th>${escapeHtml(t("market.colPrice"))}</th>
          <th>${escapeHtml(t("market.colShare"))}</th>
        </tr></thead>
        <tbody>${related
          .map((r) => {
            const v = eci(r.price, income);
            return `<tr>
            <td class="rowhead"><a href="${escapeHtml(pairPath(r.service, marketId, locale))}">${escapeHtml(data.services[r.service].name)}</a></td>
            <td class="num">${priceCell(r, locale)}</td>
            <td class="num"><span class="eci ${band(v).cls}">${num(v != null ? v.toFixed(2) : "—")}%</span></td>
          </tr>`;
          })
          .join("")}</tbody>
      </table></div>`
    : `<p class="faint small">${escapeHtml(t("market.noData"))}</p>`;

  const incomeLine = income
    ? t("pair.incomeHere", { income: `${num(Math.round(income.latest.monthly))} ${m.currency}` })
    : "";

  const refLine = refRow
    ? t("pair.reference", {
        ref: data.markets[refRow.r.market].nameLocal[locale] || data.markets[refRow.r.market].name,
        refprice: formatPrice(refRow.r.price, refRow.r.currency, locale),
        refshare: num(refRow.v.toFixed(2)) + "%",
        here: num(flagEci.toFixed(2)) + "%",
      })
    : "";

  const changeLine = ch
    ? ch.pct > 0
      ? t("pair.changeUp", { pct: num(ch.pct), date: formatDate(ch.from.date, locale) })
      : ch.pct < 0
        ? t("pair.changeDown", { pct: num(Math.abs(ch.pct)), date: formatDate(ch.from.date, locale) })
        : t("pair.changeFlat", { date: formatDate(ch.from.date, locale) })
    : "";

  const marketNote = m.note ? m.note[locale] || m.note.en : null;

  const body = `
  <div class="breadcrumb">
    <a href="/">${escapeHtml(t("common.index"))}</a> /
    <a href="${escapeHtml(servicePath(serviceId, locale))}">${escapeHtml(svc.name)}</a> /
    <a href="${escapeHtml(marketPath(marketId, locale))}">${escapeHtml(m.nameLocal[locale] || m.name)}</a>
  </div>

  <h1>${escapeHtml(t("pair.title", { service: svc.name, market: m.nameLocal[locale] || m.name, price: priceText }))}</h1>
  <p class="lede">${escapeHtml(
    isGlobal
      ? t("pair.ledeGlobal", {
          service: svc.name,
          market: m.nameLocal[locale] || m.name,
          price: quotedText,
          local: priceText,
          share: num(flagEci != null ? flagEci.toFixed(2) : "—") + "%",
        })
      : t("pair.lede", { service: svc.name, market: m.nameLocal[locale] || m.name, price: priceText, share: num(flagEci != null ? flagEci.toFixed(2) : "—") + "%" })
  )}</p>

  ${marketNote ? `<p class="market-note">${escapeHtml(marketNote)}</p>` : ""}

  <div class="hero-stat">
    <div class="hs-num ${b.cls}">${num(flagEci != null ? flagEci.toFixed(2) : "—")}<span class="hs-unit">%</span></div>
    <div class="hs-side">
      <div class="hs-band ${b.cls}">${escapeHtml(t(`band.${b.key}`))} · ${escapeHtml(t("pair.shareHeadline"))}</div>
      ${
        isGlobal
          ? `<div class="hs-verdict global">${escapeHtml(t("pair.notPricedHere", { quoted: quotedText }))}</div>`
          : `<div class="hs-verdict local">${escapeHtml(t("pair.pricedHere"))}</div>`
      }
      ${incomeLine ? `<div class="hs-line">${escapeHtml(incomeLine)}</div>` : ""}
      ${refLine ? `<div class="hs-line">${escapeHtml(refLine)}</div>` : ""}
      ${changeLine ? `<div class="hs-line">${escapeHtml(changeLine)}</div>` : ""}
      <div class="hs-line"><a href="${escapeHtml(servicePath(serviceId, locale))}">${escapeHtml(svc.name)}</a> · <a href="${escapeHtml(marketPath(marketId, locale))}">${escapeHtml(m.nameLocal[locale] || m.name)}</a></div>
    </div>
  </div>

  <div class="two-col">
    <div>
      ${panel(
      t("pair.pricesTitle"),
      `${plansTable}${
        rows.some((r) => r.note)
          ? `<div class="notes">${rows
              .filter((r) => r.note)
              .map((r) => `<p class="small"><b>${escapeHtml(planLabel(t, r.plan))}:</b> ${escapeHtml(r.note)}</p>`)
              .join("")}</div>`
          : ""
      }`
    )}
      ${panel(t("pair.historyTitle"), `${chart}<p class="small faint">${escapeHtml(t("pair.historyLede", { service: svc.name, market: m.nameLocal[locale] || m.name }))}</p>`)}
    </div>
    <div>
      ${receipt}
      ${
        howNote
          ? panel(t("pair.howTitle"), `<p>${escapeHtml(howNote)}</p><p class="small faint">${escapeHtml(t("pair.howLede"))}</p>`)
          : ""
      }
      ${
        alternatives
          ? panel(t("pair.altTitle"), `${alternatives}<p class="small faint">${escapeHtml(t("pair.altLede"))}</p>`)
          : ""
      }
      ${panel(t("pair.relatedTitle", { market: m.nameLocal[locale] || m.name }), relatedList)}
    </div>
  </div>
  `;

  return {
    title: t("pair.title", { service: svc.name, market: m.nameLocal[locale] || m.name, price: priceText }),
    description: t("pair.lede", { service: svc.name, market: m.nameLocal[locale] || m.name, price: priceText, share: num(flagEci != null ? flagEci.toFixed(2) : "—") + "%" }),
    body,
  };
}
