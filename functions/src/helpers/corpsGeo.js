/**
 * Corps home geolocation (Phase 5 of docs/EVENT_SCHEDULES_AND_SLOTS.md).
 *
 * A corps' `location` is free text a director typed ("Allentown, PA"). To pick
 * the encore corps (nearest home to the show venue) we need coordinates, so this
 * resolves that text to lat/lng via the same venue gazetteer the schedule uses
 * (helpers/podium/venues.js). It's a pure in-memory lookup — no network — so it's
 * cheap to call at registration time AND when (re)building the registration index.
 *
 * Unresolvable text → null (many director locations won't match a DCI venue);
 * the encore simply skips a corps with no home, and the host-encore still works.
 */

const { venueFor, haversineMiles } = require("./podium/venues");

/**
 * Resolve a corps' free-text home location to coordinates, or null.
 * @param {string} location
 * @returns {{lat:number, lng:number, venueId:string}|null}
 */
function homeGeoFor(location) {
  const v = venueFor(location);
  if (!v || !Number.isFinite(v.lat) || !Number.isFinite(v.lng)) return null;
  return { lat: v.lat, lng: v.lng, venueId: v.venueId };
}

/**
 * Great-circle miles between two {lat,lng} points, or null if either is missing.
 * Thin wrapper over the gazetteer's haversine so callers don't reach into podium.
 * @param {{lat:number,lng:number}|null} a
 * @param {{lat:number,lng:number}|null} b
 * @returns {number|null}
 */
function milesBetween(a, b) {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return null;
  return haversineMiles(a, b);
}

module.exports = { homeGeoFor, milesBetween };
