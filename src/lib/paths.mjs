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

export function homePath(locale = "en") {
  return locale === "en" ? "/" : `/${locale}/`;
}

export function servicePath(service, locale = "en") {
  return locale === "en" ? `/${service}/` : `/${locale}/${service}/`;
}

export function marketPath(market, locale = "en") {
  return locale === "en" ? `/m/${market}/` : `/${locale}/m/${market}/`;
}

export function pairPath(service, market, locale = "en") {
  return locale === "en" ? `/${service}/${market}/` : `/${locale}/${service}/${market}/`;
}

export function pagePath(slug, locale = "en") {
  return locale === "en" ? `/${slug}/` : `/${locale}/${slug}/`;
}

/** Turn a site path into a path on disk (site/<...>/index.html). */
export function toFile(path) {
  const clean = path.replace(/^\/+|\/+$/g, "");
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
