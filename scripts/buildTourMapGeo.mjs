#!/usr/bin/env node
// =============================================================================
// TOUR MAP GEOMETRY BUILD
// =============================================================================
// Emits src/data/tourMapGeo.json — the pre-projected, pre-simplified SVG paths
// the Tour Map poster draws (US states + a Canada/Mexico backdrop), plus the
// exact projection parameters used to place them.
//
// Why pre-project at build time: the app ships no mapping library. Baking the
// Albers math into the committed artifact means the runtime only has to render
// path strings, and `src/utils/tourMap.ts` reuses the SAME parameters (carried
// in meta.projection) to place a venue's lat/lng — so a dot can never drift off
// the state it belongs to.
//
// Sources are the standard TopoJSON atlases (public domain, US Census / Natural
// Earth derived). Regenerate when the shapes need refreshing:
//
//   node scripts/buildTourMapGeo.mjs
//
// Needs network access; uses the repo's Prettier to format its output (Node >= 18, ESM).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { format } from 'prettier';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = join(ROOT, 'src', 'data', 'tourMapGeo.json');

const STATES_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
const COUNTRIES_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Alaska, Hawaii, Puerto Rico and the island territories. Every DCI-era venue in
// the gazetteer sits in the lower 48 (or just over the Canadian border), so the
// poster is a lower-48 map — no inset shuffling, no dead space.
const EXCLUDED_STATE_IDS = new Set(['02', '15', '60', '66', '69', '72', '78']);

// The land mass behind the border: tour routes brush Ontario and the Rio Grande,
// and an outline that stops dead at the border reads as an error.
const NEIGHBOR_NAMES = new Set(['Canada', 'Mexico']);

// The atlas identifies states by name; venues carry the USPS code. Baking the
// code into the artifact lets the poster shade the states a corps toured
// without shipping this table to the client.
const USPS_BY_NAME = {
  Alabama: 'AL',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  'District of Columbia': 'DC',
  Florida: 'FL',
  Georgia: 'GA',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
};

// Poster canvas. 16:10-ish keeps the lower 48 (which is ~1.55:1) comfortable
// with room for the title block the poster draws over the northwest corner.
const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 600;
const PADDING = 16;

// Screen-space simplification. The poster renders ~1000px wide at most, so a
// third of a pixel is invisible while cutting the payload by roughly half.
const TOLERANCE = 0.35;

const DEG = Math.PI / 180;

// -----------------------------------------------------------------------------
// Projection — Albers (conic equal-area), the conventional US projection.
// Mirrored byte-for-byte by projectLatLng() in src/utils/tourMap.ts.
// -----------------------------------------------------------------------------
const PARALLELS = [29.5, 45.5]; // standard parallels
const ROTATE_LNG = 96; // central meridian, as a longitude rotation

const y0 = PARALLELS[0] * DEG;
const y1 = PARALLELS[1] * DEG;
const N = (Math.sin(y0) + Math.sin(y1)) / 2;
const C = 1 + Math.sin(y0) * (2 * N - Math.sin(y0));
const R0 = Math.sqrt(C) / N;

/** Raw (unscaled) Albers coordinates for a lon/lat pair, in radians-ish units. */
function albersRaw(lng, lat) {
  // Rotate the central meridian to 0, normalized back into [-180, 180].
  let lambda = (lng + ROTATE_LNG) % 360;
  if (lambda > 180) lambda -= 360;
  else if (lambda < -180) lambda += 360;
  lambda *= DEG;
  const phi = lat * DEG;
  const r = Math.sqrt(C - 2 * N * Math.sin(phi)) / N;
  return [r * Math.sin(lambda * N), R0 - r * Math.cos(lambda * N)];
}

// -----------------------------------------------------------------------------
// TopoJSON decoding (the subset this script needs: quantized arcs, Polygon and
// MultiPolygon geometries).
// -----------------------------------------------------------------------------
function decodeArcs(topology) {
  const [sx, sy] = topology.transform.scale;
  const [tx, ty] = topology.transform.translate;
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * sx + tx, y * sy + ty];
    });
  });
}

/** Points of arc `i`, reversed when the index is the one's-complement form. */
function arcPoints(arcs, i) {
  return i < 0 ? arcs[~i].slice().reverse() : arcs[i];
}

/** Every ring of a geometry, as arrays of arc indices. */
function geometryRings(geometry) {
  if (geometry.type === 'Polygon') return geometry.arcs;
  if (geometry.type === 'MultiPolygon') return geometry.arcs.flat();
  return [];
}

