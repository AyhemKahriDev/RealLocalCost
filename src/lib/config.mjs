/* The site identity, loaded once at build time. */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

let site = null;

export async function loadSite() {
  if (site) return site;
  const raw = await readFile(join(ROOT, "site.config.json"), "utf8");
  site = JSON.parse(raw);
  return site;
}

/** Synchronous access, for modules imported after loadSite() has run. */
export const SITE = {
  name: "Real Local Cost",
  tagline: { en: "", fr: "", ar: "" },
  description: { en: "", fr: "", ar: "" },
  url: "https://reallocalcost.pages.dev",
  repo: "https://github.com/AyhemKahriDev/RealLocalCost",
};

export function applySite(loaded) {
  Object.assign(SITE, loaded);
  return SITE;
}
