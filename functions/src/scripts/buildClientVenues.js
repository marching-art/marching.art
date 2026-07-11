/**
 * Emit the client-side hostable-venue list from the committed gazetteer.
 *
 * The Podium venue gazetteer (helpers/podium/venueGazetteer.json) is the
 * authoritative venue registry, but it lives in the functions codebase and
 * carries geodata the web client doesn't need. The Host-a-Show picker on the
 * Schedule page needs two slim things:
 *
 *   - venues:  the DISTINCT hostable cities ({ venueId, city, region }), so
 *              the picker can list them instead of asking directors to guess a
 *              free-text "City, State".
 *   - keyToId: normalized-location-string -> venueId, so the client can resolve
 *              any schedule competition's location (which may be spelled a dozen
 *              ways) to a venueId and grey out cities already on the schedule.
 *
 * Keeping this a generated artifact (like historicalShadows.json) means the two
 * lists can never drift from the gazetteer's normalizer. Regenerate after
 * rebuilding the gazetteer:
 *
 *   cd functions
 *   node src/scripts/buildClientVenues.js
 */

const fs = require("node:fs");
const path = require("node:path");
const { normalizeKey } = require("../helpers/podium/venues");

const GAZETTEER_PATH = path.join(__dirname, "../helpers/podium/venueGazetteer.json");
const OUTPUT_PATH = path.join(__dirname, "../../../src/data/hostableVenues.json");

function main() {
  const gazetteer = JSON.parse(fs.readFileSync(GAZETTEER_PATH, "utf8"));
  const entries = Object.entries(gazetteer.venues);

  // One row per distinct venueId (the gazetteer keys several spelling variants
  // to the same venue). Keep the first city/region label we see for each.
  const venuesById = new Map();
  const keyToId = {};
  for (const [key, v] of entries) {
    keyToId[key] = v.venueId;
    // Also key by the canonical "City, ST" label so the client resolves the
    // abbreviated form stored on hosted-event rows (mirrors venueFor's
    // canonicalIndex on the server).
    keyToId[normalizeKey(`${v.city}, ${v.region}`)] = v.venueId;
    if (!venuesById.has(v.venueId)) {
      venuesById.set(v.venueId, { venueId: v.venueId, city: v.city, region: v.region });
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

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${venues.length} hostable venues -> ${OUTPUT_PATH}`);
}

main();
