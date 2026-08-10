/**
 * Location string standardization: convert a show location to the canonical
 * "City, ST" form, where ST is the two-letter US state / Canadian province code.
 *
 * WHY: schedule locations enter the game from two eras that spell the region
 * differently. The From The Pressbox archive (2000-2012) spells states out in
 * full — "Rockford, Illinois", and sometimes with a period instead of a comma
 * ("Allentown. Pennsylvania") — while the dci.org harvest and the live scraper
 * (2013-onward) already use "Rockford, IL". The off-season schedule generator
 * de-duplicates shows by exact location string (helpers/scheduleGeneration.js
 * `usedLocations`), so "Rockford, Illinois" and "Rockford, IL" read as two
 * different venues and BOTH get placed — the same city on two days. Collapsing
 * every location to one spelling before it is compared or stored fixes the
 * duplication and makes the schedule read consistently.
 *
 * `standardizeLocation` is intentionally conservative: it only rewrites the
 * trailing region when it recognizes a full state/province name or a valid
 * two-letter code, and returns the input UNCHANGED when it cannot (so an
 * unfamiliar or malformed location is never mangled). It is idempotent —
 * running it on an already-"City, ST" string is a no-op.
 */

// Two-letter code -> full name. Codes are the canonical output; names are what
// the historical archive carries and what this helper folds back to a code.
const US_STATES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

const CA_PROVINCES = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", NS: "Nova Scotia", ON: "Ontario",
  PE: "Prince Edward Island", QC: "Quebec", SK: "Saskatchewan",
};

// Lowercased full name -> two-letter code (US state codes and CA province codes
// do not overlap, so a single map is unambiguous).
const CODE_BY_NAME = {};
for (const [code, name] of Object.entries(US_STATES)) CODE_BY_NAME[name.toLowerCase()] = code;
for (const [code, name] of Object.entries(CA_PROVINCES)) CODE_BY_NAME[name.toLowerCase()] = code;

// Set of valid two-letter codes (upper-case) for the "already abbreviated" path.
const VALID_CODES = new Set([...Object.keys(US_STATES), ...Object.keys(CA_PROVINCES)]);

// State/province names run one to three words ("Ohio", "New Jersey",
// "District of Columbia"), so region detection tries trailing spans up to 3.
const MAX_REGION_WORDS = 3;

/** A run of city text trimmed of trailing separators (comma, period, space). */
function cleanCity(text) {
  return String(text).replace(/[\s.,]+$/, "").replace(/^[\s.,]+/, "").trim();
}

/** Fold a candidate region token to a two-letter code, or null. */
function regionToCode(candidate) {
  const name = candidate.toLowerCase().replace(/\.$/, "").trim();
  if (CODE_BY_NAME[name]) return CODE_BY_NAME[name];
  const code = candidate.toUpperCase().replace(/[.\s]/g, "");
  if (VALID_CODES.has(code)) return code;
  return null;
}

/**
 * Standardize a location string to "City, ST".
 *
 * Recognizes:
 *   - "City, StateName"      -> "City, ST"   ("Rockford, Illinois")
 *   - "City. StateName"      -> "City, ST"   ("Allentown. Pennsylvania")
 *   - "City StateName"       -> "City, ST"   ("Rockford Illinois")
 *   - "City, Rhode, Island"  -> "City, RI"   (dirty multi-comma region)
 *   - "City, ST" / "City, sT" -> "City, ST"  (already abbreviated; canonical case)
 *
 * Returns the input unchanged (aside from being coerced to a string) when the
 * trailing region is not a recognized state/province.
 *
 * @param {string} location - Raw location string.
 * @returns {string} Standardized "City, ST", or the original when unrecognized.
 */
function standardizeLocation(location) {
  if (location == null) return location;
  const trimmed = String(location).trim();
  if (!trimmed) return trimmed;

  const parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);

  // Comma-separated: the region is the trailing segment(s). Try the last 1..3
  // segments as a region name/code, keeping at least one segment for the city.
  if (parts.length >= 2) {
    const maxSpan = Math.min(MAX_REGION_WORDS, parts.length - 1);
    for (let span = 1; span <= maxSpan; span++) {
      const code = regionToCode(parts.slice(-span).join(" "));
      if (code) {
        const city = cleanCity(parts.slice(0, parts.length - span).join(", "));
        return city ? `${city}, ${code}` : trimmed;
      }
    }
    return trimmed;
  }

  // No comma: region is separated from the city by a period or a space
  // ("Allentown. Pennsylvania", "Rockford Illinois"). Try trailing word spans.
  const words = trimmed.split(/\s+/);
  const maxSpan = Math.min(MAX_REGION_WORDS, words.length - 1);
  for (let span = 1; span <= maxSpan; span++) {
    const code = regionToCode(words.slice(-span).join(" "));
    if (code) {
      const city = cleanCity(words.slice(0, words.length - span).join(" "));
      return city ? `${city}, ${code}` : trimmed;
    }
  }

  return trimmed;
}

/**
 * True when a location string carries no real venue: it is missing/blank or the
 * "Unknown Location" placeholder the scrapers and importer stamp on an event
 * whose venue couldn't be parsed (see triggers/scoreProcessing.js,
 * helpers/scraping.js, pressboxImporter/parse.js). The off-season schedule
 * generator uses this to keep placeholder-venue shows out of the season it
 * builds — an "Unknown Location" show reads as broken on the schedule.
 *
 * Conservative: a present-but-unrecognized region ("Somewhere, Freedonia") is
 * NOT treated as unknown — it's a real place standardizeLocation just can't
 * abbreviate — so legitimate historical venues are never dropped.
 *
 * @param {*} location - Raw location value.
 * @returns {boolean}
 */
function isUnknownLocation(location) {
  if (location == null) return true;
  const trimmed = String(location).trim();
  if (!trimmed) return true;
  return /^unknown(\s+location)?$/i.test(trimmed);
}

module.exports = { standardizeLocation, isUnknownLocation, US_STATES, CA_PROVINCES };
