import { describe, it, expect } from 'vitest';
import { getSeasonProgress } from './seasonProgress';

// Off-season starts are written at midnight UTC (scheduleGeneration.js), so the
// canonical day count normalizes the start on the UTC calendar.
const OFFSEASON = { schedule: { startDate: new Date('2026-01-04T00:00:00Z') } };

// Helper: an explicit ET wall-clock instant. January is EST (UTC-05:00).
const etWinter = (iso: string) => new Date(`${iso}-05:00`);

describe('getSeasonProgress', () => {
  it('returns 0/0 before a start date exists', () => {
    expect(getSeasonProgress(null)).toEqual({ currentDay: 0, currentWeek: 0 });
    expect(getSeasonProgress({ schedule: {} })).toEqual({ currentDay: 0, currentWeek: 0 });
  });

  it('accepts a Firestore Timestamp-like value (toDate())', () => {
    const ts = { toDate: () => new Date('2026-01-04T00:00:00Z') };
    const { currentDay } = getSeasonProgress(
      { schedule: { startDate: ts } },
      etWinter('2026-01-04T07:00:00')
    );
    expect(currentDay).toBe(1);
  });

  it('is day 1 on the season start date', () => {
    expect(getSeasonProgress(OFFSEASON, etWinter('2026-01-04T07:00:00')).currentDay).toBe(1);
  });

  // The core fix: the day must roll over at the backend's 2 AM ET game-day
  // reset — not at midnight UTC (8 PM ET summer / 7 PM ET winter), which the
  // old raw-millisecond math used. At 8 PM ET the old code already showed the
  // next day; the fantasy scores for that day don't post until 2 AM ET.
  it('does NOT advance the day at 8 PM ET (the old midnight-UTC boundary)', () => {
    expect(getSeasonProgress(OFFSEASON, etWinter('2026-01-04T20:00:00')).currentDay).toBe(1);
  });

  it('does NOT advance the day between midnight and 2 AM ET', () => {
    expect(getSeasonProgress(OFFSEASON, etWinter('2026-01-05T01:00:00')).currentDay).toBe(1);
  });

  it('advances the day just after the 2 AM ET reset', () => {
    expect(getSeasonProgress(OFFSEASON, etWinter('2026-01-05T02:05:00')).currentDay).toBe(2);
  });

  it('computes the week from the (1-based) competition day', () => {
    // Active day 8 -> week 2.
    expect(getSeasonProgress(OFFSEASON, etWinter('2026-01-11T10:00:00'))).toEqual({
      currentDay: 8,
      currentWeek: 2,
    });
  });

  it('clamps the day to [1, 49] and the week to [1, 7]', () => {
    // Well before the season: clamped up to day 1.
    expect(getSeasonProgress(OFFSEASON, etWinter('2025-12-01T12:00:00'))).toEqual({
      currentDay: 1,
      currentWeek: 1,
    });
    // Long after day 49: clamped down.
    expect(getSeasonProgress(OFFSEASON, etWinter('2026-06-01T12:00:00'))).toEqual({
      currentDay: 49,
      currentWeek: 7,
    });
  });

  it('subtracts the live-season spring-training offset', () => {
    const live = {
      schedule: { startDate: new Date('2026-01-04T00:00:00Z'), springTrainingDays: 21 },
    };
    // Calendar day 22 (Jan 25) maps to competition day 1.
    expect(getSeasonProgress(live, etWinter('2026-01-25T12:00:00'))).toEqual({
      currentDay: 1,
      currentWeek: 1,
    });
  });

  it('counts consecutive days across the spring-forward DST transition', () => {
    // DST 2026 springs forward Mar 8 02:00 ET. Start Mar 1 (EST, midnight UTC).
    const march = { schedule: { startDate: new Date('2026-03-01T00:00:00Z') } };
    // Mar 7 is EST (-05:00); Mar 8 and Mar 9 are EDT (-04:00).
    const day7 = getSeasonProgress(march, new Date('2026-03-07T12:00:00-05:00')).currentDay;
    const day8 = getSeasonProgress(march, new Date('2026-03-08T12:00:00-04:00')).currentDay;
    const day9 = getSeasonProgress(march, new Date('2026-03-09T12:00:00-04:00')).currentDay;
    // Exactly one day per ET calendar day — no skipped or duplicated day.
    expect(day8).toBe(day7 + 1);
    expect(day9).toBe(day8 + 1);
  });
});
