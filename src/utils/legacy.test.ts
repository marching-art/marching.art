// Mirror-equality tests: the client Legacy catalog must match the backend
// catalog the makeLegacyEndowment callable actually charges against (same
// pattern as prestige.test.js — the backend helper is dependency-free CJS).
//
// A drift here is not cosmetic: the shop would quote one price and the server
// would charge another.
import { describe, it, expect } from 'vitest';

import {
  ENDOWMENT_TIERS,
  LEGACY_TITLES,
  DEDICATION_MAX_LENGTH,
  ENDOWMENT_BLURBS,
  endowmentTiersInOrder,
  highestLegacyTitle,
  nextLegacyTitle,
  legacyBandProgress,
  legacyTotal,
  legacyCount,
  legacyEntries,
  canAfford,
} from './legacy';

import {
  ENDOWMENT_TIERS as SERVER_ENDOWMENT_TIERS,
  LEGACY_TITLES as SERVER_LEGACY_TITLES,
  DEDICATION_MAX_LENGTH as SERVER_DEDICATION_MAX_LENGTH,
} from '../../functions/src/helpers/legacyCatalog.js';

describe('legacy catalog mirrors the backend', () => {
  it('endowment tiers match exactly (ids, ranks, prices, names)', () => {
    expect(ENDOWMENT_TIERS).toEqual(SERVER_ENDOWMENT_TIERS);
  });

  it('milestone titles match exactly (thresholds, ids, names)', () => {
    expect(LEGACY_TITLES).toEqual(SERVER_LEGACY_TITLES);
  });

  it('the dedication length cap matches', () => {
    expect(DEDICATION_MAX_LENGTH).toBe(SERVER_DEDICATION_MAX_LENGTH);
  });

  it('has display copy for every tier', () => {
    for (const id of Object.keys(ENDOWMENT_TIERS)) {
      expect(ENDOWMENT_BLURBS[id], `blurb for ${id}`).toBeTruthy();
    }
  });
});

describe('endowmentTiersInOrder', () => {
  it('sorts cheapest first and carries the id', () => {
    const tiers = endowmentTiersInOrder();
    expect(tiers.map((t) => t.id)).toEqual([
      'music_library',
      'instrument_fund',
      'tour_fund',
      'scholarship',
      'facility',
    ]);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].price).toBeGreaterThan(tiers[i - 1].price);
    }
  });
});

describe('highestLegacyTitle', () => {
  it('returns the top title reached', () => {
    expect(highestLegacyTitle(5000)?.name).toBe('Patron');
    expect(highestLegacyTitle(24999)?.name).toBe('Patron');
    expect(highestLegacyTitle(250000)?.name).toBe('Cornerstone');
    expect(highestLegacyTitle(5000000)?.name).toBe('Founding Legacy');
  });

  it('returns null below the first threshold and for junk', () => {
    expect(highestLegacyTitle(0)).toBeNull();
    expect(highestLegacyTitle(4999)).toBeNull();
    expect(highestLegacyTitle(null)).toBeNull();
    expect(highestLegacyTitle(undefined)).toBeNull();
    expect(highestLegacyTitle(Number.NaN)).toBeNull();
  });
});

describe('nextLegacyTitle', () => {
  it('reports the next milestone and the gap', () => {
    expect(nextLegacyTitle(0)).toMatchObject({ name: 'Patron', remaining: 5000 });
    expect(nextLegacyTitle(5000)).toMatchObject({ name: 'Benefactor', remaining: 20000 });
    expect(nextLegacyTitle(249999)).toMatchObject({ name: 'Cornerstone', remaining: 1 });
  });

  it('returns null once topped out', () => {
    expect(nextLegacyTitle(1000000)).toBeNull();
    expect(nextLegacyTitle(2000000)).toBeNull();
  });
});

describe('legacyBandProgress', () => {
  it('measures progress across the current band, not from zero', () => {
    // From zero, 249,999 would read as ~25% toward Cornerstone — i.e. "no
    // progress" — when the director is in fact one coin away.
    expect(legacyBandProgress(249999)).toBeGreaterThan(0.99);
    // Halfway from Patron (5,000) to Benefactor (25,000) is 15,000.
    expect(legacyBandProgress(15000)).toBeCloseTo(0.5, 5);
  });

  it('is 0 at a fresh start and 1 past the top', () => {
    expect(legacyBandProgress(0)).toBe(0);
    expect(legacyBandProgress(1000000)).toBe(1);
    expect(legacyBandProgress(9999999)).toBe(1);
  });

  it('is 0 exactly at a threshold, where the next band begins', () => {
    expect(legacyBandProgress(5000)).toBe(0);
    expect(legacyBandProgress(25000)).toBe(0);
  });

  it('never returns a value outside 0..1', () => {
    for (const total of [-500, 0, 1, 4999, 5000, 999999, 1000000, 50000000]) {
      const progress = legacyBandProgress(total);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    }
  });
});

describe('profile readers', () => {
  const profile = {
    legacy: {
      total: 30000,
      count: 3,
      entries: [{ tierId: 'tour_fund', amount: 25000 }, { tierId: 'music_library' }],
    },
  };

  it('read the totals and entries', () => {
    expect(legacyTotal(profile)).toBe(30000);
    expect(legacyCount(profile)).toBe(3);
    expect(legacyEntries(profile)).toHaveLength(2);
  });

  it('return safe defaults for a director who has never endowed', () => {
    expect(legacyTotal({})).toBe(0);
    expect(legacyCount({})).toBe(0);
    expect(legacyEntries({})).toEqual([]);
  });

  it('tolerate null, undefined and corrupt fields', () => {
    for (const bad of [null, undefined, {}, { legacy: null }, { legacy: {} }]) {
      expect(legacyTotal(bad)).toBe(0);
      expect(legacyCount(bad)).toBe(0);
      expect(legacyEntries(bad)).toEqual([]);
    }
    // Wrong types on a real field must not crash the profile page.
    const corrupt = { legacy: { total: 'lots', count: {}, entries: 'nope' } };
    expect(legacyTotal(corrupt)).toBe(0);
    expect(legacyCount(corrupt)).toBe(0);
    expect(legacyEntries(corrupt)).toEqual([]);
  });
});

describe('canAfford', () => {
  it('compares the balance against the tier price', () => {
    expect(canAfford(5000, 'music_library')).toBe(true);
    expect(canAfford(4999, 'music_library')).toBe(false);
    expect(canAfford(100000, 'facility')).toBe(true);
  });

  it('is false for an unknown tier or a missing balance', () => {
    expect(canAfford(999999, 'not_a_tier')).toBe(false);
    expect(canAfford(null, 'music_library')).toBe(false);
    expect(canAfford(undefined, 'music_library')).toBe(false);
  });
});
