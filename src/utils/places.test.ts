import { describe, it, expect, beforeAll } from 'vitest';
import {
  exactPlaceMatches,
  foldPlaceText,
  loadPlaces,
  nearestPlace,
  relocationFeeBetween,
  searchPlaces,
  type HomePlace,
} from './places';

let places: HomePlace[] = [];
beforeAll(async () => {
  places = await loadPlaces();
});

const labels = (rows: HomePlace[]) => rows.map((p) => p.label);

describe('place index', () => {
  it('carries the tour-map cities (with venueIds) plus thousands of other towns', () => {
    const tour = places.filter((p) => p.venueId);
    expect(tour.length).toBeGreaterThan(400);
    expect(places.length - tour.length).toBeGreaterThan(15000);
    for (const p of places.slice(0, 50)) {
      expect(p.label).toBe(`${p.city}, ${p.region}`);
      expect(Number.isFinite(p.lat) && Number.isFinite(p.lng)).toBe(true);
    }
  });

  it('memoizes the load', async () => {
    expect(await loadPlaces()).toBe(places);
  });
});

describe('foldPlaceText', () => {
  it('folds accents, punctuation and Saint/Mount/Fort spellings together', () => {
    expect(foldPlaceText('Española')).toBe('espanola');
    expect(foldPlaceText('St. Marys')).toBe(foldPlaceText('Saint Marys'));
    expect(foldPlaceText('Mt. Prospect')).toBe(foldPlaceText('Mount Prospect'));
    expect(foldPlaceText('Fort Wayne')).toBe(foldPlaceText('Ft. Wayne'));
  });
});

describe('searchPlaces', () => {
  it('finds small hometowns that are not show cities', () => {
    const [first] = searchPlaces(places, 'Brownsburg, IN');
    expect(first?.label).toBe('Brownsburg, IN');
    expect(first?.venueId).toBeNull();
  });

  it('narrows by state code or state name, with or without a comma', () => {
    for (const q of ['Canton, OH', 'canton oh', 'Canton, Ohio', 'canton ohio']) {
      expect(searchPlaces(places, q)[0]?.label).toBe('Canton, OH');
    }
    expect(searchPlaces(places, 'springfield, mo').every((p) => p.region === 'MO')).toBe(true);
  });

  it('ranks exact names over prefixes over inner words', () => {
    const rows = searchPlaces(places, 'prairie', 200);
    const exactIdx = rows.findIndex((p) => p.key === 'prairie');
    const innerIdx = rows.findIndex((p) => p.key === 'sun prairie');
    expect(innerIdx).toBeGreaterThan(-1);
    if (exactIdx > -1) expect(exactIdx).toBeLessThan(innerIdx);
  });

  it('matches across Saint/St and accent spellings', () => {
    expect(labels(searchPlaces(places, 'saint marys, pa'))).toContain(
      searchPlaces(places, 'st marys, pa')[0]?.label
    );
    expect(searchPlaces(places, 'espanola nm')[0]?.city).toBe('Española');
  });

  it('respects the limit and returns nothing for nonsense', () => {
    expect(searchPlaces(places, 'a', 10)).toHaveLength(10);
    expect(searchPlaces(places, 'zzqxv')).toEqual([]);
  });
});

describe('nearestPlace', () => {
  it('snaps a GPS fix to the closest town', () => {
    // Downtown Allentown, PA.
    expect(nearestPlace(places, 40.6023, -75.4714)?.label).toBe('Allentown, PA');
    expect(nearestPlace([], 40, -75)).toBeNull();
    expect(nearestPlace(places, Number.NaN, 0)).toBeNull();
  });
});

describe('relocationFeeBetween — client preview of the home-move sink', () => {
  const dallas = { lat: 32.7767, lng: -96.797 };
  const atlanta = { lat: 33.749, lng: -84.388 };

  it('is free for the same spot or a missing endpoint', () => {
    expect(relocationFeeBetween(dallas, dallas)).toEqual({ miles: 0, fee: 0 });
    expect(relocationFeeBetween(null, dallas)).toEqual({ miles: 0, fee: 0 });
    expect(relocationFeeBetween(dallas, undefined)).toEqual({ miles: 0, fee: 0 });
    // Coordinate rounding between two copies of one town is not a move.
    expect(relocationFeeBetween(dallas, { lat: 32.78, lng: -96.8 })).toEqual({ miles: 0, fee: 0 });
  });

  it('charges 1 CorpsCoin per 2 miles by default, matching the server rate', () => {
    const { miles, fee } = relocationFeeBetween(dallas, atlanta, 2);
    expect(miles).toBeGreaterThan(600);
    expect(miles).toBeLessThan(850);
    expect(Math.abs(fee - miles / 2)).toBeLessThanOrEqual(1);
    expect(relocationFeeBetween(dallas, atlanta, 5).fee).toBeLessThan(fee);
    expect(relocationFeeBetween(dallas, atlanta)).toEqual({ miles, fee });
  });
});

describe('exactPlaceMatches', () => {
  it('adopts a fully spelled legacy hometown, never a guess', () => {
    expect(labels(exactPlaceMatches(places, 'Brownsburg, Indiana'))).toEqual(['Brownsburg, IN']);
    expect(exactPlaceMatches(places, 'Brownsburg')).toEqual([]);
    expect(exactPlaceMatches(places, 'Browns, IN')).toEqual([]);
  });
});
