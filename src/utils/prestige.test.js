// Mirror-equality tests: the client prestige catalog must match the backend
// catalog the callables actually charge against (same pattern as
// progressionGuide.test.js — the backend helper is dependency-free CJS).
import { describe, it, expect } from 'vitest';

import {
  PLAQUE_TIERS,
  HALL_BANNER_PRICE,
  HALL_BANNER_MAX_LENGTH,
  availablePlaqueUpgrades,
} from './prestige';

import {
  PLAQUE_TIERS as SERVER_PLAQUE_TIERS,
  HALL_BANNER_PRICE as SERVER_HALL_BANNER_PRICE,
  HALL_BANNER_MAX_LENGTH as SERVER_HALL_BANNER_MAX_LENGTH,
} from '../../functions/src/helpers/prestigeCatalog.js';

describe('prestige catalog mirrors the backend', () => {
  it('plaque tiers match exactly (ids, ranks, prices, names)', () => {
    expect(PLAQUE_TIERS).toEqual(SERVER_PLAQUE_TIERS);
  });

  it('Hall banner price and length cap match', () => {
    expect(HALL_BANNER_PRICE).toBe(SERVER_HALL_BANNER_PRICE);
    expect(HALL_BANNER_MAX_LENGTH).toBe(SERVER_HALL_BANNER_MAX_LENGTH);
  });
});

describe('availablePlaqueUpgrades', () => {
  it('offers every tier for an unplaqued corps', () => {
    expect(availablePlaqueUpgrades({}).map((t) => t.id)).toEqual(['bronze', 'silver', 'gold']);
  });

  it('offers only strictly finer tiers once a plaque hangs', () => {
    const entry = { plaque: { tier: 'silver' } };
    expect(availablePlaqueUpgrades(entry).map((t) => t.id)).toEqual(['gold']);
  });

  it('offers nothing beyond gold', () => {
    expect(availablePlaqueUpgrades({ plaque: { tier: 'gold' } })).toEqual([]);
  });
});
