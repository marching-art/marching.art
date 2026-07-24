/**
 * Venue timezone enrichment + verification.
 *
 * Every gazetteer venue already carries lat/lng (GeoNames geocode). An IANA
 * timezone falls straight out of the coordinates via the offline `tz-lookup`
 * package — boundary-polygon based, so it is correct on exactly the cases a
 * state->zone table gets wrong (El Paso TX -> Mountain, Florida panhandle ->
 * Central, Indiana/Kentucky/Tennessee splits, Arizona's no-DST rule).
 *
 * The result is baked into the committed venueGazetteer.json as a `timezone`
 * field so the deployed runtime needs no tz dependency — it just reads the
 * string. `tzSource` records confidence:
 *   - "geo"          coordinate zone agrees with the state's expected zone(s).
 *   - "needs-review" it does NOT (a source typo that geocoded into the wrong
 *                    state, or a state-centroid venue near a split line). These
 *                    are the rows worth a human glance; they are the analogue of
 *                    the builder's UNRESOLVED/centroid warnings.
 *
 * Verification is done at the coarse offset-bucket level (Eastern/Central/
 * Mountain/Pacific/Atlantic/Newfoundland via standard-time UTC offset), which
 * is exactly the granularity the "furthest-west" score-drop rule cares about.
 *
 * Run standalone to (re)stamp the committed gazetteer in place:
 *   cd functions
 *   npm install --no-save tz-lookup
 *   node src/scripts/venueTimezones.js
 *
 * buildVenueGazetteer.js also calls enrichVenuesWithTimezones() so a full
 * rebuild keeps timezones without a separate step.
 */

const { tzOffsetMs } = require("../helpers/scoreDropTime");

// A mid-January instant: every US/Canada zone is on STANDARD time then, so the
// offset uniquely identifies the zone bucket (AZ reads -7 = Mountain, its
// standard zone, which is what we want).
const STANDARD_INSTANT = Date.UTC(2025, 0, 15, 12, 0, 0);

/** Standard-time UTC offset of a zone, in hours (e.g. -5 for Eastern). */
function standardOffsetHours(timeZone) {
  return tzOffsetMs(timeZone, STANDARD_INSTANT) / 3600000;
}

// Allowed standard-time offsets per US state / Canadian province. Split-zone
// regions list every offset they legitimately contain, so a border venue never
// false-flags. Anything the coordinate lookup returns that is NOT in this set
// is surfaced for review. (-3.5 = Newfoundland.)
const ALLOWED_OFFSETS = {
  // US — Eastern
  CT: [-5], DE: [-5], DC: [-5], GA: [-5], ME: [-5], MD: [-5], MA: [-5],
  NH: [-5], NJ: [-5], NY: [-5], NC: [-5], OH: [-5], PA: [-5], RI: [-5],
  SC: [-5], VT: [-5], VA: [-5], WV: [-5],
  // US — split Eastern/Central
  FL: [-5, -6], IN: [-5, -6], KY: [-5, -6], MI: [-5, -6], TN: [-5, -6],
  // US — Central
  AL: [-6], AR: [-6], IL: [-6], IA: [-6], LA: [-6], MN: [-6], MS: [-6],
  MO: [-6], OK: [-6], WI: [-6],
  // US — split Central/Mountain
  KS: [-6, -7], NE: [-6, -7], ND: [-6, -7], SD: [-6, -7], TX: [-6, -7],
  // US — Mountain (AZ is Mountain-standard year-round)
  AZ: [-7], CO: [-7], MT: [-7], NM: [-7], UT: [-7], WY: [-7],
  // US — split Mountain/Pacific
  ID: [-7, -8], NV: [-7, -8], OR: [-7, -8],
  // US — Pacific
  CA: [-8], WA: [-8],
  // US — non-contiguous
  AK: [-9], HI: [-10],
  // Canada
  AB: [-7], BC: [-7, -8], MB: [-6], NB: [-4], NL: [-3.5], NS: [-4],
  ON: [-5, -6], PE: [-4], QC: [-4, -5], SK: [-6],
};

