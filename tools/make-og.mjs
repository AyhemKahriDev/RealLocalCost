#!/usr/bin/env node
/* ============================================================
   make-og.mjs — render the social card
   ------------------------------------------------------------
   public/og.html  ->  public/og.png (1280x630)

   Uses the Chromium that ships with the local toolchain, so it costs
   nothing and needs no image library.

     node tools/make-og.mjs
   ============================================================ */

import { readFile, writeFile, stat, copyFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "og.png");
const HTML = join(ROOT, "public", "og.html");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/home/ayhem/.hermes/tools/chromium-1208/chrome-linux64/chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].filter(Boolean);

async function findChrome() {
  for (const c of CHROME_CANDIDATES) {
    if (existsSync(c)) return c;
  }
  return null;
}

async function main() {
  const chrome = await findChrome();
  if (!chrome) {
    console.log("no Chromium found — skipping the social card");
    return;
  }

  /* Render taller than the card and crop down. Headless Chrome's
     viewport clipping has been unreliable about the last flex row at
     exactly 630px; cropping is deterministic. */
  const tall = OUT.replace(/\.png$/, ".tall.png");
  await exec(chrome, [
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1280,900",
    `--screenshot=${tall}`,
    `file://${HTML}`,
  ]);

  const s = await stat(tall);
  if (s.size < 1000) {
    console.log("the social card came out empty — skipping");
    return;
  }

  await exec("convert", [tall, "-crop", "1280x630+0+0", "+repage", OUT]);
  await rm(tall, { force: true });

  const out = await stat(OUT);
  console.log(`wrote ${OUT} (${Math.round(out.size / 1024)} KB)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
