#!/usr/bin/env node
/* ============================================================
   build.mjs — the static site generator
   ------------------------------------------------------------
   No framework. Node built-ins only. Reads data/, writes site/.

     node src/build.mjs
   ============================================================ */

import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadAll } from "./lib/data.mjs";
import { loadAllLocales, makeT, LOCALES, DIR, HTML_LANG, LOCALE_NAME } from "./lib/i18n.mjs";
import { layout } from "./layout.mjs";
import {
  homePath, servicePath, marketPath, pairPath, pagePath,
  alternatesFor, toFile, LOCALES as PATH_LOCALES,
} from "./lib/paths.mjs";
import { renderHome } from "./pages/home.mjs";
import { renderService, renderMarket } from "./pages/service.mjs";
import { renderPair } from "./pages/pair.mjs";
import { renderMethod, renderWire, renderData } from "./pages/static.mjs";
import { renderServices, renderMarkets } from "./pages/indexes.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "site");

async function writePage(path, html) {
  const file = toFile(path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
  return path;
}

function page(ctx, rendered, alternates) {
  return layout({
    t: ctx.t,
    locale: ctx.locale,
    title: rendered.title,
    description: rendered.description,
    body: rendered.body,
    alternates,
    canonical: alternates[ctx.locale],
  });
}

async function main() {
  const data = await loadAll();
  const dicts = await loadAllLocales();

  await rm(SITE, { recursive: true, force: true });
  await mkdir(SITE, { recursive: true });

  const written = [];
  const sitemaps = [];

  for (const locale of LOCALES) {
    const t = makeT(dicts[locale], dicts.en);
    const ctx = { t, locale, data, dir: DIR[locale] };

    /* ---- home ---- */
    const homeAlts = alternatesFor("home");
    written.push(await writePage(homePath(locale), page(ctx, renderHome(ctx), homeAlts)));
    sitemaps.push({ loc: homePath(locale), alt: homeAlts, priority: "1.0" });

    /* ---- service hubs ---- */
    for (const sid of data.activeServices()) {
      const rendered = renderService(ctx, sid);
      if (!rendered) continue;
      const alts = alternatesFor("service", { service: sid });
      written.push(await writePage(servicePath(sid, locale), page(ctx, rendered, alts)));
      sitemaps.push({ loc: servicePath(sid, locale), alt: alts, priority: "0.8" });
    }

    /* ---- market hubs ---- */
    for (const mid of data.activeMarkets()) {
      const rendered = renderMarket(ctx, mid);
      if (!rendered) continue;
      const alts = alternatesFor("market", { market: mid });
      written.push(await writePage(marketPath(mid, locale), page(ctx, rendered, alts)));
      sitemaps.push({ loc: marketPath(mid, locale), alt: alts, priority: "0.8" });
    }

    /* ---- service × market ---- */
    for (const [key, rows] of data.pairs) {
      const [sid, mid] = key.split("|");
      const rendered = renderPair(ctx, sid, mid);
      if (!rendered) continue;
      const alts = alternatesFor("pair", { service: sid, market: mid });
      written.push(await writePage(pairPath(sid, mid, locale), page(ctx, rendered, alts)));
      sitemaps.push({ loc: pairPath(sid, mid, locale), alt: alts, priority: "0.9" });
    }

    /* ---- static pages ---- */
    for (const [slug, fn] of [
      ["method", renderMethod],
      ["wire", renderWire],
      ["data", renderData],
      ["services", renderServices],
      ["markets", renderMarkets],
    ]) {
      const rendered = fn(ctx);
      const alts = alternatesFor("page", { slug });
      written.push(await writePage(pagePath(slug, locale), page(ctx, rendered, alts)));
      sitemaps.push({ loc: pagePath(slug, locale), alt: alts, priority: "0.6" });
    }
  }

  /* ---- public assets ---- */
  await cp(join(ROOT, "public"), join(SITE, "assets"), { recursive: true });

  /* ---- the data files the site publishes ---- */
  await mkdir(join(SITE, "data"), { recursive: true });
  await writeFile(
    join(SITE, "data", "prices.json"),
    JSON.stringify(
      {
        _comment:
          "The Real Local Cost — verified prices with history and receipts. CC0. https://github.com/AyhemKahriDev/TheRealLocalCost",
        updatedAt: data.pricesUpdatedAt,
        rows: data.rows,
      },
      null,
      2
    ) + "\n"
  );
  await writeFile(join(SITE, "data", "prices.csv"), toCsv(data.rows));
  await cp(join(ROOT, "data", "income.json"), join(SITE, "data", "income.json"));

  /* ---- sitemap ---- */
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemaps
  .map(
    (s) => `  <url>
    <loc>${s.loc}</loc>
    <xhtml:link rel="alternate" hreflang="${HTML_LANG.en}" href="${s.alt.en}"/>
    <xhtml:link rel="alternate" hreflang="${HTML_LANG.fr}" href="${s.alt.fr}"/>
    <xhtml:link rel="alternate" hreflang="${HTML_LANG.ar}" href="${s.alt.ar}"/>
    <priority>${s.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
  await writeFile(join(SITE, "sitemap.xml"), xml);
  await writeFile(join(SITE, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n");

  console.log(`built ${written.length} pages → site/`);
  console.log(
    `  services: ${data.activeServices().join(", ") || "—"}`
  );
  console.log(`  markets: ${data.activeMarkets().join(", ") || "—"}`);
  console.log(`  rows: ${data.rows.length}, pairs: ${data.pairs.size}`);
}

function toCsv(rows) {
  const head = ["service", "market", "plan", "price", "currency", "verified", "receipt", "history_points"];
  const lines = [head.join(",")];
  for (const r of rows) {
    const hist = (r.history || []).map((h) => `${h.date}:${h.price}`).join(" ");
    const receipt = (r.receipt && (r.receipt.url || "")) || "";
    lines.push(
      [
        csv(r.service),
        csv(r.market),
        csv(r.plan),
        r.price,
        csv(r.currency),
        csv(r.verified || ""),
        csv(receipt),
        csv(hist),
      ].join(",")
    );
  }
  return lines.join("\n") + "\n";
}

function csv(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
