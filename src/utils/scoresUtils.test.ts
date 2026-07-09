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

  it('agrees with the dashboard threshold table (the copies once diverged)', async () => {
    const { SOUNDSPORT_RATING_THRESHOLDS, getSoundSportRating: dashboardRating } = await import(
      '../components/Dashboard/sections/constants'
    );
    // Same tier at every boundary and between-boundary score
    for (const score of [0, 64.9, 65, 74.9, 75, 84.9, 85, 90, 100]) {
      expect(dashboardRating(score).rating).toBe(getSoundSportRating(score));
    }
    // And the raw thresholds match the canonical function's cutoffs
    const mins = Object.fromEntries(
      SOUNDSPORT_RATING_THRESHOLDS.map((t: { rating: string; min: number }) => [t.rating, t.min])
    );
    expect(mins).toEqual({ Gold: 85, Silver: 75, Bronze: 65, Participation: 0 });
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

  it('does not systematically park the first element at the bottom', () => {
    // SoundSport scores arrive sorted descending, so the best-in-show entry is
    // at index 0. A biased shuffle used to reliably drop index 0 into the last
    // slot for even-sized groups, making best-in-show always appear last.
    // Guard against that by checking the landing position is well distributed.
    for (const n of [4, 6, 8]) {
      const seq = Array.from({ length: n }, (_, i) => n - i); // n..1, top = index 0
      const positions = Array.from({ length: n }, () => 0);
      const trials = 500;
      for (let s = 0; s < trials; s++) {
        const out = seededShuffle(seq, `Event ${s} SoundSport Showcase ${s * 7}`);
        positions[out.indexOf(n)]++;
      }
      // With no bias each position gets ~trials/n. The old bug put >90% in the
      // last slot; assert the last slot stays well under a third.
      expect(positions[n - 1] / trials).toBeLessThan(0.33);
    }
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
