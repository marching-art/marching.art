import { describe, it, expect } from 'vitest';
import {
  getSoundSportRating,
  seededShuffle,
  getCaptionBreakdown,
  RATING_CONFIG,
} from './scoresUtils';

describe('getSoundSportRating', () => {
  it('maps scores to medal tiers with correct thresholds', () => {
    expect(getSoundSportRating(90)).toBe('Gold');
    expect(getSoundSportRating(85)).toBe('Gold'); // boundary
    expect(getSoundSportRating(84.9)).toBe('Silver');
    expect(getSoundSportRating(75)).toBe('Silver'); // boundary
    expect(getSoundSportRating(70)).toBe('Bronze');
    expect(getSoundSportRating(65)).toBe('Bronze'); // boundary
    expect(getSoundSportRating(64.9)).toBe('Participation');
    expect(getSoundSportRating(0)).toBe('Participation');
  });

  it('every rating has a style config', () => {
    for (const rating of ['Gold', 'Silver', 'Bronze', 'Participation'] as const) {
      expect(RATING_CONFIG[rating]).toBeTruthy();
    }
  });
});

describe('seededShuffle', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];

  it('is deterministic for the same seed', () => {
    expect(seededShuffle(input, 'Finals 2026')).toEqual(seededShuffle(input, 'Finals 2026'));
  });

  it('generally produces different orders for different seeds', () => {
    const a = seededShuffle(input, 'seed-a');
    const b = seededShuffle(input, 'seed-b');
    expect(a).not.toEqual(b);
  });

  it('is a permutation of the input (same elements)', () => {
    const out = seededShuffle(input, 'x');
    expect([...out].sort((a, b) => a - b)).toEqual([...input].sort((a, b) => a - b));
  });

  it('does not mutate the input array', () => {
    const copy = [...input];
    seededShuffle(input, 'x');
    expect(input).toEqual(copy);
  });
});

describe('getCaptionBreakdown', () => {
  it('returns real values when all three scores are present', () => {
    expect(getCaptionBreakdown({ geScore: 30, visualScore: 25, musicScore: 20 })).toEqual({
      ge: 30,
      vis: 25,
      mus: 20,
    });
  });

  it('returns nulls when data is missing or partial', () => {
    expect(getCaptionBreakdown()).toEqual({ ge: null, vis: null, mus: null });
    expect(getCaptionBreakdown({ geScore: 30 })).toEqual({ ge: null, vis: null, mus: null });
    expect(getCaptionBreakdown({ geScore: 30, visualScore: 25 })).toEqual({
      ge: null,
      vis: null,
      mus: null,
    });
  });
});
