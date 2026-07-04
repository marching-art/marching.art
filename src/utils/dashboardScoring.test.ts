import { describe, it, expect } from 'vitest';
import {
  getEffectiveDay,
  processCategoryTotals,
  processCaptionScores,
  getNextSelectedShow,
  type ScoreEvent,
} from './dashboardScoring';

// A small helper to build score events.
function event(
  day: number,
  corpsCaptions: Record<string, Record<string, number>>,
  name = 'Show'
): ScoreEvent {
  return {
    offSeasonDay: day,
    eventName: name,
    scores: Object.entries(corpsCaptions).map(([corps, captions]) => ({ corps, captions })),
  };
}

describe('getEffectiveDay', () => {
  it('returns currentDay - 1 at/after 2 AM', () => {
    const at3am = new Date(2026, 0, 1, 3, 0, 0);
    expect(getEffectiveDay(10, at3am)).toBe(9);
  });

  it('returns currentDay - 2 before 2 AM', () => {
    const at1am = new Date(2026, 0, 1, 1, 0, 0);
    expect(getEffectiveDay(10, at1am)).toBe(8);
  });

  it('returns null when no scores are available yet', () => {
    const at1am = new Date(2026, 0, 1, 1, 0, 0);
    expect(getEffectiveDay(2, at1am)).toBeNull(); // 2 - 2 = 0 -> null
    const at3am = new Date(2026, 0, 1, 3, 0, 0);
    expect(getEffectiveDay(1, at3am)).toBeNull(); // 1 - 1 = 0 -> null
  });
});

describe('processCategoryTotals', () => {
  const data: ScoreEvent[] = [
    event(1, { 'Blue Devils': { GE1: 9, GE2: 9, VP: 6, VA: 6, CG: 6, B: 6, MA: 6, P: 6 } }),
    event(2, { 'Blue Devils': { GE1: 10, GE2: 10, VP: 7, VA: 7, CG: 7, B: 7, MA: 7, P: 7 } }),
    event(3, { 'Blue Devils': { GE1: 11, GE2: 11, VP: 8, VA: 8, CG: 8, B: 8, MA: 8, P: 8 } }),
  ];

  it('returns nulls when effectiveDay is null', () => {
    expect(processCategoryTotals(data, 'Blue Devils', null)).toEqual({
      geTotal: null,
      visTotal: null,
      musTotal: null,
    });
  });

  it('sums categories from the most recent processed day', () => {
    // effectiveDay 2 -> latest is day 2 (day 3 excluded)
    const result = processCategoryTotals(data, 'Blue Devils', 2);
    expect(result.geTotal).toBe(20); // 10 + 10
    expect(result.visTotal).toBe(21); // 7 * 3
    expect(result.musTotal).toBe(21); // 7 * 3
  });

  it('computes trends vs the previous scored day', () => {
    const result = processCategoryTotals(data, 'Blue Devils', 2);
    // day 2 (20/21/21) vs day 1 (18/18/18)
    expect(result.geTrend).toEqual({ direction: 'up', delta: '+2.00' });
    expect(result.visTrend).toEqual({ direction: 'up', delta: '+3.00' });
    expect(result.musTrend).toEqual({ direction: 'up', delta: '+3.00' });
  });

  it('omits trends when only one day of data exists', () => {
    const result = processCategoryTotals(data, 'Blue Devils', 1);
    expect(result.geTotal).toBe(18);
    // Single day -> no comparison possible, trends stay null (as the original did).
    expect(result.geTrend ?? null).toBeNull();
  });

  it('returns nulls when the corps has no scores', () => {
    expect(processCategoryTotals(data, 'Nonexistent', 3)).toEqual({
      geTotal: null,
      visTotal: null,
      musTotal: null,
    });
  });
});

