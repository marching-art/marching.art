// @ts-nocheck -- grandfathered when functions checkJs landed (functions/tsconfig.json); remove when this file is typed or cleaned up
/**
 * Podium Phase 0.1 — Venue Gazetteer builder.
 *
 * Extracts every distinct event `location` string from historical_scores,
 * normalizes it (punctuation dirt, missing commas, state abbreviations,
 * misspellings), geocodes it offline against the GeoNames cities1000 dataset
 * (via the `all-the-cities` npm package), and emits the committed gazetteer:
 *
 *   functions/src/helpers/podium/venueGazetteer.json
 *
 * The gazetteer is keyed by the normalized location string so schedule
 * generation / live-scrape ingest can resolve venues with the same
 * normalizer (see helpers/podium/venues.js). Every entry records how it was
 * resolved (exact | fuzzy | centroid) so approximate rows can be hand-reviewed.
 *
 * Data sources (unioned): local pressboxImporter JSON (2000-2012) OR, with
 * --firestore, the full historical_scores collection (needs credentials); PLUS
 * the committed DCI.org-harvested 2013-2026 locations (dciDotOrgLocations.json),
 * so even a credential-free local build spans the entire historical archive
 * rather than just the 2000-2012 pressbox years.
 *
 * Run:
 *   cd functions
 *   npm install --no-save all-the-cities   # one-time; dev-only dependency
 *   node src/scripts/buildVenueGazetteer.js [--firestore]
 */

const fs = require("node:fs");
const path = require("node:path");

const OUTPUT_PATH = path.join(__dirname, "../helpers/podium/venueGazetteer.json");
const LOCAL_DATA_DIR = path.join(__dirname, "../../pressboxImporter/output");
// DCI.org-harvested "City, ST" locations for 2013-2026 — the years the local
// fromthepressbox importer (2000-2012 only) does not carry. Merged into every
// build (local or --firestore) so the committed gazetteer spans the full
// historical archive without needing Firestore credentials. Regenerate with
// scripts/harvestDciLocations.js when new seasons land.
const DCI_LOCATIONS_PATH = path.join(__dirname, "dciDotOrgLocations.json");

const US_STATES = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

const CA_PROVINCES = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
};

// GeoNames encodes Canadian admin1 numerically; all-the-cities carries those
// numeric codes while the gazetteer keys provinces by postal abbreviation.
const CA_GEONAMES_ADMIN = {
  AB: "01",
  BC: "02",
  MB: "03",
  NB: "04",
  NL: "05",
  NS: "07",
  ON: "08",
  PE: "09",
  QC: "10",
  SK: "11",
};

// Durable geocode corrections, keyed by normalized location. The offline
// resolver falls back to a state centroid when a raw location can't be matched
// (tiny/unincorporated venues absent from cities1000) or is geocoded to the
// wrong place by a source typo. Those centroid placeholders used to be
// hand-patched in the emitted JSON and silently reverted on the next rebuild;
// baking them here makes the corrections survive every regeneration. Each entry
// supplies the geo truth (and keeps the original typo-derived venueId so a
// mid-season stored `lastVenue` still compares equal). Add a row whenever a new
// build reports a `centroid` resolution — those are the ones worth reviewing.
// Each value is [venueId, city, region, lat, lng] (country defaults to US).
const MANUAL_OVERRIDES = {
  // Source typos that geocoded to the wrong state, hand-verified to the real venue.
  "ocean springs, oklahoma": ["ocean-springs-ok", "Ocean Springs", "MS", 30.4113, -88.8278],
  "ontario, idaho": ["ontario-id", "Ontario", "OR", 44.0266, -116.9629],
  "van buren, alabama": ["van-buren-al", "Van Buren", "AR", 35.4368, -94.3483],
  "sioux falls, iowa": ["sioux-falls-ia", "Sioux Falls", "SD", 43.5446, -96.7311],
  "severieville, tennessee": ["severieville-tn", "Sevierville", "TN", 35.8681, -83.5619],
  // Real venues too small for cities1000 (population < 1000 / unincorporated).
  "bensalem, pennsylvania": ["bensalem-pa", "Bensalem", "PA", 40.1043, -74.9513],
  "brick, new jersey": ["brick-nj", "Brick", "NJ", 40.0576, -74.1097],
  "knox, ohio": ["knox-oh", "Knox", "OH", 40.3934, -82.4857],
  "newbury park, california": ["newbury-park-ca", "Newbury Park", "CA", 34.1848, -118.9109],
  "wilmot, wisconsin": ["wilmot-wi", "Wilmot", "WI", 42.5117, -88.1793],
  // Tri-Cities, WA appears spelled two ways; both share one venueId so a route
  // between them never charges a phantom leg.
  "tri-cities, washington": ["tri-cities-wa", "Tri-Cities", "WA", 46.2304, -119.2752],
  "tri cities, wa": ["tri-cities-wa", "Tri-Cities", "WA", 46.2304, -119.2752],
  // New 2013-2026 small venues from the dci.org harvest.
  "augusta, nj": ["augusta-nj", "Augusta", "NJ", 41.1237, -74.7268],
  "chestnut hill, ma": ["chestnut-hill-ma", "Chestnut Hill", "MA", 42.3251, -71.162],
  "egg harbor township, nj": ["egg-harbor-township-nj", "Egg Harbor Township", "NJ", 39.3762, -74.6032],
  "mt olive, nj": ["mount-olive-nj", "Mount Olive", "NJ", 40.8451, -74.7649],
  "sewell, nj": ["sewell-nj", "Sewell", "NJ", 39.7562, -75.1157],
  "white lake, mi": ["white-lake-mi", "White Lake", "MI", 42.652, -83.4966],
};

