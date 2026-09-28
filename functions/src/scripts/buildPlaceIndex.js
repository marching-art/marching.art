/**
 * Build the hometown place index — every populated place in the US and Canada,
 * plus the six northern-Mexico border states down to the Tour Map poster's
 * southern edge (GeoNames cities500: population ≥ 500 or a county/municipal
 * seat), geocoded
 * and timezone-stamped, so a director can name ANY real hometown and have it
 * placed on the map instead of being forced onto one of the ~500 historical
 * DCI show cities in the venue gazetteer.
 *
 * Two artifacts come out:
 *
 *   functions/src/helpers/podium/placeIndex.json — the server copy. Loaded
 *     lazily by helpers/podium/venues.js as the FALLBACK behind the gazetteer:
 *     `venueFor` resolves a tour-map city first and any other real town second,
 *     so a hometown, a legacy free-text location, or a brand-new city DCI adds
 *     to the live schedule all get coordinates, travel pricing, heat and a
 *     timezone with no rebuild. Rows already covered by the gazetteer are
 *     dropped (the tour-map venue is authoritative for its city).
 *
 *   src/data/placeIndex.json — the client copy for the hometown typeahead
 *     (src/utils/places.ts, dynamically imported so it never lands in the main
 *     bundle): the gazetteer's tour-map cities (most-toured first, with their
 *     venueId), then every other town, largest first, so search ranking falls
 *     out of row order.
 *
 * Run (after rebuilding the gazetteer, so the dedupe sees the current tour map):
 *
 *   cd functions
 *   curl -sSO https://download.geonames.org/export/dump/cities500.zip && unzip -o cities500.zip -d /tmp
 *   npm install --no-save tz-lookup            # one-time; dev-only dependency
 *   node src/scripts/buildPlaceIndex.js --src /tmp/cities500.txt
 *
 * Geodata: GeoNames (https://www.geonames.org), CC-BY 4.0.
 */

const fs = require("node:fs");
const path = require("node:path");
const gazetteer = require("../helpers/podium/venueGazetteer.json");
const { normalizeKey, tourVenueFor } = require("../helpers/podium/venues");
const { US_STATES } = require("../helpers/locationFormat");
const { isHostableArea } = require("../helpers/podium/hostingArea");

const SERVER_OUT = path.join(__dirname, "../helpers/podium/placeIndex.json");
const CLIENT_OUT = path.join(__dirname, "../../../src/data/placeIndex.json");

// GeoNames encodes Canadian admin1 numerically (territories are left out —
// locationFormat has no codes for them, so they couldn't round-trip).
const CA_ADMIN_TO_POSTAL = {
  "01": "AB",
  "02": "BC",
  "03": "MB",
  "04": "NB",
  "05": "NL",
  "07": "NS",
  "08": "ON",
  "09": "PE",
  "10": "QC",
  "11": "SK",
};

// GeoNames admin1 for the six US-border states -> ISO 3166-2:MX code (three
// letters, so Baja California and Nuevo León never collide with BC / NL).
const MX_ADMIN_TO_ISO = {
  "02": "BCN",
  "26": "SON",
  "06": "CHH",
  "07": "COA",
  "19": "NLE",
  "28": "TAM",
};

// Real towns only: drop neighbourhood sections (PPLX — "Hyde Park" would shadow
// real cities), abandoned/historical/destroyed places, and religious sites.
const EXCLUDED_FEATURES = new Set(["PPLX", "PPLQ", "PPLH", "PPLW", "PPLCH", "PPLR", "PPLF"]);

