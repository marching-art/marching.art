/**
 * Where a director-hosted show may be booked — client mirror of
 * functions/src/helpers/podium/hostingArea.js (the server is authoritative;
 * this greys out off-map towns in the hosting picker).
 *
 * The rule: the show's pin must land on the Tour Map poster. Lower-48/DC and
 * Canadian-province towns are projected through the poster's Albers projection
 * (the same parameters as src/data/tourMapGeo.json meta — pinned by
 * hostingArea.test.ts) and must fall inside the viewBox, inset by EDGE_MARGIN.
 * The parameters are inlined rather than read from tourMapGeo.json because
 * that file is heavy and belongs to the lazily-loaded tour map chunk.
 */

export const HOSTING_PROJECTION = {
  parallels: [29.5, 45.5],
  rotateLng: 96,
  scale: 1243.925280482388,
  translate: [489.8098165222472, 1099.2107486660288],
};
export const HOSTING_MAP_SIZE = { width: 960, height: 600 };
const EDGE_MARGIN = 8;

/**
 * Lower 48 + DC, the ten provinces (the territories are all off-map), and the
 * six northern-Mexico border states (ISO 3166-2:MX codes).
 */
// prettier-ignore
export const HOSTABLE_REGIONS: ReadonlySet<string> = new Set([
  'AL', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE',
  'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'ON', 'PE', 'QC', 'SK',
  'BCN', 'SON', 'CHH', 'COA', 'NLE', 'TAM',
]);

const DEG = Math.PI / 180;
const PHI0 = HOSTING_PROJECTION.parallels[0] * DEG;
const PHI1 = HOSTING_PROJECTION.parallels[1] * DEG;
const N = (Math.sin(PHI0) + Math.sin(PHI1)) / 2;
const C = 1 + Math.sin(PHI0) * (2 * N - Math.sin(PHI0));
const R0 = Math.sqrt(C) / N;

/** True when a town may host a show: its pin lands inside the Tour Map poster. */
export function isHostableArea(
  place: { region?: string | null; lat?: number | null; lng?: number | null } | null | undefined
): boolean {
  if (!place || !HOSTABLE_REGIONS.has(String(place.region || '').toUpperCase())) return false;
  const { lat, lng } = place;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  let lambda = (lng + HOSTING_PROJECTION.rotateLng) % 360;
  if (lambda > 180) lambda -= 360;
  else if (lambda < -180) lambda += 360;
  lambda *= DEG;
  const r = Math.sqrt(C - 2 * N * Math.sin(lat * DEG)) / N;
  const x = HOSTING_PROJECTION.translate[0] + HOSTING_PROJECTION.scale * r * Math.sin(lambda * N);
  const y =
    HOSTING_PROJECTION.translate[1] - HOSTING_PROJECTION.scale * (R0 - r * Math.cos(lambda * N));
  return (
    x >= EDGE_MARGIN &&
    x <= HOSTING_MAP_SIZE.width - EDGE_MARGIN &&
    y >= EDGE_MARGIN &&
    y <= HOSTING_MAP_SIZE.height - EDGE_MARGIN
  );
}
