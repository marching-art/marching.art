import { describe, it, expect } from 'vitest';
import {
  getSoundSportRating,
  seededShuffle,
  getCaptionBreakdown,
  mergeTwoNightShows,
  computeRankDeltas,
  computeAdvancement,
  advancementKey,
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

describe('computeAdvancement', () => {
  // Mirrors the recap rows the Scores page holds: uid + class + total.
  const corps = (uid: string, corpsClass: string, score: number) => ({
    uid,
    corpsName: uid,
    corpsClass,
    score,
    totalScore: score,
  });

  // n corps of one class, descending from `top` in 0.1 steps.
  const field = (corpsClass: string, n: number, top: number, prefix = corpsClass) =>
    Array.from({ length: n }, (_, i) => corps(`${prefix}-${i + 1}`, corpsClass, top - i * 0.1));

  const advancingNames = (result: ReturnType<typeof computeAdvancement>) =>
    [...(result?.advancing ?? [])].map((key) => key.split('_')[0]);

  it('returns null on nights that decide nothing', () => {
    const scores = field('worldClass', 20, 90);
    for (const day of [1, 41, 44, 46, 49]) {
      expect(computeAdvancement(scores, day)).toBeNull();
    }
    expect(computeAdvancement(scores, null)).toBeNull();
    expect(computeAdvancement([], 47)).toBeNull();
  });

  it('cuts day 45 per class — top 8 Open, top 4 A', () => {
    const result = computeAdvancement(
      [...field('openClass', 12, 80), ...field('aClass', 9, 75)],
      45
    )!;
    expect(result.perClass).toBe(true);
    expect(result.advancesToDay).toBe(46);
    expect(result.advancingCount).toBe(12); // 8 Open + 4 A
    expect(result.fieldCount).toBe(21);
    expect(result.missedCount).toBe(9);
    // Open Class 9th and A Class 5th are out; the classes are cut separately,
    // so an A Class corps never loses a slot to a higher-scoring Open corps.
    expect(result.advancing.has(advancementKey(corps('openClass-8', 'openClass', 0)))).toBe(true);
    expect(result.advancing.has(advancementKey(corps('openClass-9', 'openClass', 0)))).toBe(false);
    expect(result.advancing.has(advancementKey(corps('aClass-4', 'aClass', 0)))).toBe(true);
    expect(result.advancing.has(advancementKey(corps('aClass-5', 'aClass', 0)))).toBe(false);
    // Cut line is the lowest advancing score across both classes (A Class 4th).
    expect(result.cutLine).toBeCloseTo(74.7, 5);
  });

  it('ignores World Class rows on day 45 (not competing for a slot)', () => {
    const result = computeAdvancement(
      [...field('worldClass', 10, 95), ...field('openClass', 3, 80), ...field('aClass', 2, 75)],
      45
    )!;
    expect(result.advancingCount).toBe(5);
    expect(result.fieldCount).toBe(5);
    expect(result.missedCount).toBe(0);
    expect(advancingNames(result).some((name) => name.startsWith('worldClass'))).toBe(false);
  });

  it('cuts day 47 to the top 25 across all three classes', () => {
    const result = computeAdvancement(
      [...field('worldClass', 20, 95), ...field('openClass', 10, 85), ...field('aClass', 10, 80)],
      47
    )!;
    expect(result.perClass).toBe(false);
    expect(result.advancesToDay).toBe(48);
    expect(result.advancingCount).toBe(25);
    expect(result.fieldCount).toBe(40);
    expect(result.missedCount).toBe(15);
    // Ranked across classes: all 20 World, then the top 5 Open.
    expect(result.advancing.has(advancementKey(corps('openClass-5', 'openClass', 0)))).toBe(true);
    expect(result.advancing.has(advancementKey(corps('openClass-6', 'openClass', 0)))).toBe(false);
    expect(result.cutLine).toBeCloseTo(84.6, 5);
  });

  it('advances everyone tied on the cut line (matching the scorer)', () => {
    const tied = [
      ...field('worldClass', 24, 95),
      corps('tie-a', 'worldClass', 70),
      corps('tie-b', 'worldClass', 70),
      corps('tie-c', 'worldClass', 70),
      corps('below', 'worldClass', 69.9),
    ];
    const result = computeAdvancement(tied, 47)!;
    // 24 clear qualifiers plus all three corps sharing 25th place.
    expect(result.advancingCount).toBe(27);
    expect(advancingNames(result)).toEqual(expect.arrayContaining(['tie-a', 'tie-b', 'tie-c']));
    expect(result.advancing.has(advancementKey(corps('below', 'worldClass', 0)))).toBe(false);
    expect(result.cutLine).toBe(70);
  });

  it('cuts day 48 to the top 12 for Finals', () => {
    const result = computeAdvancement(field('worldClass', 25, 95), 48)!;
    expect(result.advancesToDay).toBe(49);
    expect(result.advancingCount).toBe(12);
    expect(result.missedCount).toBe(13);
    expect(result.advancing.has(advancementKey(corps('worldClass-13', 'worldClass', 0)))).toBe(
      false
    );
  });

  it('advances the whole field when it is smaller than the cut', () => {
    const result = computeAdvancement(field('worldClass', 8, 90), 48)!;
    expect(result.advancingCount).toBe(8);
    expect(result.missedCount).toBe(0);
  });

  it('never advances SoundSport (ratings-only, no championship bracket)', () => {
    const result = computeAdvancement(
      [...field('worldClass', 3, 90), corps('ss', 'soundSport', 99)],
      47
    )!;
    expect(result.fieldCount).toBe(3);
    expect(advancingNames(result)).not.toContain('ss');
  });

  it('keys by uid AND class so one director can field two corps', () => {
    const rows = [
      { uid: 'u1', corpsName: 'World Corps', corpsClass: 'worldClass', score: 95 },
      { uid: 'u1', corpsName: 'A Corps', corpsClass: 'aClass', score: 60 },
    ];
    const result = computeAdvancement([...rows, ...field('worldClass', 24, 90)], 48)!;
    expect(result.advancing.has(advancementKey(rows[0]))).toBe(true);
    expect(result.advancing.has(advancementKey(rows[1]))).toBe(false);
  });
});
