/**
 * Tour Map geometry — turns a corps' show locations into points on the poster.
 *
 * The map itself (src/data/tourMapGeo.json) ships as pre-projected SVG paths;
 * this module re-implements the SAME Albers projection the build script used
 * (scripts/buildTourMapGeo.mjs) and reads its fit-derived scale/translate out
 * of the artifact's meta. That shared parameter block is what guarantees a
 * venue dot lands on the state it belongs to — change the projection in one
 * place and the other follows automatically on the next regeneration.
 *
 * No mapping library involved: the app ships none, and a lower-48 poster needs
 * exactly one conic projection and a handful of bezier arcs.
 *
 * Both data files this module loads (the projected geography and the venue
 * coordinate table) are heavy and are imported ONLY here, so they land in the
 * lazily-chunked tour map and never in the Schedule page's own bundle.
 */

import geo from '../data/tourMapGeo.json';
import coords from '../data/venueCoords.json';
import { HOSTABLE_VENUES, resolveVenueId } from './venues';

const DEG = Math.PI / 180;

/**
 * venueId -> [lat, lng]. Cities with no fix are absent from the table, not
 * present with nulls. (JSON widens the tuples to number[]; the lookup below is
 * what narrows them back.)
 */
const VENUE_COORDS: Record<string, number[]> = coords;

/** venueId -> the city/region label the poster prints. */
const VENUE_LABELS = new Map(
  HOSTABLE_VENUES.map((v: { venueId: string; city: string; region: string }) => [v.venueId, v])
);

export interface MapPoint {
  x: number;
  y: number;
}

/** A located stop: poster coordinates plus the city they resolved from. */
export interface VenuePoint extends MapPoint {
  city: string;
  region: string;
  venueId: string;
}

/** Canvas the pre-projected paths were fitted to. */
export const MAP_VIEW = {
  viewBox: geo.meta.viewBox,
  width: geo.meta.width,
  height: geo.meta.height,
};

/** US state outlines, pre-projected. `code` is the USPS abbreviation. */
export const MAP_STATES: ReadonlyArray<{ id: string; code: string; name: string; d: string }> =
  geo.states;

/** Canada/Mexico backdrop, pre-projected (clipped to the viewBox at render). */
export const MAP_NEIGHBORS: ReadonlyArray<{ name: string; d: string }> = geo.neighbors;

const { parallels, rotateLng, scale, translate } = geo.meta.projection;

const PHI0 = parallels[0] * DEG;
const PHI1 = parallels[1] * DEG;
const N = (Math.sin(PHI0) + Math.sin(PHI1)) / 2;
const C = 1 + Math.sin(PHI0) * (2 * N - Math.sin(PHI0));
const R0 = Math.sqrt(C) / N;

/** Project a lon/lat pair into poster coordinates (the tourMapGeo viewBox). */
export function projectLatLng(lng: number, lat: number): MapPoint {
  // Rotate the central meridian to 0, normalized back into [-180, 180].
  let lambda = (lng + rotateLng) % 360;
  if (lambda > 180) lambda -= 360;
  else if (lambda < -180) lambda += 360;
  lambda *= DEG;

  const phi = lat * DEG;
  const r = Math.sqrt(C - 2 * N * Math.sin(phi)) / N;
  const rawX = r * Math.sin(lambda * N);
  const rawY = R0 - r * Math.cos(lambda * N);

  // Raw Albers y grows northward; SVG y grows downward.
  return { x: translate[0] + scale * rawX, y: translate[1] - scale * rawY };
}

/** A venue's coordinates, or null when the gazetteer has no fix for it. */
export function venueLatLng(venueId: string): { lat: number; lng: number } | null {
  const pair = VENUE_COORDS[venueId];
  if (!pair || pair.length < 2) return null;
  return { lat: pair[0], lng: pair[1] };
}

/**
 * Poster coordinates for a schedule location string ("Allentown, PA"), or null
 * when the city isn't in the venue gazetteer. Callers must handle null — a
 * hosted event or a hand-edited schedule can name a city we have no fix for,
 * and an unplaceable stop belongs in the list, not at [0, 0] off Baja.
 */
export function locationPoint(locationString: string): VenuePoint | null {
  const venueId = resolveVenueId(locationString);
  if (!venueId) return null;

  const coord = venueLatLng(venueId);
  const label = VENUE_LABELS.get(venueId);
  if (!coord || !label) return null;

  const { x, y } = projectLatLng(coord.lng, coord.lat);
  return { x, y, city: label.city, region: label.region, venueId };
}

/**
 * Control point for a leg's quadratic curve. Straight lines between clustered
 * Midwest cities overlap into an unreadable scribble; bowing each leg to one
 * side separates them and reads as travel rather than as a chart line.
 *
 * The bow is perpendicular to the leg and proportional to its length (capped),
 * so short hops stay nearly straight and long hauls arc. It is always to the
 * left of travel, so successive legs fan the same way instead of zig-zagging.
 */
