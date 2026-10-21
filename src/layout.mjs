import { escapeHtml, latinDigits } from "./lib/fmt.mjs";
import { homePath, pagePath, LOCALES } from "./lib/paths.mjs";
import { LOCALE_NAME, DIR, HTML_LANG } from "./lib/i18n.mjs";
import { SITE } from "./lib/config.mjs";

/**
 * The HTML shell.
 * @param {object} o
 * @param {Function} o.t        translator
 * @param {string} o.locale
 * @param {string} o.title
 * @param {string} o.description
 * @param {string} o.body
 * @param {object} o.alternates  { en: path, fr: path, ar: path }
 * @param {string} o.canonical   canonical path (no domain)
 */
export function layout(o) {
  const { t, locale, title, description, body, alternates = {}, canonical = "/" } = o;
  const dir = DIR[locale] || "ltr";

  const altLinks = LOCALES.map(
    (l) =>
      `<link rel="alternate" hreflang="${HTML_LANG[l]}" href="${alternates[l] ? escapeHtml(alternates[l]) : "#"}">`
  ).join("\n    ");

  const nav = [
    { href: pagePath("markets", locale), label: t("nav.markets") },
    { href: pagePath("services", locale), label: t("nav.services") },
    { href: pagePath("localises", locale), label: t("nav.localises") },
    { href: pagePath("cheapest", locale), label: t("nav.cheapest") },
    { href: pagePath("calculator", locale), label: t("nav.calculator") },
    { href: pagePath("method", locale), label: t("nav.method") },
    { href: pagePath("wire", locale), label: t("nav.wire") },
    { href: pagePath("data", locale), label: t("nav.data") },
  ];

  const langSwitch = LOCALES.map((l) => {
    const href = alternates[l];
    const label = LOCALE_NAME[l];
    if (!href) return "";
    const cur = l === locale ? ' class="active" aria-current="true"' : "";
    return `<a href="${escapeHtml(href)}"${cur} lang="${HTML_LANG[l]}" hreflang="${HTML_LANG[l]}">${escapeHtml(label)}</a>`;
  }).join("");

  /* Every page title carries the brand, so a search result never reads
     as an orphan. The home page already includes it. */
  const fullTitle = title.includes(SITE.name) ? title : `${title} — ${SITE.name}`;

  return `<!doctype html>
<html lang="${HTML_LANG[locale]}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(SITE.url.replace(/\/$/, "") + canonical)}">
  <meta property="og:url" content="${escapeHtml(SITE.url.replace(/\/$/, "") + canonical)}">
  <meta property="og:site_name" content="${escapeHtml(SITE.name)}">
  ${altLinks}
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(fullTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:locale" content="${HTML_LANG[locale]}">
  <meta name="twitter:card" content="summary_large_image">
  <meta property="og:image" content="${escapeHtml(SITE.url.replace(/\/$/, "") + "/og.png")}">
  <meta name="twitter:image" content="${escapeHtml(SITE.url.replace(/\/$/, "") + "/og.png")}">
  <link rel="stylesheet" href="/assets/style.css">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
</head>
<body>
  <header class="topnav">
    <div class="wrap nav-inner">
      <a class="brand" href="${homePath(locale)}"><span class="tri">▾</span> ${escapeHtml(SITE.name)}</a>
      <nav class="nav-links">
        ${nav.map((n) => `<a href="${escapeHtml(n.href)}">${escapeHtml(n.label)}</a>`).join("\n        ")}
        <span class="langsw" role="group" aria-label="Language">${langSwitch}</span>
      </nav>
    </div>
  </header>
  <main class="wrap">
${body}
  </main>
  <footer class="sitefoot">
    <div class="wrap">
      <p><strong>${escapeHtml(SITE.name)}</strong> — ${escapeHtml(SITE.tagline[locale] || SITE.tagline.en)}</p>
      <p class="foot-dim">${escapeHtml(t("footer.note"))}</p>
      <p class="foot-dim">${escapeHtml(t("footer.license"))} · <a href="${escapeHtml(pagePath("method", locale))}">${escapeHtml(t("nav.method"))}</a> · <a href="${escapeHtml(pagePath("data", locale))}">${escapeHtml(t("nav.data"))}</a></p>
    </div>
  </footer>
  <script src="/assets/app.js" defer></script>
</body>
</html>`;
}

/** A small panel with a heading, used all over the pages. */
export function panel(title, inner, cls = "") {
  return `<section class="panel ${cls}">
  ${title ? `<h2 class="panel-h">${escapeHtml(title)}</h2>` : ""}
  ${inner}
</section>`;
}

/** A definition-style row used in the method and data panels. */
export function kv(label, value) {
  return `<div class="kv"><span class="kv-k">${escapeHtml(label)}</span><span class="kv-v">${value}</span></div>`;
}

/** The verification badge every published price carries. */
export function verifiedBadge(t, row) {
  if (!row || !row.verified) {
    return `<span class="chip a" title="${escapeHtml(t("method.unverifiedTitle"))}">${escapeHtml(t("badge.unverified"))}</span>`;
  }
  const age = daysSince(row.verified);
  const cls = age <= 45 ? "g" : age <= 120 ? "a" : "r";
  return `<span class="chip ${cls}" title="${escapeHtml(t("method.verifiedTitle", { date: row.verified }))}">${escapeHtml(t("badge.verified"))} ${escapeHtml(row.verified)}</span>`;
}

export function daysSince(iso) {
  if (!iso) return Infinity;
  const then = Date.parse(iso + "T00:00:00Z");
  if (Number.isNaN(then)) return Infinity;
  return Math.floor((Date.now() - then) / 86400000);
}

/** Numbers are quoted in Latin digits on every locale, so a reader can
    compare two markets without translating numerals. */
export function num(v) {
  return latinDigits(String(v));
}
