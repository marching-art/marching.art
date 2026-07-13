import { describe, it, expect } from 'vitest';

import {
  SUPPORTER_TIERS,
  getSupporterTier,
  supporterTierRank,
  tierFromMonthlyAmount,
} from './supporterTiers';

// Guards the client mirror against drift from the server tier floors
// (functions/src/helpers/bmacSupporters.js). If these change, change both.
describe('supporterTiers', () => {
  it('has the four tiers at the expected monthly floors', () => {
    expect(SUPPORTER_TIERS.map((t) => [t.id, t.minAmount])).toEqual([
      ['rookie', 3],
      ['veteran', 6],
      ['staff', 12],
      ['corps_angel', 25],
    ]);
  });

  it('maps amounts to the highest cleared tier', () => {
    expect(tierFromMonthlyAmount(3)).toBe('rookie');
    expect(tierFromMonthlyAmount(5.99)).toBe('rookie');
    expect(tierFromMonthlyAmount(6)).toBe('veteran');
    expect(tierFromMonthlyAmount(12)).toBe('staff');
    expect(tierFromMonthlyAmount(25)).toBe('corps_angel');
    expect(tierFromMonthlyAmount(2.99)).toBeNull();
    expect(tierFromMonthlyAmount(0)).toBeNull();
  });

  it('resolves tier metadata and rank by id', () => {
    expect(getSupporterTier('veteran')?.name).toBe('Veteran');
    expect(getSupporterTier('nope')).toBeNull();
    expect(supporterTierRank('corps_angel')).toBe(3);
    expect(supporterTierRank('rookie')).toBe(0);
    expect(supporterTierRank(null)).toBe(-1);
  });
});