// -----------------------------------------------------------------------------
// Simplification — Douglas–Peucker, applied to ARCS rather than assembled rings
// so a border shared by two states simplifies identically on both sides and no
// hairline gap opens between them.
// -----------------------------------------------------------------------------
function simplify(points, tolerance) {
  if (points.length <= 2) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop();
    if (last <= first + 1) continue;

    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    let farthest = -1;
    let maxDistSq = tolerance * tolerance;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i];
      let distSq;
      if (lenSq === 0) {
        distSq = (px - ax) ** 2 + (py - ay) ** 2;
      } else {
        let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        distSq = (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2;
      }
      if (distSq > maxDistSq) {
        maxDistSq = distSq;
        farthest = i;
      }
    }

    if (farthest !== -1) {
      keep[farthest] = 1;
      stack.push([first, farthest], [farthest, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

// -----------------------------------------------------------------------------
// Path assembly
// -----------------------------------------------------------------------------
const round = (n) => Math.round(n * 10) / 10;

function ringToPath(points) {
  if (points.length < 3) return '';
  const parts = [`M${round(points[0][0])} ${round(points[0][1])}`];
  let [lastX, lastY] = [round(points[0][0]), round(points[0][1])];
  for (let i = 1; i < points.length; i++) {
    const x = round(points[i][0]);
    const y = round(points[i][1]);
    // Rounding can collapse neighbors onto the same coordinate — drop the dupes
    // rather than emitting zero-length segments.
    if (x === lastX && y === lastY) continue;
    parts.push(`L${x} ${y}`);
    lastX = x;
    lastY = y;
  }
  if (parts.length < 3) return '';
  return `${parts.join('')}Z`;
}

function geometryToPath(geometry, projectedArcs) {
  const paths = [];
  for (const ring of geometryRings(geometry)) {
    const points = [];
    for (const index of ring) {
      const arc = arcPoints(projectedArcs, index);
      // Consecutive arcs in a ring share their joint point.
      points.push(...(points.length > 0 ? arc.slice(1) : arc));
    }
    const d = ringToPath(points);
    if (d) paths.push(d);
  }
  return paths.join('');
}

// -----------------------------------------------------------------------------
// Build
// -----------------------------------------------------------------------------
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const [statesTopo, countriesTopo] = await Promise.all([
    fetchJson(STATES_URL),
    fetchJson(COUNTRIES_URL),
  ]);

  const stateGeometries = statesTopo.objects.states.geometries.filter(
    (g) => !EXCLUDED_STATE_IDS.has(g.id)
  );
  const neighborGeometries = countriesTopo.objects.countries.geometries.filter((g) =>
    NEIGHBOR_NAMES.has(g.properties?.name)
  );

  const stateArcsRaw = decodeArcs(statesTopo).map((arc) => arc.map(([x, y]) => albersRaw(x, y)));
  const neighborArcsRaw = decodeArcs(countriesTopo).map((arc) =>
    arc.map(([x, y]) => albersRaw(x, y))
  );

  // Fit the LOWER 48 to the canvas; the neighbor backdrop rides along on the
  // same transform and is clipped by the viewBox at render time.
  const used = new Set();
  for (const g of stateGeometries) {
    for (const ring of geometryRings(g)) {
      for (const i of ring) used.add(i < 0 ? ~i : i);
    }
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const i of used) {
    for (const [x, y] of stateArcsRaw[i]) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const scale = Math.min(
    (VIEW_WIDTH - 2 * PADDING) / (maxX - minX),
    (VIEW_HEIGHT - 2 * PADDING) / (maxY - minY)
  );
  // Raw Albers y grows northward; SVG y grows downward, hence the sign flip.
  const translate = [
    (VIEW_WIDTH - scale * (minX + maxX)) / 2,
    (VIEW_HEIGHT + scale * (minY + maxY)) / 2,
  ];

  const toScreen = (arcs) =>
    arcs.map((arc) =>
      simplify(
        arc.map(([x, y]) => [translate[0] + scale * x, translate[1] - scale * y]),
        TOLERANCE
      )
    );

  const stateArcs = toScreen(stateArcsRaw);
  const neighborArcs = toScreen(neighborArcsRaw);

  const states = stateGeometries
    .map((g) => {
      const name = g.properties?.name || '';
      const code = USPS_BY_NAME[name];
      if (!code) console.warn(`  ! no USPS code for "${name}" — it will never shade as visited`);
      return { id: g.id, code: code || '', name, d: geometryToPath(g, stateArcs) };
    })
    .filter((s) => s.d)
    .sort((a, b) => a.id.localeCompare(b.id));

  const neighbors = neighborGeometries
    .map((g) => ({ name: g.properties.name, d: geometryToPath(g, neighborArcs) }))
    .filter((n) => n.d)
    .sort((a, b) => a.name.localeCompare(b.name));

  const output = {
    meta: {
      _note:
        'GENERATED by scripts/buildTourMapGeo.mjs — do not hand-edit. ' +
        'Pre-projected SVG paths for the Tour Map poster.',
      sources: [STATES_URL, COUNTRIES_URL],
      generatedAt: new Date().toISOString().slice(0, 10),
      viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      // Consumed by src/utils/tourMap.js to place venue dots on these paths.
      // scale/translate are FIT-DERIVED (from the lower-48 bounding box), so
      // they must travel with the paths rather than being re-derived.
      projection: {
        type: 'albers',
        parallels: PARALLELS,
        rotateLng: ROTATE_LNG,
        scale,
        translate,
      },
    },
    states,
    neighbors,
  };

  // Formatted with the repo's own Prettier config: this is a committed
  // artifact, so a regeneration must leave `npm run format:check` green
  // without a manual follow-up pass.
  const json = await format(JSON.stringify(output), { parser: 'json' });
  writeFileSync(OUTPUT_PATH, json);
  const bytes = json.length;
  console.log(
    `Wrote ${states.length} states + ${neighbors.length} neighbors ` +
      `(${(bytes / 1024).toFixed(1)} KB) to src/data/tourMapGeo.json`
  );
  console.log(
    `  projection scale=${scale.toFixed(3)} translate=[${translate.map((t) => t.toFixed(3)).join(', ')}]`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