const round = (n, dp) => Math.round(n * 10 ** dp) / 10 ** dp;
const foldAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Same scheme as the gazetteer's venueIds ("canton-oh"). */
function placeVenueId(asciiName, region) {
  return `${asciiName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${region.toLowerCase()}`;
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

function main() {
  const src = argValue("--src") || process.env.GEONAMES_CITIES500;
  if (!src || !fs.existsSync(src)) {
    console.error(
      "Missing GeoNames cities500.txt. Download it:\n" +
        "  curl -sSO https://download.geonames.org/export/dump/cities500.zip && unzip -o cities500.zip -d /tmp\n" +
        "then run:  node src/scripts/buildPlaceIndex.js --src /tmp/cities500.txt"
    );
    process.exit(1);
  }
  let tzLookup;
  try {
    // @ts-expect-error -- optional dev-only dependency, installed ad hoc
    // (npm install --no-save), so it ships no type declarations here.
    tzLookup = require("tz-lookup");
  } catch {
    console.error("Missing dev dependency. Run:  npm install --no-save tz-lookup");
    process.exit(1);
  }

  const gazetteerIds = new Set(Object.values(gazetteer.venues).map((v) => v.venueId));

  // Parse → filter → keep the most populous place per venueId (two same-named
  // towns in one state collapse to the one people mean).
  const byId = new Map();
  const lines = fs.readFileSync(src, "utf8").split("\n");
  for (const line of lines) {
    if (!line) continue;
    const f = line.split("\t");
    const [name, asciiName, lat, lng, featureClass, featureCode, country, admin1, population] = [
      f[1],
      f[2],
      Number(f[4]),
      Number(f[5]),
      f[6],
      f[7],
      f[8],
      f[10],
      Number(f[14]) || 0,
    ];
    if (featureClass !== "P" || EXCLUDED_FEATURES.has(featureCode)) continue;
    let region = null;
    if (country === "US" && US_STATES[admin1]) region = admin1;
    else if (country === "CA" && CA_ADMIN_TO_POSTAL[admin1]) region = CA_ADMIN_TO_POSTAL[admin1];
    else if (country === "MX" && MX_ADMIN_TO_ISO[admin1]) region = MX_ADMIN_TO_ISO[admin1];
    if (!region || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    // Mexico stops at the poster's southern edge (southern Tamaulipas, e.g.
    // Tampico, would plot off the map) — the same rule hosted shows obey.
    if (country === "MX" && !isHostableArea({ region, lat, lng })) continue;
    const ascii = asciiName || foldAccents(name);
    const venueId = placeVenueId(ascii, region);
    if (!venueId || venueId.startsWith("-")) continue;
    const existing = byId.get(venueId);
    if (existing && existing.population >= population) continue;
    byId.set(venueId, { venueId, name, ascii, region, country, lat, lng, population });
  }

  const places = [...byId.values()]
    // Covered by the tour map already → the gazetteer venue is authoritative.
    .filter((p) => !gazetteerIds.has(p.venueId) && !tourVenueFor(`${p.name}, ${p.region}`))
    .sort((a, b) => b.population - a.population || a.name.localeCompare(b.name));

  // Timezones as an index into a small zone table (a few dozen distinct zones).
  const zones = [];
  const zoneIndex = new Map();
  const zoneOf = (lat, lng) => {
    let tz = null;
    try {
      tz = tzLookup(lat, lng);
    } catch {
      tz = null;
    }
    if (!tz) return -1;
    if (!zoneIndex.has(tz)) {
      zoneIndex.set(tz, zones.length);
      zones.push(tz);
    }
    return zoneIndex.get(tz);
  };

  const serverRows = places.map((p) => {
    const row = [p.name, p.region, round(p.lat, 4), round(p.lng, 4), zoneOf(p.lat, p.lng)];
    // The ASCII spelling only when it differs ("Española" → "Espanola"), so a
    // director typing without accents still resolves server-side.
    if (normalizeKey(p.ascii) !== normalizeKey(p.name)) row.push(p.ascii);
    return row;
  });

  const meta = {
    source: "GeoNames cities500 (https://www.geonames.org), CC-BY 4.0",
    countries: ["US", "CA", "MX"],
    note:
      "Hometown fallback behind venueGazetteer.json. Built by scripts/buildPlaceIndex.js; " +
      "tour-map cities are excluded here because the gazetteer resolves them first.",
    places: serverRows.length,
  };
  fs.writeFileSync(SERVER_OUT, `${JSON.stringify({ meta, zones, places: serverRows })}\n`);

  // Client: tour-map cities first (most-toured first), then every other town.
  const tourRows = new Map();
  for (const v of Object.values(gazetteer.venues)) {
    const prior = tourRows.get(v.venueId);
    if (prior) {
      prior.count += v.eventCount || 0;
      continue;
    }
    if (typeof v.lat !== "number" || typeof v.lng !== "number") continue;
    tourRows.set(v.venueId, { v, count: v.eventCount || 0 });
  }
  const clientTour = [...tourRows.values()]
    .sort((a, b) => b.count - a.count)
    .map(({ v }) => [v.city, v.region, round(v.lat, 3), round(v.lng, 3), v.venueId]);
  // Every other town as ONE compact string, largest first: "City|ST|lat|lng"
  // rows joined by ";" with coordinates in hundredths of a degree (~1 km — the
  // client only previews distances; the server prices from its own copy). A
  // quarter the size of the equivalent JSON tuples once gzipped.
  const towns = places
    .map((p) => `${p.name}|${p.region}|${Math.round(p.lat * 100)}|${Math.round(p.lng * 100)}`)
    .join(";");
  fs.writeFileSync(
    CLIENT_OUT,
    `${JSON.stringify({
      source: meta.source,
      // [city, region, lat, lng, venueId] — cities on the tour map (they host shows).
      tour: clientTour,
      towns,
    })}\n`
  );

  console.log(
    `Place index: ${serverRows.length} towns beyond the tour map (${zones.length} timezones); ` +
      `client typeahead: ${clientTour.length} tour-map + ${places.length} towns.`
  );
}

main();
