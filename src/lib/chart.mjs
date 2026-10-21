/* ============================================================
   chart.mjs — hand-rolled SVG, rendered at build time
   ------------------------------------------------------------
   No client-side charting library, no hydration, no runtime cost.
   The server emits finished SVG so the chart is in the HTML the
   crawler sees, and the page still works with JavaScript disabled.
   ============================================================ */

import { escapeHtml } from "./fmt.mjs";

const PALETTE = ["#7aa2ff", "#f5a524", "#4cc38a", "#ff5d5d", "#c792ea", "#3ddbd9"];

function niceStep(range) {
  const raw = range / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/**
 * A line chart over time.
 * @param {Array<{label:string, points:Array<{date:string,value:number}>}>} series
 * @param {object} opts
 */
export function lineChart(series, opts = {}) {
  const W = opts.w || 720;
  const H = opts.h || 260;
  const L = opts.left ?? 58;
  const R = 14;
  const T = 14;
  const B = 30;
  const iw = W - L - R;
  const ih = H - T - B;
  const yFmt = opts.yFmt || ((v) => String(v));

  const all = [];
  for (const s of series) for (const p of s.points) all.push({ ...p, name: s.label });

  if (all.length < 2) {
    return `<div class="emptyblock">${escapeHtml(opts.empty || "Not enough points to chart yet.")}</div>`;
  }

  const times = all.map((p) => Date.parse(p.date + (p.date.length === 10 ? "T00:00:00Z" : "")));
  let x0 = Math.min(...times);
  let x1 = Math.max(...times);
  if (x1 === x0) x1 = x0 + 1;

  let yMin = Math.min(...all.map((p) => p.value));
  let yMax = Math.max(...all.map((p) => p.value));
  const pad = (yMax - yMin) * 0.12 || Math.max(yMax * 0.08, 0.5);
  yMin = Math.max(0, yMin - pad);
  yMax = yMax + pad;
  const step = niceStep(yMax - yMin);
  const yTop = Math.ceil(yMax / step) * step;
  const yBot = Math.max(0, Math.floor(yMin / step) * step);

  const X = (t) => L + ((t - x0) / (x1 - x0)) * iw;
  const Y = (v) => T + (1 - (v - yBot) / ((yTop - yBot) || 1)) * ih;

  const out = [];
  out.push(
    `<svg viewBox="0 0 ${W} ${H}" role="img" class="chart-svg" preserveAspectRatio="xMidYMid meet">`
  );
  out.push(`<title>${escapeHtml(opts.title || "Price history")}</title>`);

  for (let v = yBot; v <= yTop + 1e-9; v += step) {
    const yv = Y(v);
    out.push(`<line class="gridline" x1="${L}" y1="${yv.toFixed(1)}" x2="${W - R}" y2="${yv.toFixed(1)}"/>`);
    out.push(
      `<text class="axis-t" x="${L - 8}" y="${(yv + 3.5).toFixed(1)}" text-anchor="end">${escapeHtml(yFmt(v))}</text>`
    );
  }

  // x ticks: roughly six, evenly spaced
  const ticks = 6;
  for (let i = 0; i <= ticks; i++) {
    const t = x0 + ((x1 - x0) * i) / ticks;
    const xv = X(t);
    out.push(
      `<line class="gridline" x1="${xv.toFixed(1)}" y1="${T}" x2="${xv.toFixed(1)}" y2="${T + ih}" stroke-dasharray="2 4"/>`
    );
    out.push(
      `<text class="axis-t" x="${xv.toFixed(1)}" y="${H - 9}" text-anchor="middle">${escapeHtml(shortDate(t))}</text>`
    );
  }

  series.forEach((s, si) => {
    if (s.points.length < 2) return;
    const color = s.color || PALETTE[si % PALETTE.length];
    const pts = s.points
      .map((p) => ({
        t: Date.parse(p.date + (p.date.length === 10 ? "T00:00:00Z" : "")),
        v: p.value,
        date: p.date,
      }))
      .sort((a, b) => a.t - b.t);

    let dPath = "";
    pts.forEach((p, j) => {
      dPath += (j ? "L" : "M") + X(p.t).toFixed(1) + " " + Y(p.v).toFixed(1) + " ";
    });
    out.push(
      `<path d="${dPath}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`
    );
    for (const p of pts) {
      out.push(
        `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3.6" fill="${color}">` +
          `<title>${escapeHtml((s.label ? s.label + " — " : "") + p.date + " · " + yFmt(p.v))}</title>` +
          `</circle>`
      );
    }
  });

  out.push("</svg>");
  return out.join("");
}

/**
 * Horizontal bars for an ECI ranking.
 * @param {Array<{label:string, value:number, sub?:string, href?:string}>} items
 */
export function barChart(items, opts = {}) {
  if (!items.length) {
    return `<div class="emptyblock">${escapeHtml(opts.empty || "No data yet.")}</div>`;
  }
  const W = opts.w || 720;
  const rowH = opts.rowH || 30;
  const L = opts.left ?? 150;
  const R = 70;
  const H = items.length * rowH + 10;
  const iw = W - L - R;
  const max = Math.max(...items.map((i) => i.value)) || 1;

  const out = [`<svg viewBox="0 0 ${W} ${H}" role="img" class="chart-svg" preserveAspectRatio="xMidYMid meet">`];
  out.push(`<title>${escapeHtml(opts.title || "Ranking")}</title>`);

  items.forEach((it, i) => {
    const y = i * rowH + 6;
    const w = Math.max(2, (it.value / max) * iw);
    const color = it.color || barColor(it.value);
    out.push(
      `<text class="axis-t axis-l" x="${L - 10}" y="${(y + 15).toFixed(1)}" text-anchor="end">${escapeHtml(it.label)}</text>`
    );
    out.push(
      `<rect x="${L}" y="${(y + 5).toFixed(1)}" width="${w.toFixed(1)}" height="14" rx="3" fill="${color}" opacity="0.9">` +
        `<title>${escapeHtml(it.label + " · " + (opts.valueFmt ? opts.valueFmt(it.value) : it.value))}</title></rect>`
    );
    out.push(
      `<text class="axis-t axis-v" x="${(L + w + 8).toFixed(1)}" y="${(y + 16).toFixed(1)}">` +
        `${escapeHtml(opts.valueFmt ? opts.valueFmt(it.value) : String(it.value))}</text>`
    );
  });

  out.push("</svg>");
  return out.join("");
}

function barColor(v) {
  if (v < 0.5) return "#4cc38a";
  if (v < 1.5) return "#3ddbd9";
  if (v < 3) return "#f5a524";
  return "#ff5d5d";
}

/** Inline sparkline for card rows. */
export function sparkline(points, opts = {}) {
  if (!points || points.length < 2) return "";
  const W = opts.w || 240;
  const H = opts.h || 34;
  const color = opts.color || "#7aa2ff";
  const times = points.map((p) => Date.parse(p.date + "T00:00:00Z"));
  const vals = points.map((p) => p.value);
  const x0 = Math.min(...times);
  const x1 = Math.max(...times);
  const y0 = Math.min(...vals);
  const y1 = Math.max(...vals);
  if (x1 === x0) return "";
  if (y1 === y0) return "";
  const X = (t) => 2 + ((t - x0) / (x1 - x0)) * (W - 4);
  const Y = (v) => H - 3 - ((v - y0) / (y1 - y0)) * (H - 6);
  let d = "";
  points.forEach((p, i) => {
    d += (i ? "L" : "M") + X(times[i]).toFixed(1) + " " + Y(p.value).toFixed(1) + " ";
  });
  const last = points[points.length - 1];
  return (
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="display:block;width:100%;height:${H}px">` +
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.8"/>` +
    `<circle cx="${X(times[times.length - 1]).toFixed(1)}" cy="${Y(last.value).toFixed(1)}" r="2.4" fill="${color}">` +
    `<title>${escapeHtml(opts.tip || "")} ${last.value}</title></circle></svg>`
  );
}

function shortDate(t) {
  const d = new Date(t);
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${m[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}
