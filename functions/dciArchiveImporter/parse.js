// Step 2: Parse cached snapshots into per-year official-name tables.
//
// CFM era (2003-2012): the "Other Scores" dropdown, one <option> per event:
//   <option value="/scores/?event_id={uuid}">
//      7/28/04 - (DCI) SUMMER MUSIC GAMES in Cincinnati, Fairfield, OH</option>
// The label is "M/DD/YY - (CLASS) Show Name, City, ST". We split the trailing
// ", City, ST" off the end (state = 2 letters) and keep the rest as the
// official show name.
//
// Early era (2000-2002): older framed/static score pages. These are parsed
// best-effort; when a snapshot yields nothing the year is simply left to the
// pressbox placeholders. See README for the coverage caveat.
//
// Writes output/names_{year}.json (array of records) and output/report.json.
//
// Usage: node parse.js [--years 2004,2005]

const fs = require("fs");
const path = require("path");
const {
  YEARS, CACHE_DIR, OUTPUT_DIR, REPORT_PATH, STATE_ABBREV, MONTH_NAMES,
  IGNORED_DIVISION_RE, normalizeCity, matchKey,
} = require("./config");

// Years whose scores predate the CFM dropdown and instead live in the
// showmonth.php monthly listings (results.php?xId= links).
const SHOWMONTH_YEARS = new Set(["2000", "2001", "2002", "2003"]);

const args = process.argv.slice(2);
const yearFilter = args.includes("--years")
  ? args[args.indexOf("--years") + 1].split(",")
  : YEARS;

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validDate(month, day, year, expectedYear) {
  if (year < 100) year += 2000; // "04" -> 2004
  // Trust the season the snapshot came from; a stray next-year date is noise.
  if (String(year) !== String(expectedYear)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return year;
}

// Format A (2004-2006): "M/DD/YY - (CLASS) Show Name, City, ST".
function parseLabelA(label, expectedYear) {
  const m = label.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*-\s*(.*)$/);
  if (!m) return null;
  const year = validDate(Number(m[1]), Number(m[2]), Number(m[3]), expectedYear);
  if (year === null) return null;

  let rest = m[4].trim();
  let division = "";
  const classMatch = rest.match(/^\(([^)]*)\)\s*(.*)$/);
  if (classMatch) {
    division = classMatch[1].trim();
    rest = classMatch[2].trim();
  }

  // Peel the trailing ", City, ST" off the end. State is two letters.
  const loc = rest.match(/^(.*?),\s*([^,]+),\s*([A-Za-z]{2})\.?$/);
  let showName = "";
  let city = "";
  let state = "";
  if (loc) {
    showName = loc[1].trim();
    city = loc[2].trim();
    state = loc[3].toUpperCase();
  } else {
    const bare = rest.match(/^([^,]+),\s*([A-Za-z]{2})\.?$/);
    if (bare) {
      city = bare[1].trim();
      state = bare[2].toUpperCase();
    } else {
      showName = rest; // titled but unparseable location; keep the name
    }
  }
  return { month: Number(m[1]), day: Number(m[2]), year, division, showName, city, state };
}

// Format B (2007-2012): "City, ST (Show Name) - M/D/YY". Location leads, the
// show title is parenthesized, the date trails.
function parseLabelB(label, expectedYear) {
  const m = label.match(/^(.*?)\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*$/);
  if (!m) return null;
  const year = validDate(Number(m[2]), Number(m[3]), Number(m[4]), expectedYear);
  if (year === null) return null;

  const head = m[1].trim();
  // "City, ST (Show Name)"  or  "City, ST"
  const loc = head.match(/^([^,]+),\s*([A-Za-z]{2})\b\.?\s*(?:\((.*)\))?\s*$/);
  if (!loc) return null;
  return {
    month: Number(m[2]),
    day: Number(m[3]),
    year,
    division: "",
    showName: (loc[3] || "").trim(),
    city: loc[1].trim(),
    state: loc[2].toUpperCase(),
  };
}

// Format C (2000-2003 showmonth): "(CLASS) Show Name, City, ST -- Month DD, YYYY".
function parseLabelC(label, expectedYear) {
  const m = label.match(
    /^\(([^)]*)\)\s*(.*?),\s*([^,]+),\s*([A-Za-z]{2,3})\.?\s*--\s*([A-Za-z]+)\.?\s+(\d{1,2}),\s*(\d{4})\s*$/);
  if (!m) return null;
  const month = MONTH_NAMES[m[5].toLowerCase()];
  if (!month) return null;
  const year = validDate(month, Number(m[6]), Number(m[7]), expectedYear);
  if (year === null) return null;
  return {
    month,
    day: Number(m[6]),
    year,
    division: m[1].trim(),
    showName: m[2].trim(),
    city: m[3].trim(),
    state: m[4].toUpperCase(),
  };
}

// Parse an event label in any era's format ->
// { month, day, year, division, showName, city, state } or null.
function parseLabel(label, expectedYear) {
  return parseLabelA(label, expectedYear) ||
    parseLabelB(label, expectedYear) ||
    parseLabelC(label, expectedYear);
}

