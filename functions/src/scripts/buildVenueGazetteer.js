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
 * Data source: local pressboxImporter JSON by default; pass --firestore to
 * read the full historical_scores collection instead (requires credentials).
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
  const stats = { exact: 0, fuzzy: 0, centroid: 0, unresolved: 0 };

  for (const [key, { rawVariants, eventCount }] of [...variantsByKey.entries()].sort()) {
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

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  const output = {
    meta: {
      generatedFrom: useFirestore ? "firestore:historical_scores" : "pressboxImporter/output",
      distinctRawLocations: locationCounts.size,
      entries: Object.keys(gazetteer).length,
      resolution: stats,
      geodata: "GeoNames cities1000 via all-the-cities (CC-BY 4.0)",
    },
    venues: gazetteer,
  };
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(gazetteer).length} venues -> ${OUTPUT_PATH}`);
  console.log("Resolution stats:", JSON.stringify(stats));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

module.exports = { normalizeKey, parseLocation };
