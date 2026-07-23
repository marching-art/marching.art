import { describe, it, expect } from 'vitest';
import {
  getSoundSportRating,
  seededShuffle,
  getCaptionBreakdown,
  mergeTwoNightShows,
  computeRankDeltas,
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
    const { SOUNDSPORT_RATING_THRESHOLDS, getSoundSportRating: dashboardRating } =
      await import('../components/Dashboard/sections/constants');
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

describe('mergeTwoNightShows', () => {
  const show = (
    offSeasonDay: number,
    scores: object[],
    eventName = 'marching.art Eastern Classic'
  ) => ({
    eventName,
    location: 'Allentown, PA',
    date: offSeasonDay === 41 ? '8/1/2026' : '8/2/2026',
    offSeasonDay,
    scores: scores as never[],
  });

  const row = (corpsName: string, corpsClass: string, score: number) => ({
    corpsName,
    corpsClass,
    score,
    totalScore: score,
  });

  it('returns null until BOTH nights have scored', () => {
    expect(mergeTwoNightShows([])).toBeNull();
    expect(mergeTwoNightShows([show(41, [row('Solo', 'worldClass', 80)])])).toBeNull();
    // Different event names on the two days are not a two-night event.
    expect(
      mergeTwoNightShows([
        show(41, [row('A', 'worldClass', 80)]),
        show(42, [row('B', 'worldClass', 81)], 'Some Other Show'),
      ])
    ).toBeNull();
  });

  it('merges both nights, tags each row, groups per class, ranks by score', () => {
    const combined = mergeTwoNightShows([
      show(41, [row('Friday World', 'worldClass', 82.1), row('Friday A', 'aClass', 60)]),
      show(42, [row('Saturday World', 'worldClass', 84.3), row('Saturday Open', 'openClass', 71)]),
    ]);
    expect(combined).not.toBeNull();
    expect(combined!.eventName).toBe('marching.art Eastern Classic');
    expect(combined!.dateRange).toBe('8/1/2026 – 8/2/2026');
    expect(combined!.sections.map((s) => s.corpsClass)).toEqual([
      'worldClass',
      'openClass',
      'aClass',
    ]);
    const world = combined!.sections[0];
    // Saturday's higher score leads the combined class standings.
    expect(world.rows.map((r) => [r.corpsName, r.night])).toEqual([
      ['Saturday World', 2],
      ['Friday World', 1],
    ]);
  });

  it('excludes SoundSport rows (ratings-only, never placed)', () => {
    const combined = mergeTwoNightShows([
      show(41, [row('W', 'worldClass', 80), row('SS Friday', 'soundSport', 88)]),
      show(42, [row('W2', 'worldClass', 79), row('SS Saturday', 'soundSport', 90)]),
    ]);
    expect(combined!.sections).toHaveLength(1);
    expect(combined!.sections[0].rows.every((r) => r.corpsClass === 'worldClass')).toBe(true);
  });
});

describe('computeRankDeltas', () => {
  // Two shows each: scores[0] latest, scores[1] previous. Current rank is by
  // the latest score; previous rank is by the previous score.
  const entry = (uid: string, rank: number, latest: number, prev: number) => ({
    uid,
    corpsName: uid,
    rank,
    score: latest,
    scores: [{ score: latest }, { score: prev }],
  });

  it('reports placements gained (+) and lost (-) since the previous show', () => {
    // Previous standings by prev score: a(90) b(88) c(86) d(84) -> 1,2,3,4.
    // Latest jumps d to the top: d(95) a(91) b(89) c(87) -> ranks 1..4.
    const standings = [
      entry('d', 1, 95, 84),
      entry('a', 2, 91, 90),
      entry('b', 3, 89, 88),
      entry('c', 4, 87, 86),
    ];
    const deltas = computeRankDeltas(standings);
    expect(deltas.get('d')).toBe(3); // 4th -> 1st, up 3
    expect(deltas.get('a')).toBe(-1); // 1st -> 2nd, down 1
    expect(deltas.get('b')).toBe(-1);
    expect(deltas.get('c')).toBe(-1);
  });

  it('returns null for a corps with only one show (no prior standing)', () => {
    const deltas = computeRankDeltas([
      { uid: 'a', corpsName: 'a', rank: 1, score: 90, scores: [{ score: 90 }] },
      { uid: 'b', corpsName: 'b', rank: 2, score: 80, scores: [{ score: 80 }, { score: 79 }] },
    ]);
    expect(deltas.get('a')).toBeNull();
    expect(deltas.get('b')).toBe(0);
  });

  it('is empty for empty input', () => {
    expect(computeRankDeltas([]).size).toBe(0);
  });
});
