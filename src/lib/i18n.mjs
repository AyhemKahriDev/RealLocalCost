/* Localisation: EN / FR / AR. No framework, no build magic. */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const LOCALES = ["en", "fr", "ar"];
export const DEFAULT_LOCALE = "en";
export const DIR = { en: "ltr", fr: "ltr", ar: "rtl" };
export const LOCALE_NAME = { en: "English", fr: "Français", ar: "العربية" };

const cache = new Map();

export async function loadLocale(code) {
  if (cache.has(code)) return cache.get(code);
  const raw = await readFile(join(ROOT, "src", "i18n", `${code}.json`), "utf8");
  const dict = JSON.parse(raw);
  cache.set(code, dict);
  return dict;
}

export async function loadAllLocales() {
  const out = {};
  for (const l of LOCALES) out[l] = await loadLocale(l);
  return out;
}

/**
 * Translate with {placeholder} interpolation and a dotted fallback path.
 * Missing keys fall back to English, then to the key itself — a missing
 * translation must never blank out a page.
 */
export function makeT(dict, fallback) {
  const get = (obj, path) =>
    path.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);

  return function t(key, vars) {
    let v = get(dict, key);
    if (v == null && fallback) v = get(fallback, key);
    if (v == null) return key;
    if (typeof v !== "string") return v;
    if (!vars) return v;
    return v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  };
}

/** BCP-47 tags for <html lang> and hreflang. */
export const HTML_LANG = { en: "en", fr: "fr", ar: "ar" };