// Build a location string matching the pressbox "City, FullState" convention.
function buildLocation(city, state) {
  const full = STATE_ABBREV[state] || state;
  return city && full ? `${city}, ${full}` : city || "";
}

function parseCfmDropdown(html, year) {
  const records = [];
  const seen = new Set();
  // Value carries the event id as "?event_id=" (2004-2006), "?event="
  // (2007-2010) or "index.cfm?event=" (2011-2012); match any of them.
  const optionRe =
    /<option[^>]*value\s*=\s*"[^"]*\bevent(?:_id)?=([a-f0-9-]+)[^"]*"[^>]*>([\s\S]*?)<\/option>/gi;
  let m;
  while ((m = optionRe.exec(html)) !== null) {
    const eventId = m[1].trim();
    const label = decodeEntities(m[2]);
    const parsed = parseLabel(label, year);
    if (!parsed) continue;
    if (!parsed.city) continue; // need a city to match on

    const cityKey = normalizeCity(parsed.city);
    const key = matchKey(parsed.year, parsed.month, parsed.day, cityKey);
    // The same event can appear more than once (multi-division nights share a
    // city/date). Keep the first that carries a real show name.
    if (seen.has(key) && !parsed.showName) continue;

    const record = {
      key,
      eventId,
      date: new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
        .toISOString(),
      division: parsed.division,
      showName: parsed.showName || null,
      city: parsed.city,
      state: parsed.state,
      location: buildLocation(parsed.city, parsed.state),
      ignoredDivision: IGNORED_DIVISION_RE.test(parsed.division),
      label,
    };
    if (seen.has(key)) {
      const idx = records.findIndex((r) => r.key === key);
      if (idx !== -1 && !records[idx].showName && record.showName) {
        records[idx] = record; // upgrade placeholder-only to titled
      }
    } else {
      records.push(record);
      seen.add(key);
    }
  }
  return records;
}

// 2000-2003 showmonth era: each monthly page is a list of
//   <a href="...results.php?xId=NNN...">(CLASS) Show, City, ST -- Month DD, YYYY</a>
// links. Takes every cached month page for the year, dedups by the unique xId
// (an event recurs across overlapping month windows), and parses format C.
function parseShowmonth(htmls, year) {
  const records = [];
  const seenXid = new Set();
  const seenKey = new Set();
  const linkRe =
    /<a[^>]*href\s*=\s*"[^"]*results\.php\?xId=(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const html of htmls) {
    let m;
    while ((m = linkRe.exec(html)) !== null) {
      const xId = m[1];
      if (seenXid.has(xId)) continue;
      const parsed = parseLabel(decodeEntities(m[2]), year);
      if (!parsed || !parsed.city || !parsed.showName) continue;
      seenXid.add(xId);
      const key = matchKey(parsed.year, parsed.month, parsed.day,
        normalizeCity(parsed.city));
      if (seenKey.has(key)) continue;
      seenKey.add(key);
      records.push({
        key,
        eventId: xId,
        date: new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
          .toISOString(),
        division: parsed.division,
        showName: parsed.showName,
        city: parsed.city,
        state: parsed.state,
        location: buildLocation(parsed.city, parsed.state),
        ignoredDivision: IGNORED_DIVISION_RE.test(parsed.division),
        label: decodeEntities(m[2]),
      });
    }
  }
  return records;
}

// Collect the cached HTML for a year: one {year}.html for the CFM era, or the
// set of {year}-{month}.html month pages for the showmonth era.
function loadYearHtml(year) {
  if (SHOWMONTH_YEARS.has(year)) {
    const files = fs.existsSync(CACHE_DIR)
      ? fs.readdirSync(CACHE_DIR)
        .filter((f) => f.startsWith(`${year}-`) && f.endsWith(".html"))
      : [];
    return {
      era: "showmonth",
      htmls: files.map((f) => fs.readFileSync(path.join(CACHE_DIR, f), "utf-8")),
    };
  }
  const p = path.join(CACHE_DIR, `${year}.html`);
  return { era: "cfm", htmls: fs.existsSync(p) ? [fs.readFileSync(p, "utf-8")] : [] };
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const report = {};

  for (const year of yearFilter) {
    const { era, htmls } = loadYearHtml(year);
    if (htmls.length === 0) {
      console.log(`${year}: no cached snapshot, skipping (run harvest.js).`);
      report[year] = { snapshot: false, events: 0, titled: 0 };
      continue;
    }
    const records = era === "showmonth"
      ? parseShowmonth(htmls, year)
      : parseCfmDropdown(htmls[0], year);

    const titled = records.filter((r) => r.showName).length;
    const outPath = path.join(OUTPUT_DIR, `names_${year}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ year, era, records }, null, 2));
    report[year] = {
      snapshot: true,
      era,
      pages: htmls.length,
      events: records.length,
      titled,
      ignored: records.filter((r) => r.ignoredDivision).length,
    };
    console.log(`${year}: ${era} parser (${htmls.length} page) -> ` +
      `${records.length} events (${titled} with a show name).`);
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${REPORT_PATH}. Next: node apply.js --dry-run`);
}

if (require.main === module) main();

module.exports = {
  decodeEntities, parseLabel, buildLocation, parseCfmDropdown, parseShowmonth,
};