// Curated real DCI venues that never appear in the historical location archive
// (so the resolver never sees them) but should still be selectable — a
// director's hometown, or a city carried in the stadiums table. Injected on
// every build when the key isn't already present, keyed by normalized location
// with the same [venueId, city, region, lat, lng] shape as MANUAL_OVERRIDES.
const SEED_VENUES = {
  // Rynearson Stadium (Eastern Michigan) — a real DCI regional site.
  "ypsilanti, michigan": ["ypsilanti-mi", "Ypsilanti", "MI", 42.2411, -83.613],
};

/** Fold accents and periods so "Montréal" matches "montreal" and "St. Louis" matches "st louis". */
function foldAccents(s) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").replace(/[.]/g, "").replace(/\s+/g, " ").trim();
}

// City-name alias rewrites tried during matching (both directions where listed).
const CITY_ALIASES = [
  [/\bsaint\b/, "st"],
  [/\bst\b/, "saint"],
  [/\bfort\b/, "ft"],
  [/\bft\b/, "fort"],
  [/\bmount\b/, "mt"],
  [/\bmt\b/, "mount"],
  [/boro\b/, "borough"],
];

// name (lowercased) -> { code, country }
const REGION_BY_NAME = {};
for (const [code, name] of Object.entries(US_STATES)) {
  REGION_BY_NAME[name.toLowerCase()] = { code, country: "US" };
}
for (const [code, name] of Object.entries(CA_PROVINCES)) {
  REGION_BY_NAME[name.toLowerCase()] = { code, country: "CA" };
}
const REGION_BY_CODE = {};
for (const [code, name] of Object.entries(US_STATES)) {
  REGION_BY_CODE[code] = { code, name, country: "US" };
}
for (const [code, name] of Object.entries(CA_PROVINCES)) {
  REGION_BY_CODE[code] = { code, name, country: "CA" };
}

/**
 * Canonical form of a raw location string: lowercase, punctuation dirt
 * stripped, whitespace collapsed. This is the gazetteer key, so ingest-time
 * lookups must use the same function (exported via helpers/podium/venues.js).
 * @param {string} raw
 * @returns {string}
 */
