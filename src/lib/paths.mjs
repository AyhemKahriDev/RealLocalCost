/* URL scheme.

   EN lives at the root (the site's original language), FR and AR live
   under a locale prefix:

     /                     /fr/                 /ar/
     /spotify/             /fr/spotify/         /ar/spotify/
     /m/tn/                /fr/m/tn/            /ar/m/tn/
     /spotify/tn/          /fr/spotify/tn/      /ar/spotify/tn/
     /method/              /fr/method/          /ar/method/
*/

export const LOCALES = ["en", "fr", "ar"];

/* The site is published at two places: a domain root, and under a
   repository path on GitHub Pages. The base is set at build time so
   every link and every asset resolves in both places. */
let BASE = "/";
export function setBase(b) {
  BASE = b && b.startsWith("/") ? b : `/${b || ""}`;
  if (!BASE.endsWith("/")) BASE += "/";
  return BASE;
}
export function getBase() {
  return BASE;
}

/** The path without the base — what the canonical URL should use. */
export function stripBase(path) {
  if (BASE !== "/" && path.startsWith(BASE)) return "/" + path.slice(BASE.length);
  return path;
}

export function homePath(locale = "en") {
  return `${BASE}${locale === "en" ? "" : locale + "/"}`;
}

export function servicePath(service, locale = "en") {
  return `${BASE}${locale === "en" ? "" : locale + "/"}${service}/`;
}

export function marketPath(market, locale = "en") {
  return `${BASE}${locale === "en" ? "" : locale + "/"}m/${market}/`;
}

export function pairPath(service, market, locale = "en") {
  return `${BASE}${locale === "en" ? "" : locale + "/"}${service}/${market}/`;
}

export function pagePath(slug, locale = "en") {
  return `${BASE}${locale === "en" ? "" : locale + "/"}${slug}/`;
}

/**
 * Turn a site path into a path on disk (site/<...>/index.html).
 * The base is a URL prefix, never part of the file layout: a site
 * published at /RealLocalCost/ and one published at / are the same
 * files, linked differently.
 */
export function toFile(path) {
  let clean = path;
  if (BASE !== "/" && clean.startsWith(BASE)) clean = clean.slice(BASE.length);
  clean = clean.replace(/^\/+|\/+$/g, "");
  return clean ? `site/${clean}/index.html` : "site/index.html";
}

/** Every locale variant of a logical page, for hreflang. */
export function alternatesFor(kind, args = {}) {
  const out = {};
  for (const l of LOCALES) {
    if (kind === "home") out[l] = homePath(l);
    else if (kind === "service") out[l] = servicePath(args.service, l);
    else if (kind === "market") out[l] = marketPath(args.market, l);
    else if (kind === "pair") out[l] = pairPath(args.service, args.market, l);
    else if (kind === "page") out[l] = pagePath(args.slug, l);
  }
  return out;
}
