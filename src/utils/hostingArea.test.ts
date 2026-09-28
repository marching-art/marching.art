import { describe, expect, it } from 'vitest';
import geo from '../data/tourMapGeo.json';
import { HOSTING_MAP_SIZE, HOSTING_PROJECTION, isHostableArea } from './hostingArea';
import { projectLatLng } from './tourMap';

describe('hostingArea', () => {
  it('uses the Tour Map poster projection', () => {
    const { parallels, rotateLng, scale, translate } = geo.meta.projection;
    expect(HOSTING_PROJECTION).toEqual({ parallels, rotateLng, scale, translate });
    expect(HOSTING_MAP_SIZE).toEqual({ width: geo.meta.width, height: geo.meta.height });
  });

  it('agrees with the poster projection on where a pin lands', () => {
    // Winnipeg sits near the top edge; Halifax just past the right edge.
    const winnipeg = projectLatLng(-97.14, 49.9);
    expect(winnipeg.y).toBeGreaterThan(8);
    expect(isHostableArea({ region: 'MB', lat: 49.9, lng: -97.14 })).toBe(true);
    const halifax = projectLatLng(-63.57, 44.65);
    expect(halifax.x).toBeGreaterThan(geo.meta.width);
    expect(isHostableArea({ region: 'NS', lat: 44.65, lng: -63.57 })).toBe(false);
  });

  it('keeps the lower 48 and southern Canada, drops AK/HI and the far north', () => {
    expect(isHostableArea({ region: 'FL', lat: 24.56, lng: -81.78 })).toBe(true); // Key West
    expect(isHostableArea({ region: 'WA', lat: 48.75, lng: -122.48 })).toBe(true); // Bellingham
    expect(isHostableArea({ region: 'ON', lat: 43.65, lng: -79.38 })).toBe(true); // Toronto
    expect(isHostableArea({ region: 'QC', lat: 46.81, lng: -71.21 })).toBe(true); // Québec City
    expect(isHostableArea({ region: 'AK', lat: 61.22, lng: -149.9 })).toBe(false);
    expect(isHostableArea({ region: 'HI', lat: 21.31, lng: -157.86 })).toBe(false);
    expect(isHostableArea({ region: 'AB', lat: 53.55, lng: -113.49 })).toBe(false); // Edmonton
    expect(isHostableArea({ region: 'NLE', lat: 25.68, lng: -100.32 })).toBe(true); // Monterrey
    expect(isHostableArea({ region: 'TAM', lat: 22.25, lng: -97.86 })).toBe(false); // Tampico
    expect(isHostableArea(null)).toBe(false);
    expect(isHostableArea({ region: 'OH' })).toBe(false);
  });
});
