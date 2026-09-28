/**
 * Where a director-hosted show may be booked: the contiguous 48 states (plus
 * DC) and the bands of southern Canada and northern Mexico that the Tour Map
 * poster actually draws.
 *
 * The rule is literally "the show's pin lands on the poster": the town is
 * projected through the SAME Albers projection the poster uses
 * (src/data/tourMapGeo.json meta, built by scripts/buildTourMapGeo.mjs) and
 * must fall inside its viewBox, inset by EDGE_MARGIN so a pin never sits
 * half-clipped on the frame. Every lower-48 town passes; Alaska and Hawaii are
 * refused by region; in Canada the poster edge keeps Vancouver-to-Québec City
 * and drops the far north and the Maritimes east of the frame; in Mexico it
 * keeps the border states down to about Monterrey and Culiacán.
 *
 * The projection parameters are copied here (functions can't import src/) and
 * pinned to the poster artifact by hostingArea.test.js, so regenerating the
 * map with a different fit fails the test instead of silently drifting. The
 * client mirror is src/utils/hostingArea.ts.
 */

// Mirrors tourMapGeo.json meta.projection / meta.width / meta.height.
const PROJECTION = {
  parallels: [29.5, 45.5],
  rotateLng: 96,
  scale: 1243.925280482388,
  translate: [489.8098165222472, 1099.2107486660288],
};
const MAP_WIDTH = 960;
const MAP_HEIGHT = 600;
const EDGE_MARGIN = 8;

/**
 * Lower 48 + DC, the ten provinces (the territories are all off-map), and the
 * six northern-Mexico border states (ISO 3166-2:MX codes).
 */
const HOSTABLE_REGIONS = new Set([
  "AL", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "ID", "IL", "IN",
  "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE",
  "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "AB", "BC", "MB", "NB", "NL", "NS", "ON", "PE", "QC", "SK",
  "BCN", "SON", "CHH", "COA", "NLE", "TAM",
]);

const DEG = Math.PI / 180;
const PHI0 = PROJECTION.parallels[0] * DEG;
const PHI1 = PROJECTION.parallels[1] * DEG;
const N = (Math.sin(PHI0) + Math.sin(PHI1)) / 2;
const C = 1 + Math.sin(PHI0) * (2 * N - Math.sin(PHI0));
const R0 = Math.sqrt(C) / N;

/**
 * Project a lon/lat pair into poster coordinates (identical math to
 * src/utils/tourMap.ts projectLatLng).
 * @param {number} lng
 * @param {number} lat
 * @returns {{x: number, y: number}}
 */
function projectLatLng(lng, lat) {
  let lambda = (lng + PROJECTION.rotateLng) % 360;
  if (lambda > 180) lambda -= 360;
  else if (lambda < -180) lambda += 360;
  lambda *= DEG;
  const r = Math.sqrt(C - 2 * N * Math.sin(lat * DEG)) / N;
  return {
    x: PROJECTION.translate[0] + PROJECTION.scale * r * Math.sin(lambda * N),
    y: PROJECTION.translate[1] - PROJECTION.scale * (R0 - r * Math.cos(lambda * N)),
  };
}

/**
 * True when a resolved town may host a show: a lower-48/DC, Canadian-province
 * or northern-Mexico town whose pin lands inside the Tour Map poster.
 * @param {{region?: string, lat?: number, lng?: number}|null|undefined} venue
 * @returns {boolean}
 */
function isHostableArea(venue) {
  if (!venue || !HOSTABLE_REGIONS.has(String(venue.region || "").toUpperCase())) return false;
  if (!Number.isFinite(venue.lat) || !Number.isFinite(venue.lng)) return false;
  const { x, y } = projectLatLng(/** @type {number} */ (venue.lng), /** @type {number} */ (venue.lat));
  return (
    x >= EDGE_MARGIN &&
    x <= MAP_WIDTH - EDGE_MARGIN &&
    y >= EDGE_MARGIN &&
    y <= MAP_HEIGHT - EDGE_MARGIN
  );
}

module.exports = {
  PROJECTION,
  MAP_WIDTH,
  MAP_HEIGHT,
  EDGE_MARGIN,
  HOSTABLE_REGIONS,
  projectLatLng,
  isHostableArea,
};
