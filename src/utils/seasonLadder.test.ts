import { describe, it, expect } from 'vitest';
import { TIERS, getSeasonXP, getClaimableLadderTiers } from './seasonLadder';

describe('getSeasonXP', () => {
  it('measures XP earned since the season baseline was stamped', () => {
    expect(getSeasonXP({ xp: 1000, xpAtSeasonStart: 400 })).toBe(600);
  });

  it('reads zero before a rollover has stamped a baseline', () => {
    // Crediting lifetime XP here would hand a returning director every tier
    // at once on the first day of their first tracked season.
    expect(getSeasonXP({ xp: 5000 })).toBe(0);
    expect(getSeasonXP(null)).toBe(0);
  });

  it('never goes negative when XP is spent below the baseline', () => {
    expect(getSeasonXP({ xp: 100, xpAtSeasonStart: 400 })).toBe(0);
  });
});

describe('getClaimableLadderTiers', () => {
  it('returns every earned, unclaimed tier lowest first', () => {
    const tiers = getClaimableLadderTiers(
      { xp: 1500, xpAtSeasonStart: 0, seasonLadder: { seasonUid: 's1', claimed: [1] } },
      's1'
    );
    // 450/900/1500 are earned at 1500 XP; tier 1 is already claimed.
    expect(tiers.map((t) => t.tier)).toEqual([2, 3]);
  });

  it('ignores a claimed list left over from a previous season', () => {
    const tiers = getClaimableLadderTiers(
      { xp: 450, xpAtSeasonStart: 0, seasonLadder: { seasonUid: 'last-season', claimed: [1, 2] } },
      's2'
    );
    expect(tiers.map((t) => t.tier)).toEqual([1]);
  });

  it('returns nothing when no tier has been reached', () => {
    expect(
      getClaimableLadderTiers({ xp: 100, xpAtSeasonStart: 0, seasonLadder: null }, 's1')
    ).toEqual([]);
  });

  it('tolerates a missing profile', () => {
    expect(getClaimableLadderTiers(null, 's1')).toEqual([]);
  });

  it('keeps the tier table in ascending XP order', () => {
    // The Director's Report and the Next Action hero both present TIERS[0] as
    // "the next one to claim", which only reads correctly while sorted.
    const xp = TIERS.map((t) => t.xp);
    expect([...xp].sort((a, b) => a - b)).toEqual(xp);
  });
});
