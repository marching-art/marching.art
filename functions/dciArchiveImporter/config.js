// Shared configuration for the DCI archive.org show-name enrichment importer.
//
// Source: Wayback Machine (web.archive.org) snapshots of dci.org's scores
// page. The 2003-2012 ColdFusion page carries an "Other Scores" dropdown:
//   <select name="listboxmenu">
//     <option value="/scores/?event_id={uuid}">
//        8/06/04 - (DCI) DCI World Championships, Denver, CO</option>
// which lists every scored event of the season with its OFFICIAL show name,
// division/class, date and location. The 2000-2002 era used older
// framed/static pages (index-content.html) that we parse best-effort.
//
// The From The Pressbox importer (../pressboxImporter) already backfilled
// 2000-2012 SCORES, but its events are frequently titled with the
// "DCI Competition - {City, State}" placeholder because the recap workbooks
// carry no show name. This module harvests the real names and overwrites
// those placeholders (matched on date + city), leaving scores untouched.

const path = require("path");

// The pressbox importer covers 2000-2012; 2013+ is the live dci.org scrape,
// which already stores official names. We enrich the same 2000-2012 range.
const YEARS = Array.from({ length: 13 }, (_, i) => (2000 + i).toString());

const WAYBACK_CDX = "https://web.archive.org/cdx/search/cdx";
// id_ returns the raw archived bytes without the Wayback toolbar/rewrite,
// which keeps the parser working against the original dci.org markup.
const WAYBACK_SNAPSHOT = (timestamp, url) =>
  `https://web.archive.org/web/${timestamp}id_/${url}`;

const CACHE_DIR = path.join(__dirname, "cache");
const OUTPUT_DIR = path.join(__dirname, "output");
const SNAPSHOTS_PATH = path.join(__dirname, "snapshots.json");
const REPORT_PATH = path.join(OUTPUT_DIR, "report.json");

// Where the pressbox importer writes the score data we enrich. apply.js reads
// and rewrites eventName in these committed files.
const PRESSBOX_OUTPUT_DIR = path.join(__dirname, "..", "pressboxImporter", "output");

// USPS state abbreviations <-> the full spellings the pressbox `location`
// field uses ("Menasha, WI" in the dropdown vs "Menasha, Wisconsin" in the
// recap workbooks). Also covers Canadian provinces that hosted DCI events.
const STATE_ABBREV = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida",
  GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana",
  IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine",
  MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska",
  NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
  UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
  ON: "Ontario", ONT: "Ontario", QC: "Quebec", BC: "British Columbia",
  AB: "Alberta",
};

// Month name -> 1-based number, for the 2000-2003 showmonth label format
// ("... -- August 4, 2001"). Full names and 3-letter abbreviations.
const MONTH_NAMES = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
  oct: 10, nov: 11, dec: 12,
};

// Divisions the game does not use (senior/all-age corps). Dropdown rows tagged
// with these are still parsed but flagged so apply.js can skip them; matching
// is by date+city so they normally never collide with a game event anyway.
const IGNORED_DIVISION_RE = /all[-\s]?age|dca|alumni|sound ?sport/i;

// Turn a city string into a stable match key: lowercase, strip punctuation,
// normalize the common Saint/Fort/Mount abbreviations, drop a trailing
// doubleheader qualifier ("Indianapolis II" -> "indianapolis"), collapse
// whitespace. Used on both the dropdown city and the pressbox location's
// city half so "St. Peter" == "Saint Peter" and "Ft. Wayne" == "Fort Wayne".
function normalizeCity(city) {
  if (!city) return "";
  return city
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/\bst\b/g, "saint")
    .replace(/\bste\b/g, "saint")
    .replace(/\bft\b/g, "fort")
    .replace(/\bmt\b/g, "mount")
    .replace(/\bpt\b/g, "port")
    // Expand standalone compass abbreviations so "E Rutherford" == "East
    // Rutherford". Applied to both sides, so expansion can only add matches.
    .replace(/\bn\b/g, "north")
    .replace(/\bs\b/g, "south")
    .replace(/\be\b/g, "east")
    .replace(/\bw\b/g, "west")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+(ii|iii|iv|2|3|4)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// A pressbox `location` is "City, State" (full state name). Split into a
// normalized city and the raw state for a match key.
function cityFromLocation(location) {
  if (!location) return "";
  const [city] = location.split(",");
  return normalizeCity(city);
}

// Unambiguous display expansions used to COMPLETE an abbreviated city name
// (e.g. "E Rutherford" -> "East Rutherford", "St. Peter" -> "Saint Peter").
// Deliberately excludes "Pt", which is ambiguous (Port vs Point) - those cases
// are resolved only from the archive's already-spelled-out form, never guessed.
const CITY_DISPLAY_EXPANSIONS = {
  n: "North", s: "South", e: "East", w: "West",
  ne: "Northeast", nw: "Northwest", se: "Southeast", sw: "Southwest",
  st: "Saint", ste: "Saint", ft: "Fort", mt: "Mount",
};

// Expand unambiguous abbreviations in a display city while preserving the rest
// of the string's original casing (so "DeKalb", "McAllen" are untouched).
function expandCityDisplay(city) {
  if (!city) return "";
  return city
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const bare = tok.replace(/\.+$/, "").toLowerCase();
      return CITY_DISPLAY_EXPANSIONS[bare] || tok;
    })
    .join(" ")
    .trim();
}

// Given the pressbox city and the archive city for the SAME (already-matched)
// event, return the most complete spelling. Both are display-expanded first,
// then the longer wins; ties keep the pressbox spelling to avoid churn.
function canonicalCity(pbCity, archiveCity) {
  const a = expandCityDisplay(pbCity);
  const b = expandCityDisplay(archiveCity);
  if (!b) return a;
  if (!a) return b;
  return b.length > a.length ? b : a;
}

// Recompute a pressbox `location` ("City, FullState") using the archive city,
// keeping the pressbox full state name. Returns the new location string only
// when it differs from the original, else null.
function canonicalLocation(location, archiveCity) {
  if (!location) return null;
  const comma = location.indexOf(",");
  const pbCity = (comma === -1 ? location : location.slice(0, comma)).trim();
  const stateRest = comma === -1 ? "" : location.slice(comma + 1).trim();
  const city = canonicalCity(pbCity, archiveCity);
  if (!city || city === pbCity) return null;
  return stateRest ? `${city}, ${stateRest}` : city;
}

// The match key shared by both sides: MM/DD/YYYY + normalized city. Day-level
// granularity plus city is unique for the vast majority of DCI events; genuine
// same-day same-city doubleheaders are the documented edge case (see README).
function matchKey(year, month, day, cityKey) {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}|${cityKey}`;
}

// Build the same key from a pressbox event {date, location}.
function matchKeyForEvent(event) {
  const d = new Date(event.date);
  return matchKey(
    d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
    cityFromLocation(event.location),
  );
}

module.exports = {
  YEARS,
  WAYBACK_CDX,
  WAYBACK_SNAPSHOT,
  CACHE_DIR,
  OUTPUT_DIR,
  SNAPSHOTS_PATH,
  REPORT_PATH,
  PRESSBOX_OUTPUT_DIR,
  STATE_ABBREV,
  MONTH_NAMES,
  IGNORED_DIVISION_RE,
  normalizeCity,
  cityFromLocation,
  expandCityDisplay,
  canonicalCity,
  canonicalLocation,
  matchKey,
  matchKeyForEvent,
};