function controlPoint(from: MapPoint, to: MapPoint, curvature: number): MapPoint | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return null;

  // Cap the bow so a coast-to-coast leg doesn't balloon out of the viewBox.
  const bow = Math.min(dist * curvature, 70);
  return {
    x: (from.x + to.x) / 2 + (dy / dist) * bow,
    y: (from.y + to.y) / 2 - (dx / dist) * bow,
  };
}

/**
 * A gently curved leg between two stops, as an SVG path `d`. Empty when the two
 * stops share a point (the same city twice) — nothing to draw.
 */
export function legPath(from: MapPoint, to: MapPoint, curvature = 0.14): string {
  const c = controlPoint(from, to, curvature);
  if (!c) return '';
  return `M${from.x.toFixed(1)} ${from.y.toFixed(1)}Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

/**
 * Point and heading at the midpoint of a leg — where the direction arrow sits.
 * Derived from the same control point legPath() uses.
 * @returns angle in degrees, or null for a degenerate leg
 */
export function legMidpoint(
  from: MapPoint,
  to: MapPoint,
  curvature = 0.14
): (MapPoint & { angle: number }) | null {
  const c = controlPoint(from, to, curvature);
  if (!c) return null;

  // Quadratic bezier at t = 0.5, and its derivative for the heading.
  const x = 0.25 * from.x + 0.5 * c.x + 0.25 * to.x;
  const y = 0.25 * from.y + 0.5 * c.y + 0.25 * to.y;
  const tx = c.x - from.x + (to.x - c.x);
  const ty = c.y - from.y + (to.y - c.y);

  return { x, y, angle: (Math.atan2(ty, tx) * 180) / Math.PI };
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const overlaps = (a: Box, b: Box): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Placement chosen for one city label. */
export interface LabelPlacement {
  /** Offset from the marker's center. */
  dx: number;
  dy: number;
  /** Which side of the marker the text runs from. */
  anchor: 'start' | 'end';
  /** False when nowhere clear was found — the label is dropped rather than stacked. */
  placed: boolean;
}

/**
 * Place city labels around their markers without collisions.
 *
 * Drum corps tours cluster hard in the Midwest: half a dozen stops can land
 * inside a hundred pixels, and naive "draw the name to the right" turns that
 * into a pile of overstruck text. Each label tries the right side of its
 * marker first, then the left, then progressively larger vertical nudges, and
 * takes the first slot that clears every marker AND every label already placed.
 * A label with no clear slot is dropped — the itinerary column still names it,
 * and a missing label beats an illegible one.
 *
 * @param points marker centers, in draw order
 * @param widths rendered width of each label, in poster units
 * @param bounds canvas the labels must stay inside
 * @param markerSize square marker edge length
 */
export function placeLabels(
  points: MapPoint[],
  widths: number[],
  bounds: { width: number; height: number } = MAP_VIEW,
  markerSize = 20
): LabelPlacement[] {
  const half = markerSize / 2;
  const gap = 5;
  const lineHeight = 12;

  // Every marker is an obstacle from the start: a label may never sit on one,
  // including markers whose own label hasn't been placed yet.
  const obstacles: Box[] = points.map((p) => ({
    left: p.x - half - 1,
    top: p.y - half - 1,
    right: p.x + half + 1,
    bottom: p.y + half + 1,
  }));

  // Right side first (reads naturally), then left, then walk outward vertically.
  const candidates: Array<{ dx: number; dy: number; anchor: 'start' | 'end' }> = [];
  for (const dy of [0, -lineHeight, lineHeight, -2 * lineHeight, 2 * lineHeight, -34, 34]) {
    candidates.push({ dx: half + gap, dy, anchor: 'start' });
    candidates.push({ dx: -(half + gap), dy, anchor: 'end' });
  }

  return points.map((point, i) => {
    const width = widths[i] || 0;

    for (const candidate of candidates) {
      const left =
        candidate.anchor === 'start' ? point.x + candidate.dx : point.x + candidate.dx - width;
      const box: Box = {
        left,
        top: point.y + candidate.dy - lineHeight / 2 - 1,
        right: left + width,
        bottom: point.y + candidate.dy + lineHeight / 2 + 1,
      };

      const insideCanvas =
        box.left >= 2 &&
        box.right <= bounds.width - 2 &&
        box.top >= 2 &&
        box.bottom <= bounds.height - 2;
      if (!insideCanvas) continue;
      if (obstacles.some((o) => overlaps(box, o))) continue;

      obstacles.push(box);
      return { ...candidate, placed: true };
    }

    return { dx: 0, dy: 0, anchor: 'start' as const, placed: false };
  });
}
