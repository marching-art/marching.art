/**
 * Venue resolution + travel math for Podium Class (Phase 3, design §5.3).
 *
 * Wraps the committed gazetteer (built by scripts/buildVenueGazetteer.js —
 * which imports normalizeKey from here so ingest and lookup can never
 * disagree). Distances are haversine miles × road factor, then bucketed into
 * the balance config's travel tiers; the deterministic heat index scales
 * show-day stamina by venue latitude.
 */

const gazetteer = require("./venueGazetteer.json");
const stadiums = require("./stadiums.json");
const { standardizeLocation } = require("../locationFormat");

/**
 * Canonical form of a raw location string — the gazetteer key.
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

// Secondary index keyed by each venue's canonical "City, ST" label (the exact
// form stored on hosted-event rows and shown in the client picker). The
// gazetteer keys come from historical data, which spells regions out
// ("Canton, Ohio"), so an abbreviated "Canton, OH" would miss the primary
// lookup. Built by re-normalizing each venue's own {city, region} so index and
// lookup apply the same transform.
const canonicalIndex = {};
for (const venue of Object.values(gazetteer.venues)) {
  canonicalIndex[normalizeKey(`${venue.city}, ${venue.region}`)] = venue;
}

// Tertiary index keyed by the STATE-CODE-STANDARDIZED form of each venue's own
// raw location variants (helpers/locationFormat.standardizeLocation). Schedules
// now store locations in "City, ST" form (locations enter through
// standardizeLocation before storage), but that keeps the venue's ORIGINAL city
// spelling — which the gazetteer often corrected during geocoding: typos
// ("Severieville" -> "Sevierville"), slash compounds ("Bloomington/Normal" ->
// "Bloomington"), fuzzy matches ("Bowling" -> "Bowling Green"), and manual
// overrides that fix a wrong state. For those the standardized string
// ("Severieville, TN") matches neither the primary key ("severieville,
// tennessee") nor the canonical index ("sevierville, tn"), so it would resolve
// to null and silently drop travel/heat/timezone math. Re-standardizing each
// stored rawVariant here maps every historical spelling back to its venue.
// First-wins on the rare cross-venue key collision (none in the current
// gazetteer) keeps the primary/canonical indexes authoritative.
const standardizedIndex = {};
for (const venue of Object.values(gazetteer.venues)) {
  const variants = venue.rawVariants && venue.rawVariants.length
    ? venue.rawVariants
    : [`${venue.city}, ${venue.region}`];
  for (const raw of variants) {
    const key = normalizeKey(standardizeLocation(raw));
    if (key && !standardizedIndex[key]) standardizedIndex[key] = venue;
  }
}

/**
 * Resolve a location string to a gazetteer venue, or null. Accepts the
 * historical full-name spelling ("Allentown, Pennsylvania"), the canonical
 * "City, ST" label ("Allentown, PA"), and the state-code-standardized form of
 * any historical spelling even when the gazetteer corrected the city (a typo'd
 * "Severieville, TN" still resolves to the Sevierville venue).
 * @param {string} locationString
 * @returns {{venueId, city, region, lat, lng, timezone?: (string|null)}|null}
 */
function venueFor(locationString) {
  const key = normalizeKey(locationString);
  return gazetteer.venues[key] || canonicalIndex[key] || standardizedIndex[key] || null;
}

/**
 * The real stadium name for a venue, or null when none is on file (design
 * §5.12). Keyed by venueId against the curated stadiums table — callers show
 * "City, ST · Stadium" when this returns a name and city-only otherwise.
 * @param {string|null} venueId
 * @returns {string|null}
 */
function stadiumFor(venueId) {
  return (venueId && stadiums.stadiums[venueId]) || null;
}

/**
 * The IANA timezone for a location string (e.g. "America/Los_Angeles"), or null
 * when the venue is unknown or was never stamped with one. Baked into the
 * gazetteer by scripts/venueTimezones.js from each venue's coordinates; the
 * furthest-west score-drop rule (helpers/scoreDropTime.js) consumes it. Returns
 * null rather than a default so callers decide the fallback (live scoring
 * assumes the latest possible zone when a show's venue can't be resolved).
 * @param {string} locationString
 * @returns {string|null}
 */
function timezoneFor(locationString) {
  const venue = venueFor(locationString);
  return (venue && venue.timezone) || null;
}