function normalizeKey(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[.]+/g, " ")
    .replace(/[^a-z\s,'-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim()
    .replace(/^,\s*/, "")
    .replace(/,\s*$/, "");
}

/**
 * Parse a normalized location into { city, region } where region is a
 * { code, name, country } record, or null when unrecognized.
 * Handles "city, statename", "city, ST", comma-less "city statename", and
 * dirty multi-comma forms ("bristol, rhode, island").
 * @param {string} key normalized location
 * @returns {{city: string, region: object|null}}
 */
function parseLocation(key) {
  const segments = key
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length >= 2) {
    // Try the last 1..3 comma segments joined as a region name (handles
    // "rhode, island"), remainder joined with spaces as the city.
    for (let span = 1; span <= 3 && span < segments.length; span++) {
      const regionRaw = segments.slice(-span).join(" ");
      const region =
        REGION_BY_NAME[regionRaw] ||
        (span === 1 && REGION_BY_CODE[regionRaw.toUpperCase()]) ||
        null;
      if (region) {
        const resolved = region.name ? region : REGION_BY_CODE[region.code];
        return { city: segments.slice(0, -span).join(" "), region: resolved };
      }
    }
    return { city: segments.join(" "), region: null };
  }
  // No comma ("rockford illinois"): try progressively longer trailing
  // word-spans as a region name (state names run up to three words).
  const words = key.split(" ");
  for (let span = 3; span >= 1; span--) {
    if (words.length <= span) continue;
    const tail = words.slice(-span).join(" ");
    const hit = REGION_BY_NAME[tail];
    if (hit) {
      return { city: words.slice(0, -span).join(" "), region: REGION_BY_CODE[hit.code] };
    }
  }
  return { city: key, region: null };
}

/** Levenshtein distance, small-string use only. */
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

/**
 * Collect distinct raw location strings (with usage counts) from all
 * historical_scores year documents.
 * @param {boolean} useFirestore
 * @returns {Promise<Map<string, number>>} raw location -> event count
 */
async function collectLocations(useFirestore) {
  const counts = new Map();
  const ingestYearData = (yearData) => {
    for (const event of yearData || []) {
      if (!event || !event.location) continue;
      counts.set(event.location, (counts.get(event.location) || 0) + 1);
    }
  };

  if (useFirestore) {
    const { getDb } = require("../config");
    const snapshot = await getDb().collection("historical_scores").get();
    snapshot.forEach((doc) => ingestYearData(doc.data().data));
  } else {
    const files = fs
      .readdirSync(LOCAL_DATA_DIR)
      .filter((f) => f.startsWith("historical_scores_") && f.endsWith(".json"));
    for (const file of files) {
      const parsed = JSON.parse(fs.readFileSync(path.join(LOCAL_DATA_DIR, file), "utf8"));
      ingestYearData(parsed.data);
    }
  }

  // Always fold in the DCI.org-harvested 2013-2026 locations. This is the range
  // the local importer omits, and even a --firestore run benefits: any event
  // dci.org lists that Firestore hasn't ingested still contributes its city, so
  // the gazetteer never trails the live schedule. Deduped by normalized key
  // downstream, so re-adding cities already present just bumps their counts.
  if (fs.existsSync(DCI_LOCATIONS_PATH)) {
    const dci = JSON.parse(fs.readFileSync(DCI_LOCATIONS_PATH, "utf8"));
    let added = 0;
    for (const { location, count } of dci.locations || []) {
      if (!location) continue;
      counts.set(location, (counts.get(location) || 0) + (count || 1));
      added += count || 1;
    }
    console.log(
      `Merged ${dci.locations.length} DCI.org locations (${added} events, ${dci.meta.yearRange}).`
    );
  }
  return counts;
}