describe('processCaptionScores', () => {
  const data: ScoreEvent[] = [
    event(1, { 'Blue Devils': { GE1: 18.0 } }, 'Opener'),
    event(2, { 'Blue Devils': { GE1: 18.5 } }, 'Regional'),
    event(3, { 'Blue Devils': { GE1: 19.2 } }, 'Finals'),
  ];

  it('returns the latest caption score and an upward trend', () => {
    const result = processCaptionScores(data, 'Blue Devils', 'GE1', 2);
    expect(result.score).toBe(18.5);
    expect(result.trend).toEqual({ direction: 'up', delta: '+0.50' });
    // next show is the first event beyond the effective day (day 3)
    expect(result.nextShow).toEqual({ day: 3, location: 'Finals' });
  });

  it('reports a downward trend', () => {
    const declining: ScoreEvent[] = [
      event(1, { X: { GE1: 19.0 } }),
      event(2, { X: { GE1: 18.0 } }),
    ];
    const result = processCaptionScores(declining, 'X', 'GE1', 2);
    expect(result.score).toBe(18.0);
    expect(result.trend).toEqual({ direction: 'down', delta: '-1.00' });
  });

  it('ignores zero scores', () => {
    const withZero: ScoreEvent[] = [event(1, { X: { GE1: 0 } })];
    const result = processCaptionScores(withZero, 'X', 'GE1', 1);
    expect(result.score).toBeNull();
    expect(result.trend).toBeNull();
  });

  it('surfaces the first upcoming show when no scores are processed yet', () => {
    const result = processCaptionScores(data, 'Blue Devils', 'GE1', null);
    expect(result.score).toBeNull();
    expect(result.trend).toBeNull();
    expect(result.nextShow).toEqual({ day: 1, location: 'Opener' });
  });

  it('returns no trend with only a single scored day', () => {
    const result = processCaptionScores(data, 'Blue Devils', 'GE1', 1);
    expect(result.score).toBe(18.0);
    expect(result.trend).toBeNull();
  });
});

describe('getNextSelectedShow', () => {
  const selectedShows = {
    week2: [
      { day: 14, eventName: 'CrownBEAT', location: 'Fort Mill, SC' },
      { day: 12, eventName: 'Southeastern Championship', location: 'Atlanta, GA' },
    ],
    week3: [{ day: 18, eventName: 'Gold Showcase', location: 'Denver, CO' }],
  };

  it('returns the soonest show on or after the current day', () => {
    // Current day 13 -> day 12 is past, day 14 is next.
    expect(getNextSelectedShow(selectedShows, 13)).toEqual({
      day: 14,
      eventName: 'CrownBEAT',
      location: 'Fort Mill, SC',
    });
  });

  it("treats a show on the current day as still upcoming (it hasn't scored yet)", () => {
    expect(getNextSelectedShow(selectedShows, 14)).toEqual({
      day: 14,
      eventName: 'CrownBEAT',
      location: 'Fort Mill, SC',
    });
  });

  it('crosses week boundaries to find the next show', () => {
    expect(getNextSelectedShow(selectedShows, 15)).toEqual({
      day: 18,
      eventName: 'Gold Showcase',
      location: 'Denver, CO',
    });
  });

  it('returns null once every registered show is in the past', () => {
    expect(getNextSelectedShow(selectedShows, 20)).toBeNull();
  });

  it('returns the earliest show when the current day is unknown', () => {
    expect(getNextSelectedShow(selectedShows, null)).toEqual({
      day: 12,
      eventName: 'Southeastern Championship',
      location: 'Atlanta, GA',
    });
  });

  it('is the same corps-level result regardless of which caption is asked', () => {
    // The whole lineup competes together, so there is no per-caption variance.
    const result = getNextSelectedShow(selectedShows, 13);
    expect(getNextSelectedShow(selectedShows, 13)).toEqual(result);
  });

  it('handles missing, empty, and undated selections gracefully', () => {
    expect(getNextSelectedShow(null, 5)).toBeNull();
    expect(getNextSelectedShow(undefined, 5)).toBeNull();
    expect(getNextSelectedShow({}, 5)).toBeNull();
    expect(getNextSelectedShow({ week1: [{ eventName: 'No day field' }] }, 5)).toBeNull();
  });

  it('falls back to name/TBD and empty location when fields are absent', () => {
    expect(getNextSelectedShow({ week1: [{ day: 3, name: 'Legacy Name' }] }, 1)).toEqual({
      day: 3,
      eventName: 'Legacy Name',
      location: '',
    });
    expect(getNextSelectedShow({ week1: [{ day: 3 }] }, 1)).toEqual({
      day: 3,
      eventName: 'TBD',
      location: '',
    });
  });
});
