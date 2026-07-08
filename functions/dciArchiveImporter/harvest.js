// Step 1: Find and download the best Wayback snapshot of the dci.org scores
// page for each season, 2000-2012.
//
// The scores dropdown lists the season *to date*, so we want the LATEST good
// snapshot of the season - late August through the following winter, before
// the site rolled the page over to the next year. For each year we query the
// Wayback CDX API for 200-status captures of the scores page in that window,
// then download the newest one that actually contains event rows.
//
// Writes snapshots.json (year -> {timestamp, url, original, bytes}) and caches
// the raw HTML in cache/{year}.html. snapshots.json is committed so parse.js /
// apply.js can run without re-harvesting; cache/ is gitignored.
//
// Usage:
//   node harvest.js                # all years
//   node harvest.js --years 2004,2005
//   node harvest.js --force        # re-download even if cached

const fs = require("fs");
const path = require("path");
const {
  YEARS, WAYBACK_CDX, WAYBACK_SNAPSHOT, CACHE_DIR, SNAPSHOTS_PATH,
} = require("./config");

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const yearFilter = args.includes("--years")
  ? args[args.indexOf("--years") + 1].split(",")
  : YEARS;

// 2000-2003 predate the CFM dropdown; their season lists live in the
// showmonth.php monthly pages instead. Harvested month-by-month.
const SHOWMONTH_YEARS = new Set(["2000", "2001", "2002", "2003"]);
const SHOWMONTH_MONTHS = ["05", "06", "07", "08", "09"];

// Candidate CFM score-page paths, most-preferred first.
const SCORE_PATHS = ["scores/", "scores", "scores/index.cfm"];

