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

/**
 * Resolve a location string to a gazetteer venue, or null.
 * @param {string} locationString e.g. "Allentown, Pennsylvania"
 * @returns {{venueId, city, region, lat, lng}|null}
 */
function venueFor(locationString) {
  const key = normalizeKey(locationString);
  return gazetteer.venues[key] || null;
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
  haversineMiles,
  travelTierFor,
  travelLeg,
  heatStamina,
  MAJOR_VENUES,
};