/**
 * Resolve a venue's timezone from its coordinates and verify it against the
 * region's expected offset bucket.
 * @param {{lat:number,lng:number,region:string,source?:string}} venue
 * @param {(lat:number,lng:number)=>string} tzLookup - injectable (tz-lookup).
 * @returns {{timezone:string|null, tzSource:"geo"|"needs-review", offsetHours:number|null, note?:string}}
 */
function resolveVenueTimezone(venue, tzLookup) {
  if (typeof venue.lat !== "number" || typeof venue.lng !== "number") {
    return { timezone: null, tzSource: "needs-review", offsetHours: null, note: "no coordinates" };
  }
  let timezone;
  try {
    timezone = tzLookup(venue.lat, venue.lng);
  } catch (error) {
    return { timezone: null, tzSource: "needs-review", offsetHours: null, note: `tz-lookup failed: ${error.message}` };
  }
  const offsetHours = standardOffsetHours(timezone);
  const allowed = ALLOWED_OFFSETS[venue.region];
  // A geocode that landed on a state-centroid (builder `source: "centroid"`) is
  // inherently unreliable near a split line, so it never counts as verified.
  const centroid = venue.source === "centroid";
  const expectedOk = Array.isArray(allowed) && allowed.includes(offsetHours);
  /** @type {"geo"|"needs-review"} */
  let tzSource = "geo";
  let note;
  if (!allowed) {
    tzSource = "needs-review";
    note = `no expected-offset entry for region "${venue.region}"`;
  } else if (!expectedOk) {
    tzSource = "needs-review";
    note = `zone ${timezone} (offset ${offsetHours}) not in expected ${JSON.stringify(allowed)} for ${venue.region}`;
  } else if (centroid) {
    tzSource = "needs-review";
    note = "state-centroid geocode; verify near split lines";
  }
  return { timezone, tzSource, offsetHours, note };
}

/**
 * Enrich a gazetteer object in place: stamp every venue with `timezone` and
 * `tzSource`. Returns { stats, reviews } for reporting.
 * @param {{venues:Object}} gazetteer
 * @param {(lat:number,lng:number)=>string} tzLookup
 */
function enrichVenuesWithTimezones(gazetteer, tzLookup) {
  const stats = { geo: 0, needsReview: 0, unresolved: 0 };
  const reviews = [];
  for (const [key, venue] of Object.entries(gazetteer.venues || {})) {
    const { timezone, tzSource, note } = resolveVenueTimezone(venue, tzLookup);
    venue.timezone = timezone;
    venue.tzSource = tzSource;
    if (!timezone) stats.unresolved++;
    else if (tzSource === "geo") stats.geo++;
    else stats.needsReview++;
    if (tzSource === "needs-review") reviews.push({ key, region: venue.region, timezone, note });
  }
  return { stats, reviews };
}

module.exports = {
  standardOffsetHours,
  resolveVenueTimezone,
  enrichVenuesWithTimezones,
  ALLOWED_OFFSETS,
};

// Standalone: re-stamp the committed gazetteer.
if (require.main === module) {
  const fs = require("node:fs");
  const path = require("node:path");
  let tzLookup;
  try {
    // @ts-ignore -- dev-only dependency, installed ad hoc with --no-save; not in package.json
    tzLookup = require("tz-lookup");
  } catch {
    console.error("Missing dev dependency. Run:  npm install --no-save tz-lookup");
    process.exit(1);
  }
  const gazetteerPath = path.join(__dirname, "../helpers/podium/venueGazetteer.json");
  const gazetteer = JSON.parse(fs.readFileSync(gazetteerPath, "utf8"));
  const { stats, reviews } = enrichVenuesWithTimezones(gazetteer, tzLookup);
  gazetteer.meta = gazetteer.meta || {};
  gazetteer.meta.timezones = {
    resolvedBy: "tz-lookup (coordinate -> IANA), verified against state offset buckets",
    ...stats,
  };
  fs.writeFileSync(gazetteerPath, `${JSON.stringify(gazetteer, null, 2)}\n`);
  console.log(`Stamped timezones on ${Object.keys(gazetteer.venues).length} venues -> ${gazetteerPath}`);
  console.log("Timezone stats:", JSON.stringify(stats));
  if (reviews.length) {
    console.log(`\n${reviews.length} venue(s) need review:`);
    for (const r of reviews) console.log(`  ${r.key} [${r.region}] -> ${r.timezone}: ${r.note}`);
  }
}