/** Great-circle distance in miles. */
function haversineMiles(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Bucket road miles into a travel tier from balance config.
 * @param {number} miles straight-line miles (road factor applied here)
 * @param {object} cfg balanceConfig
 * @returns {{key, maxMiles, coinCost, staminaCost, roadMiles}}
 */
function travelTierFor(miles, cfg) {
  const roadMiles = miles * cfg.travel.roadFactor;
  for (const tier of cfg.travel.tiers) {
    if (roadMiles <= tier.maxMiles) return { ...tier, roadMiles: Math.round(roadMiles) };
  }
  const last = cfg.travel.tiers[cfg.travel.tiers.length - 1];
  return { ...last, roadMiles: Math.round(roadMiles) };
}

/**
 * Travel leg between two venues (either may be null -> null leg, no cost).
 * @returns {{tier: string, miles: number, coinCost: number, staminaCost: number}|null}
 */
function travelLeg(fromVenue, toVenue, cfg) {
  if (!fromVenue || !toVenue) return null;
  if (fromVenue.venueId === toVenue.venueId) {
    return { tier: "local", miles: 0, coinCost: 0, staminaCost: 0 };
  }
  const tier = travelTierFor(haversineMiles(fromVenue, toVenue), cfg);
  return {
    tier: tier.key,
    miles: tier.roadMiles,
    coinCost: tier.coinCost,
    staminaCost: tier.staminaCost,
  };
}

/**
 * Cost of relocating a corps' official home between seasons (design §5.3): a
 * flat CorpsCoin fee per mile of great-circle distance from the old home to the
 * new one — the "encourage corps to start in their home region" sink. Uses raw
 * distance (no road factor): a home move is a permanent relocation, priced on
 * the map, not a bus route. Same venue (or an unknown endpoint) is free.
 * @param {object|null} fromVenue the current home venue ({lat, lng, venueId})
 * @param {object|null} toVenue the proposed new home venue
 * @param {object} cfg balanceConfig
 * @returns {{miles: number, fee: number}} miles moved and the CorpsCoin fee
 */
function relocationFee(fromVenue, toVenue, cfg) {
  if (!fromVenue || !toVenue || fromVenue.venueId === toVenue.venueId) {
    return { miles: 0, fee: 0 };
  }
  const miles = haversineMiles(fromVenue, toVenue);
  const milesPerCoin = (cfg.home && cfg.home.milesPerCoin) || 2;
  return { miles: Math.round(miles), fee: Math.ceil(miles / milesPerCoin) };
}

/**
 * Airfare option for a travel leg (design §5.3). Over the tier threshold a
 * director may pre-book a flight in the route portal to cut the leg's travel-
 * stamina hit for a CorpsCoin fee of 1 CC per `milesPerCoin` miles. The fee is
 * priced on the leg's DISPLAYED road miles so the portal's "1 CC / 2 mi" reads
 * true, and eligibility is a config-driven tier list (the ~600-mile floor is
 * tunable, never a magic number). Defensive against an override doc that
 * predates the airfare config: no config → nothing is flyable.
 * @param {{tier: string, miles: number}|null} leg a travelLeg result
 * @param {object} cfg balanceConfig
 * @returns {{eligible: boolean, coinCost: number, staminaMultiplier: number}}
 */
function airfareFor(leg, cfg) {
  const air = cfg.travel && cfg.travel.airfare;
  if (!leg || !air || !Array.isArray(air.eligibleTiers) || !air.eligibleTiers.includes(leg.tier)) {
    return { eligible: false, coinCost: 0, staminaMultiplier: 1 };
  }
  if (!(leg.miles > 0)) return { eligible: false, coinCost: 0, staminaMultiplier: 1 };
  return {
    eligible: true,
    coinCost: Math.ceil(leg.miles / (air.milesPerCoin || 2)),
    staminaMultiplier: air.staminaMultiplier != null ? air.staminaMultiplier : 0.5,
  };
}

/**
 * Deterministic heat-index stamina surcharge for performing at a venue:
 * hotter (more southern) sites drain more (design §5.3 climate). No RNG.
 * @param {object|null} venue
 * @param {object} cfg balanceConfig
 * @returns {number} extra stamina cost (0 when venue unknown)
 */
function heatStamina(venue, cfg) {
  if (!venue) return 0;
  const { baseLatitude, staminaPerDegreeSouth, maxExtraStamina } = cfg.travel.heatIndex;
  const degreesSouth = Math.max(0, baseLatitude - venue.lat);
  return Math.min(maxExtraStamina, Math.round(degreesSouth * staminaPerDegreeSouth * 10) / 10);
}

// The branded majors' fixed sites (schedule generator hard-codes these),
// plus Championship Week in Indianapolis — subsidized travel like every
// major (isMajor derives from membership here).
const MAJOR_VENUES = {
  28: venueFor("Dallas, Texas"),
  35: venueFor("Atlanta, Georgia"),
  41: venueFor("Allentown, Pennsylvania"),
  42: venueFor("Allentown, Pennsylvania"),
  47: venueFor("Indianapolis, Indiana"),
  48: venueFor("Indianapolis, Indiana"),
  49: venueFor("Indianapolis, Indiana"),
};

module.exports = {
  normalizeKey,
  venueFor,
  stadiumFor,
  timezoneFor,
  haversineMiles,
  travelTierFor,
  travelLeg,
  relocationFee,
  airfareFor,
  heatStamina,
  MAJOR_VENUES,
};
