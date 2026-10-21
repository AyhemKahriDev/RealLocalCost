/* ============================================================
   http.mjs — free, keyless network helpers
   ------------------------------------------------------------
   Everything here uses public endpoints that require no API key
   and no account:
     · live pages                (fetch)
     · the Wayback Machine CDX   (archived snapshot index)
   ============================================================ */

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const TIMEOUT_MS = 35000;

export async function fetchText(url, { timeout = TIMEOUT_MS, headers = {}, retries = 2 } = {}) {
  let last = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1200 * attempt));
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeout);
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: ac.signal,
        headers: { "user-agent": UA, "accept-language": "en,fr,ar;q=0.8", ...headers },
      });
      const body = await res.text();
      last = { ok: res.ok, status: res.status, finalUrl: res.url || url, body };
      // The Wayback throttles hard. Back off and try again.
      if (res.status === 429) continue;
      return last;
    } catch (err) {
      last = { ok: false, status: 0, finalUrl: url, body: "", error: String((err && err.message) || err) };
    } finally {
      clearTimeout(timer);
    }
  }
  return last;
}

export async function fetchJson(url, opts = {}) {
  const r = await fetchText(url, opts);
  if (!r.ok) return { ...r, json: null };
  try {
    return { ...r, json: JSON.parse(r.body) };
  } catch {
    return { ...r, json: null };
  }
}

/**
 * Query the Wayback CDX index.
 * @param {string} pattern  url pattern, e.g. "spotify.com/fr/premium/"
 * @param {object} opts
 * @param {number} opts.limit
 * @param {string} opts.from  YYYYMMDD
 * @param {string} opts.to    YYYYMMDD
 * @param {boolean} opts.collapse  collapse duplicate URLs
 * @returns {Promise<Array<{timestamp:string,original:string,statuscode:string,digest:string}>>}
 */
export async function cdxList(pattern, opts = {}) {
  const { limit = 60, from = "", to = "", collapse = "digest" } = opts;
  const params = new URLSearchParams({
    url: pattern,
    output: "json",
    fl: "original,timestamp,statuscode,digest",
    limit: String(limit),
  });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (collapse) params.set("collapse", collapse);

  const r = await fetchJson(`https://web.archive.org/cdx/search/cdx?${params.toString()}`);
  if (!r.json || !Array.isArray(r.json) || r.json.length < 2) return [];

  const header = r.json[0];
  const idx = {
    original: header.indexOf("original"),
    timestamp: header.indexOf("timestamp"),
    statuscode: header.indexOf("statuscode"),
    digest: header.indexOf("digest"),
  };
  return r.json
    .slice(1)
    .map((row) => ({
      original: row[idx.original] ?? "",
      timestamp: row[idx.timestamp] ?? "",
      statuscode: row[idx.statuscode] ?? "",
      digest: row[idx.digest] ?? "",
    }))
    .filter((x) => x.timestamp);
}

/** Wayback URL that returns the raw archived bytes (no toolbar chrome). */
export function waybackUrl(original, timestamp) {
  return `https://web.archive.org/web/${timestamp}id_/${original}`;
}

/** Most recent archived snapshot at or before a date. */
export function snapshotNearest(list, targetTs) {
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  let best = null;
  for (const s of sorted) {
    if (s.timestamp <= targetTs) best = s;
    else break;
  }
  return best || sorted[0];
}

/** Evenly spaced picks across a sorted snapshot list, newest last. */
export function sampleSnapshots(list, count) {
  const sorted = [...list]
    .filter((s) => s.statuscode === "200")
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  if (sorted.length <= count) return sorted;
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(sorted[Math.round((i * (sorted.length - 1)) / (count - 1))]);
  }
  return out;
}

/**
 * CDX truncates at `limit` and returns oldest-first, so a single wide
 * query hides every recent snapshot. Query year by year instead —
 * in parallel, because each year is an independent request.
 */
export async function cdxByYear(prefix, { fromYear = 2021, toYear = new Date().getFullYear(), perYear = 60 } = {}) {
  const years = [];
  for (let y = fromYear; y <= toYear; y++) years.push(y);
  const chunks = await Promise.all(
    years.map((y) =>
      cdxList(prefix, {
        limit: perYear,
        from: `${y}0101`,
        to: `${y}1231`,
        collapse: "digest",
      })
    )
  );
  return chunks.flat();
}