async function main() {
  const useFirestore = process.argv.includes("--firestore");

  let allCities;
  try {
    allCities = require("all-the-cities");
  } catch {
    console.error(
      "Missing dev dependency. Run:  npm install --no-save all-the-cities  (GeoNames cities1000, CC-BY 4.0)"
    );
    process.exit(1);
  }

  // Index cities by "cityname|CC|regioncode" for exact lookups, and by region
  // for prefix/fuzzy passes and centroids. Canadian numeric GeoNames admin1
  // codes are translated to postal province codes; names are accent-folded.
  const CA_ADMIN_TO_POSTAL = Object.fromEntries(
    Object.entries(CA_GEONAMES_ADMIN).map(([postal, num]) => [num, postal])
  );
  const byCityRegion = new Map();
  const byRegion = new Map();
  for (const city of allCities) {
    if (city.country !== "US" && city.country !== "CA") continue;
    const regionCode = city.country === "CA" ? CA_ADMIN_TO_POSTAL[city.adminCode] : city.adminCode;
    if (!regionCode) continue;
    const entry = { ...city, regionCode, foldedName: foldAccents(city.name.toLowerCase()) };
    const regionKey = `${city.country}|${regionCode}`;
    const cityKey = `${entry.foldedName}|${regionKey}`;
    const existing = byCityRegion.get(cityKey);
    if (!existing || (city.population || 0) > (existing.population || 0)) {
      byCityRegion.set(cityKey, entry);
    }
    if (!byRegion.has(regionKey)) byRegion.set(regionKey, []);
    byRegion.get(regionKey).push(entry);
  }

  /**
   * Resolve a parsed city within a region via the four-stage ladder:
   * exact (incl. alias rewrites and word-prefix truncations of slash
   * compounds) -> prefix containment -> fuzzy (edit<=2, first letter must
   * match) -> null.
   * @returns {{match: object, source: string}|null}
   */
  const resolveCity = (city, regionKey) => {
    const folded = foldAccents(city);
    const candidates = [folded];
    for (const [pattern, replacement] of CITY_ALIASES) {
      if (pattern.test(folded)) candidates.push(folded.replace(pattern, replacement));
    }
    // Compound sites ("bloomington normal") -> try shrinking word prefixes.
    const words = folded.split(" ");
    for (let n = words.length - 1; n >= 1; n--) candidates.push(words.slice(0, n).join(" "));

    for (const candidate of candidates) {
      const exact = byCityRegion.get(`${candidate}|${regionKey}`);
      if (exact) return { match: exact, source: candidate === folded ? "exact" : "fuzzy" };
    }
    // Containment: "bowling" -> "Bowling Green"; "sudbury" -> "Greater
    // Sudbury"; "geneva" -> "Lake Geneva" (>=5 chars, same region).
    let best = null;
    for (const c of byRegion.get(regionKey) || []) {
      const a = c.foldedName;
      if (a.length < 5 || folded.length < 5) continue;
      if (
        a.startsWith(folded) ||
        folded.startsWith(a) ||
        a.endsWith(` ${folded}`) ||
        folded.endsWith(` ${a}`)
      ) {
        if (!best || (c.population || 0) > (best.population || 0)) best = c;
      }
    }
    if (best) return { match: best, source: "fuzzy" };
    // Edit-distance fuzzy with first-letter guard (kills hilton->dillon).
    let bestDist = 3;
    best = null;
    for (const c of byRegion.get(regionKey) || []) {
      if (c.foldedName[0] !== folded[0]) continue;
      const dist = editDistance(c.foldedName, folded);
      if (dist > 2) continue;
      const beatsTie = dist === bestDist && (c.population || 0) > ((best && best.population) || 0);
      if (dist < bestDist || beatsTie) {
        best = c;
        bestDist = dist;
      }
    }
    return best ? { match: best, source: "fuzzy" } : null;
  };

  const locationCounts = await collectLocations(useFirestore);
  console.log(`Distinct raw locations: ${locationCounts.size}`);

  // Group raw variants by normalized key.
  const variantsByKey = new Map();
  for (const [raw, count] of locationCounts) {
    const key = normalizeKey(raw);
    if (!key) continue;
    if (!variantsByKey.has(key)) variantsByKey.set(key, { rawVariants: [], eventCount: 0 });
    const entry = variantsByKey.get(key);
    entry.rawVariants.push(raw);
    entry.eventCount += count;
  }
  console.log(`Distinct normalized keys: ${variantsByKey.size}`);

  const gazetteer = {};
  const stats = { exact: 0, fuzzy: 0, centroid: 0, manual: 0, seed: 0, unresolved: 0 };
  const usedOverrides = new Set();

  for (const [key, { rawVariants, eventCount }] of [...variantsByKey.entries()].sort()) {
    // Durable hand-corrections win outright — they replace whatever the
    // resolver would produce (centroid placeholder, or a source-typo mismatch).
    const override = MANUAL_OVERRIDES[key];
    if (override) {
      const [venueId, city, region, lat, lng] = override;
      usedOverrides.add(key);
      gazetteer[key] = {
        venueId,
        city,
        region,
        country: "US",
        lat,
        lng,
        source: "manual",
        eventCount,
        rawVariants,
      };
      stats.manual++;
      continue;
    }

    const { city, region } = parseLocation(key);
    let resolved = null;

    if (region) {
      const regionKey = `${region.country}|${region.code}`;
      resolved = resolveCity(city, regionKey);

      if (!resolved) {
        // Centroid fallback: population-weighted mean of the region's cities.
        const cities = byRegion.get(regionKey) || [];
        if (cities.length > 0) {
          let wSum = 0;
          let latSum = 0;
          let lngSum = 0;
          for (const c of cities) {
            const w = Math.max(1, c.population || 0);
            wSum += w;
            latSum += c.loc.coordinates[1] * w;
            lngSum += c.loc.coordinates[0] * w;
          }
          gazetteer[key] = {
            venueId: `${city.replace(/[^a-z0-9]+/g, "-")}-${region.code.toLowerCase()}`,
            city: city.replace(/\b\w/g, (ch) => ch.toUpperCase()),
            region: region.code,
            country: region.country,
            lat: Number((latSum / wSum).toFixed(4)),
            lng: Number((lngSum / wSum).toFixed(4)),
            source: "centroid",
            eventCount,
            rawVariants,
          };
          stats.centroid++;
          continue;
        }
      }
    }

    if (!resolved) {
      stats.unresolved++;
      console.warn(`UNRESOLVED: "${key}" (${eventCount} events; raw: ${rawVariants.join(" | ")})`);
      continue;
    }

    const { match, source } = resolved;
    gazetteer[key] = {
      venueId: `${match.foldedName.replace(/[^a-z0-9]+/g, "-")}-${match.regionCode.toLowerCase()}`,
      city: match.name,
      region: match.regionCode,
      country: match.country,
      lat: Number(match.loc.coordinates[1].toFixed(4)),
      lng: Number(match.loc.coordinates[0].toFixed(4)),
      source,
      eventCount,
      rawVariants,
    };
    stats[source]++;
  }

  // Inject curated seed venues that the historical archive never carries.
  for (const [key, seed] of Object.entries(SEED_VENUES)) {
    if (gazetteer[key]) continue;
    const [venueId, city, region, lat, lng] = seed;
    gazetteer[key] = {
      venueId, city, region, country: "US", lat, lng,
      source: "seed", eventCount: 0, rawVariants: [],
    };
    stats.seed++;
  }

  // Surface any override whose key no longer appears in the data (a source fix
  // upstream, a renamed slug) so the table doesn't accumulate dead rows.
  for (const key of Object.keys(MANUAL_OVERRIDES)) {
    if (!usedOverrides.has(key)) console.warn(`STALE OVERRIDE (key not in data): "${key}"`);
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  const output = {
    meta: {
      generatedFrom: [
        useFirestore ? "firestore:historical_scores" : "pressboxImporter/output (2000-2012)",
        "dciDotOrgLocations.json (2013-2026)",
      ],
      distinctRawLocations: locationCounts.size,
      entries: Object.keys(gazetteer).length,
      resolution: stats,
      geodata: "GeoNames cities1000 via all-the-cities (CC-BY 4.0)",
      manualCorrections:
        "The `manual` entries are durable geocode overrides baked into " +
        "scripts/buildVenueGazetteer.js (MANUAL_OVERRIDES), applied on every rebuild.",
    },
    venues: gazetteer,
  };

  // Stamp an IANA timezone on every venue from its coordinates, so the "furthest
  // west" score-drop rule can read it offline (helpers/scoreDropTime.js). Needs
  // the tz-lookup dev dependency; if it's absent, keep the geocode-only build
  // rather than fail — a follow-up `node src/scripts/venueTimezones.js` stamps it.
  try {
    const tzLookup = require("tz-lookup");
    const { enrichVenuesWithTimezones } = require("./venueTimezones");
    const { stats: tzStats, reviews } = enrichVenuesWithTimezones(output, tzLookup);
    output.meta.timezones = {
      resolvedBy: "tz-lookup (coordinate -> IANA), verified against state offset buckets",
      ...tzStats,
    };
    console.log("Timezone stats:", JSON.stringify(tzStats));
    for (const r of reviews) console.warn(`TZ REVIEW: ${r.key} [${r.region}] -> ${r.timezone}: ${r.note}`);
  } catch (error) {
    console.warn(
      `Skipped timezone stamping (${error.message}). ` +
      "Run `npm install --no-save tz-lookup` then `node src/scripts/venueTimezones.js`."
    );
  }

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(gazetteer).length} venues -> ${OUTPUT_PATH}`);
  console.log("Resolution stats:", JSON.stringify(stats));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

module.exports = { normalizeKey, parseLocation };
