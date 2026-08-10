/**
 * Emit the client-side venue artifacts from the committed gazetteer.
 *
 * The Podium venue gazetteer (helpers/podium/venueGazetteer.json) is the
 * authoritative venue registry, but it lives in the functions codebase and
 * carries geodata most of the web client doesn't need. Two artifacts come out:
 *
 * src/data/hostableVenues.json — loaded by the Schedule page (Host-a-Show):
 *   - venues:  the DISTINCT hostable cities ({ venueId, city, region }), so
 *              the picker can list them instead of asking directors to guess a
 *              free-text "City, State".
 *   - keyToId: normalized-location-string -> venueId, so the client can resolve
 *              any schedule competition's location (which may be spelled a dozen
 *              ways) to a venueId and grey out cities already on the schedule.
 *
 * src/data/venueCoords.json — venueId -> [lat, lng], loaded ONLY by the lazily
 *   chunked Tour Map (src/utils/tourMap.ts) so it can plot a corps' stops
 *   without a geocoding round trip. Kept separate, and in a compact tuple form,
 *   because the show picker never needs coordinates and shouldn't pay for them.
 *
 * Keeping these generated artifacts (like historicalShadows.json) means they can
 * never drift from the gazetteer's normalizer. Regenerate after rebuilding the
 * gazetteer:
 *
 *   cd functions
 *   node src/scripts/buildClientVenues.js
 */

const fs = require("node:fs");
const path = require("node:path");
const { normalizeKey } = require("../helpers/podium/venues");
const { standardizeLocation } = require("../helpers/locationFormat");

const GAZETTEER_PATH = path.join(__dirname, "../helpers/podium/venueGazetteer.json");
const DATA_DIR = path.join(__dirname, "../../../src/data");
const OUTPUT_PATH = path.join(DATA_DIR, "hostableVenues.json");
const COORDS_PATH = path.join(DATA_DIR, "venueCoords.json");

// 4dp is ~11 m — far finer than a city dot on a national map needs, and it
// keeps the coordinate artifact small.
const round4 = (n) => (typeof n === "number" ? Math.round(n * 1e4) / 1e4 : null);

function main() {
  const gazetteer = JSON.parse(fs.readFileSync(GAZETTEER_PATH, "utf8"));
  const entries = Object.entries(gazetteer.venues);

  // One row per distinct venueId (the gazetteer keys several spelling variants
  // to the same venue). Keep the first city/region label we see for each.
  const venuesById = new Map();
  const coordsById = new Map();
  const keyToId = {};
  for (const [key, v] of entries) {
    keyToId[key] = v.venueId;
    // Also key by the canonical "City, ST" label so the client resolves the
    // abbreviated form stored on hosted-event rows (mirrors venueFor's
    // canonicalIndex on the server).
    keyToId[normalizeKey(`${v.city}, ${v.region}`)] = v.venueId;
    // And by the state-code-standardized form of every raw spelling variant, so
    // the "City, ST" locations now stored on the schedule resolve even when the
    // gazetteer corrected the city (typo/fuzzy/override). Mirrors venueFor's
    // standardizedIndex on the server; first-wins keeps the canonical key above
    // authoritative on the rare collision.
    for (const raw of (v.rawVariants && v.rawVariants.length ? v.rawVariants : [`${v.city}, ${v.region}`])) {
      const stdKey = normalizeKey(standardizeLocation(raw));
      if (stdKey && !(stdKey in keyToId)) keyToId[stdKey] = v.venueId;
    }
    if (!venuesById.has(v.venueId)) {
      venuesById.set(v.venueId, { venueId: v.venueId, city: v.city, region: v.region });
      const lat = round4(v.lat);
      const lng = round4(v.lng);
      // A venue with no fix stays out of the coordinate table entirely — the
      // Tour Map lists such a stop without plotting it.
      if (lat !== null && lng !== null) coordsById.set(v.venueId, [lat, lng]);
    }
  }

  const venues = [...venuesById.values()].sort((a, b) =>
    `${a.city}, ${a.region}`.localeCompare(`${b.city}, ${b.region}`)
  );

  const output = {
    meta: {
      generatedFrom: "functions/src/helpers/podium/venueGazetteer.json",
      venues: venues.length,
      keys: Object.keys(keyToId).length,
    },
    venues,
    keyToId,
  };

  const coords = Object.fromEntries(
    [...coordsById.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  );

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  // One venue per line with the pair inline — byte-identical to what the web
  // app's Prettier produces for this shape, so `npm run format:check` stays
  // green after a regeneration. (This codebase is prettier-ignored, so the
  // formatting has to be emitted rather than applied.)
  const coordLines = Object.entries(coords).map(
    ([id, [lat, lng]]) => `  ${JSON.stringify(id)}: [${lat}, ${lng}]`
  );
  fs.writeFileSync(COORDS_PATH, `{\n${coordLines.join(",\n")}\n}\n`);
  console.log(`Wrote ${venues.length} hostable venues -> ${OUTPUT_PATH}`);
  console.log(`Wrote ${coordsById.size} venue coordinates -> ${COORDS_PATH}`);
}

main();