async function fetchWithRetry(url, { asBuffer = false, tries = 4 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return asBuffer ? Buffer.from(await res.arrayBuffer()) : res.text();
    } catch (err) {
      lastErr = err;
      const backoff = 2000 * 2 ** attempt;
      console.warn(`  retry ${attempt + 1}/${tries} after ${backoff}ms: ${err.message}`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

// Query CDX for 200-status captures of the scores page across the season
// window, newest first. Returns [{timestamp, original}].
async function listSnapshots(year) {
  // The event dropdown is populated from the season's first shows (June)
  // through the fall, then reset for the next year. Scan the whole window
  // newest-first and keep the last capture that still lists events.
  const from = `${year}0601`;
  const to = `${Number(year) + 1}0301`;
  const url = `${WAYBACK_CDX}?url=dci.org/scores*&from=${from}&to=${to}` +
    "&output=json&fl=timestamp,original,statuscode&filter=statuscode:200" +
    "&collapse=digest&limit=200";
  const text = await fetchWithRetry(url);
  let rows;
  try {
    rows = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(rows) || rows.length <= 1) return [];
  rows.shift(); // header row
  return rows
    .map(([timestamp, original]) => ({ timestamp, original }))
    .filter(({ original }) => {
      const p = original.replace(/^https?:\/\/(www\.)?dci\.org(:80)?\//i, "")
        .replace(/\?.*$/, "").toLowerCase();
      return SCORE_PATHS.includes(p);
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// A CFM capture is "useful" only if it carries the SCORES event dropdown - an
// option value with event_id=/event= and a UUID (2004-2012, across the
// ?event_id=, ?event= and index.cfm?event= value variants). A bare
// <select name="listboxmenu"> is NOT enough: off-season snapshots keep the
// corps-navigation dropdown but drop the event list, so we skip those to find
// the last in-season capture where the whole season is listed.
function looksUseful(html) {
  return /\bevent(?:_id)?=[a-f0-9]{8}/.test(html);
}

// A showmonth month page is useful if it lists at least one scored event.
function showmonthUseful(html) {
  return /results\.php\?xId=\d+/.test(html);
}

async function harvestYear(year) {
  const dest = path.join(CACHE_DIR, `${year}.html`);
  if (!FORCE && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    console.log(`${year}: cached ${path.basename(dest)}`);
    // Preserve any recorded metadata; fall back to a cache-only marker.
    return null;
  }

  const candidates = await listSnapshots(year);
  if (candidates.length === 0) {
    console.warn(`${year}: no 200-status scores snapshot found in window.`);
    return null;
  }

  for (const cand of candidates) {
    const snapUrl = WAYBACK_SNAPSHOT(cand.timestamp, cand.original);
    let html;
    try {
      html = await fetchWithRetry(snapUrl);
    } catch (err) {
      console.warn(`  ${cand.timestamp}: fetch failed (${err.message}), trying older.`);
      continue;
    }
    if (!looksUseful(html)) {
      console.warn(`  ${cand.timestamp}: no event rows, trying older.`);
      continue;
    }
    fs.writeFileSync(dest, html);
    console.log(`${year}: saved ${cand.timestamp} ${cand.original} (${html.length} bytes)`);
    return {
      timestamp: cand.timestamp,
      original: cand.original,
      url: snapUrl,
      bytes: html.length,
    };
  }
  console.warn(`${year}: none of ${candidates.length} candidates had event rows.`);
  return null;
}

// List showmonth.php month captures for a season: query CDX for every
// showmonth page, keep the ones whose query string targets this year, and
// group by month -> newest capture per month.
async function listShowmonthSnapshots(year) {
  const from = `${year}0101`;
  const to = `${Number(year) + 2}0101`;
  const url = `${WAYBACK_CDX}?url=dci.org/scores/showmonth.php*&from=${from}` +
    `&to=${to}&output=json&fl=timestamp,original&filter=statuscode:200` +
    "&collapse=digest&limit=500";
  const text = await fetchWithRetry(url);
  let rows;
  try {
    rows = JSON.parse(text);
  } catch {
    return new Map();
  }
  if (!Array.isArray(rows) || rows.length <= 1) return new Map();
  rows.shift();

  const byMonth = new Map(); // "07" -> {timestamp, original}
  for (const [timestamp, original] of rows) {
    const ym = original.match(/[?&]year=(\d{4})/);
    const mm = original.match(/[?&]month=(\d{1,2})/);
    let targetYear;
    let month;
    if (ym && mm) {
      // Parametrized page: the query string names the season/month directly.
      targetYear = ym[1];
      month = mm[1].padStart(2, "0");
    } else {
      // Bare showmonth.php renders the *capture date's* month, so infer the
      // season and month from the snapshot timestamp (YYYYMMDD...).
      targetYear = timestamp.slice(0, 4);
      month = timestamp.slice(4, 6);
    }
    if (targetYear !== String(year) || !SHOWMONTH_MONTHS.includes(month)) continue;
    const prev = byMonth.get(month);
    if (!prev || timestamp > prev.timestamp) {
      byMonth.set(month, { timestamp, original });
    }
  }
  return byMonth;
}

async function harvestShowmonthYear(year) {
  const byMonth = await listShowmonthSnapshots(year);
  if (byMonth.size === 0) {
    console.warn(`${year}: no showmonth.php captures found.`);
    return null;
  }
  const months = [];
  for (const month of SHOWMONTH_MONTHS) {
    const cand = byMonth.get(month);
    if (!cand) continue;
    const dest = path.join(CACHE_DIR, `${year}-${month}.html`);
    if (!FORCE && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      console.log(`${year}-${month}: cached`);
      months.push({ month, ...cand });
      continue;
    }
    const snapUrl = WAYBACK_SNAPSHOT(cand.timestamp, cand.original);
    let html;
    try {
      html = await fetchWithRetry(snapUrl);
    } catch (err) {
      console.warn(`  ${year}-${month}: fetch failed (${err.message}).`);
      continue;
    }
    if (!showmonthUseful(html)) {
      console.warn(`  ${year}-${month}: no event links, skipping.`);
      continue;
    }
    fs.writeFileSync(dest, html);
    console.log(`${year}-${month}: saved ${cand.timestamp} (${html.length} bytes)`);
    months.push({ month, timestamp: cand.timestamp, original: cand.original });
  }
  return months.length ? { era: "showmonth", months } : null;
}

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const snapshots = fs.existsSync(SNAPSHOTS_PATH)
    ? JSON.parse(fs.readFileSync(SNAPSHOTS_PATH, "utf-8"))
    : {};

  for (const year of yearFilter) {
    try {
      const meta = SHOWMONTH_YEARS.has(year)
        ? await harvestShowmonthYear(year)
        : await harvestYear(year);
      if (meta) snapshots[year] = meta;
    } catch (err) {
      console.error(`${year}: harvest failed - ${err.message}`);
    }
  }

  fs.writeFileSync(SNAPSHOTS_PATH, JSON.stringify(snapshots, null, 2));
  console.log(`\nWrote ${SNAPSHOTS_PATH}. Next: node parse.js`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
