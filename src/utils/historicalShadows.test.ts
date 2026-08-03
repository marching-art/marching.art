// The seasonal shadow draw (decision 29): the committed pool must hand every
// season a fresh, deduped, band-balanced cast of eight real corps arcs.

import { describe, it, expect } from 'vitest';
import shadowData from '../data/historicalShadows.json';
import { selectSeasonShadows } from './historicalShadows';
import type { ShadowPool } from './historicalShadows';

const data = shadowData as unknown as ShadowPool;
const BANDS = data.meta.bands;
const BAND_COUNT = BANDS.length - 1;

/**
 * A run of real seasonUids — the live season plus the six thematic off-seasons
 * of a game year (helpers/scheduleGeneration.getThematicOffSeasonName) — plus
 * the pre-season fallback, since a corps sees the chart before a season is
 * attached.
 */
const SEASON_UIDS = [
  null,
  'live_2026-27',
  'finale_2026-27',
  'crescendo_2026-27',
  'scherzo_2026-27',
  'adagio_2026-27',
  'allegro_2026-27',
  'overture_2026-27',
  'live_2027-28',
  'finale_2027-28',
];

describe('historical shadow pool', () => {
  it('bands every arc inside 70-98 with a full 49-day trajectory', () => {
    expect(data.pool.length).toBeGreaterThanOrEqual(BAND_COUNT * 4);
    for (const arc of data.pool) {
      expect(arc.totals).toHaveLength(49);
      expect(arc.finals).toBeGreaterThanOrEqual(BANDS[0]);
      expect(arc.finals).toBeLessThan(BANDS[BANDS.length - 1]);
      expect(arc.finals).toBeGreaterThanOrEqual(BANDS[arc.band]);
      expect(arc.finals).toBeLessThan(BANDS[arc.band + 1]);
      expect(arc.year).toBeGreaterThanOrEqual(2000);
      expect(arc.year).toBeLessThanOrEqual(2025);
    }
  });

  it('stocks every band with candidates from both eras', () => {
    for (let band = 0; band < BAND_COUNT; band++) {
      const inBand = data.pool.filter((arc) => arc.band === band);
      expect(inBand.length).toBeGreaterThanOrEqual(4);
      expect(new Set(inBand.map((a) => a.corps)).size).toBe(inBand.length);
      expect(inBand.some((a) => a.year >= 2013)).toBe(true);
      expect(inBand.some((a) => a.year < 2013)).toBe(true);
    }
  });
});

describe('selectSeasonShadows', () => {
  it('draws one arc per band, spread across 70-98', () => {
    for (const uid of SEASON_UIDS) {
      const cast = selectSeasonShadows(uid);
      expect(cast).toHaveLength(BAND_COUNT);
      expect([...cast.map((a) => a.band)].sort((a, b) => a - b)).toEqual(
        Array.from({ length: BAND_COUNT }, (_, i) => i)
      );
      const finals = cast.map((a) => a.finals);
      expect(Math.min(...finals)).toBeLessThan(73.5);
      expect(Math.max(...finals)).toBeGreaterThan(94.5);
      // Sorted highest finals first, which is the order the chart labels in.
      expect([...finals].sort((a, b) => b - a)).toEqual(finals);
    }
  });

  it('never repeats a corps or a year within a season cast', () => {
    for (const uid of SEASON_UIDS) {
      const cast = selectSeasonShadows(uid);
      expect(new Set(cast.map((a) => a.corps)).size).toBe(cast.length);
      expect(new Set(cast.map((a) => a.year)).size).toBe(cast.length);
    }
  });

  it('is deterministic for a seasonUid', () => {
    const once = selectSeasonShadows('crescendo_2026-27');
    const twice = selectSeasonShadows('crescendo_2026-27');
    expect(twice.map((a) => `${a.corps}-${a.year}`)).toEqual(
      once.map((a) => `${a.corps}-${a.year}`)
    );
  });

  it('rotates the cast on a season reset', () => {
    const key = (uid: string | null) =>
      selectSeasonShadows(uid)
        .map((a) => `${a.corps}-${a.year}`)
        .join('|');
    const casts = SEASON_UIDS.map(key);
    // Every season must differ from the one before it, and the run of seasons
    // must not collapse onto two or three repeating casts.
    for (let i = 1; i < casts.length; i++) expect(casts[i]).not.toBe(casts[i - 1]);
    expect(new Set(casts).size).toBe(casts.length);
  });

  it('keeps the DCI shape — the top ghost outranks the bottom by a full tier', () => {
    for (const uid of SEASON_UIDS) {
      const cast = selectSeasonShadows(uid);
      expect(cast[0].finals - cast[cast.length - 1].finals).toBeGreaterThan(20);
    }
  });

  it('falls back to a corps-unique cast when a pool cannot dedupe years', () => {
    const thin: ShadowPool = {
      meta: { bands: [70, 84, 98.5], perBand: 1 },
      pool: [
        { corps: 'Alpha', year: 2011, band: 0, observedDays: 20, finals: 75, totals: [] },
        { corps: 'Beta', year: 2011, band: 1, observedDays: 20, finals: 92, totals: [] },
      ],
    };
    const cast = selectSeasonShadows('finale_2026-27', thin);
    expect(cast.map((a) => a.corps)).toEqual(['Beta', 'Alpha']);
  });

  it('returns nothing for an empty pool rather than throwing', () => {
    expect(selectSeasonShadows('live_2026', { meta: { bands: [], perBand: 0 }, pool: [] })).toEqual(
      []
    );
  });
});
