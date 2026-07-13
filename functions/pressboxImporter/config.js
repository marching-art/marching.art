// Shared configuration for the From The Pressbox historical recap importer.
//
// Source: https://www.fromthepressbox.com/dca-dcihistory
// Each season page ({year}season) links month-long recap documents
// (Excel-exported .htm files) hosted on Google Cloud Storage.

const path = require("path");

// Covers the full 2000-2025 archive published on the season pages. 2013+ also
// lives in historical_scores via the dci.org scrape pipeline, so import.js
// (add-only) skips those years in Firestore; the parsed output/*.json for the
// whole range still feeds the local Podium "trajectory vs history" shadows.
const YEARS = Array.from({ length: 26 }, (_, i) => (2000 + i).toString());

const SEASON_PAGE_URL = (year) => `https://www.fromthepressbox.com/${year}season`;
const DOCUMENT_BASE_URL = "https://storage.googleapis.com/wzukusers/user-29900967/documents/";

const CACHE_DIR = path.join(__dirname, "cache");
const OUTPUT_DIR = path.join(__dirname, "output");
const MANIFEST_PATH = path.join(__dirname, "manifest.json");

// The 8 modern caption keys used everywhere in the game
// (see functions/src/helpers/scraping.js and masterParser.js).
const CAPTION_KEYS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];

// Maps a (group header, caption header) pair from a 2000-2013 recap sheet to
// a modern caption key. Group and caption text are lowercased and
// whitespace-normalized before matching. Judge counts vary by event
// (championships used doubled GE panels, e.g. "Visual #1"/"Visual #2");
// multiple judge columns that resolve to the same key are averaged, matching
// the live scraper's processCaption behavior.
function mapCaption(group, caption) {
  if (/general effect/.test(group)) {
    if (/^visual/.test(caption)) return "GE1";
    if (/^music/.test(caption)) return "GE2";
    return null;
  }
  if (/^visual/.test(group)) {
    if (/performance|proficiency/.test(caption)) return "VP";
    if (/ensemble|analysis/.test(caption)) return "VA";
    if (/color guard/.test(caption)) return "CG";
    return null;
  }
  if (/^music/.test(group)) {
    if (/brass/.test(caption)) return "B";
    if (/ensemble|analysis/.test(caption)) return "MA";
    if (/percussion/.test(caption)) return "P";
    return null;
  }
  return null;
}

// Replicates calculateOffSeasonDay in functions/src/helpers/scheduleGeneration.js
// (day 1-49 window ending on the second Saturday of August).
function calculateOffSeasonDay(eventDate, year) {
  if (!eventDate || isNaN(eventDate.getTime())) return null;

  const firstOfAugust = new Date(Date.UTC(year, 7, 1));
  const dayOfWeek = firstOfAugust.getUTCDay();
  const daysUntilFirstSaturday = (6 - dayOfWeek + 7) % 7;
  const firstSaturdayDate = 1 + daysUntilFirstSaturday;
  const finalsDay = firstSaturdayDate + 7;
  const finalsDateUTC = new Date(Date.UTC(year, 7, finalsDay));

  const seasonEndDate = new Date(finalsDateUTC);
  const millisIn48Days = 48 * 24 * 60 * 60 * 1000;
  const seasonStartDate = new Date(finalsDateUTC.getTime() - millisIn48Days);
  const eventDateUTC = new Date(Date.UTC(
    eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate()));

  if (eventDateUTC < seasonStartDate || eventDateUTC > seasonEndDate) return null;

  const diffInMillis = eventDateUTC.getTime() - seasonStartDate.getTime();
  const millisInDay = 1000 * 60 * 60 * 24;
  const diffInDays = Math.round(diffInMillis / millisInDay);

  return diffInDays + 1;
}

// Normalizes era-specific corps names to the ones the existing
// dci.org-scraped years (2013+) and dci-reference data use, so a corps keeps
// one identity across the whole archive. Exact-match only ("Vanguard Cadets"
// is untouched by the "Vanguard" entry).
const CORPS_NAME_MAP = {
  "Cadets": "The Cadets",
  "Cadets of Bergen County": "The Cadets",
  "Holy Name Cadets": "The Cadets",
  "Cavaliers": "The Cavaliers",
  "Vanguard": "Santa Clara Vanguard",
  "Academy": "The Academy",
  "Spirit": "Spirit of Atlanta",
  "Spirit JSU": "Spirit of Atlanta",
  "Spirit from JSU": "Spirit of Atlanta",
  "Cascades": "Seattle Cascades",
  "Magic": "Magic of Orlando",
};

module.exports = {
  YEARS,
  SEASON_PAGE_URL,
  DOCUMENT_BASE_URL,
  CACHE_DIR,
  OUTPUT_DIR,
  MANIFEST_PATH,
  CAPTION_KEYS,
  CORPS_NAME_MAP,
  mapCaption,
  calculateOffSeasonDay,
};
