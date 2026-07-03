import { describe, it, expect } from 'vitest';
import {
  getNextScoresProcessingTime,
  getShowRegistrationDeadline,
  getTradeWeekInfo,
  formatCountdown,
  formatEtShort,
} from './seasonClock';

// All expectations are expressed as UTC instants for fixed ET wall times:
// July (EDT) is UTC-4, January (EST) is UTC-5.

describe('getNextScoresProcessingTime', () => {
  it('returns tonight 2 AM ET when it is still evening in ET', () => {
    // 10 PM ET July 3 = 02:00 UTC July 4
    const now = new Date('2026-07-04T02:00:00Z');
    // Next 2 AM ET = July 4 02:00 EDT = 06:00 UTC
    expect(getNextScoresProcessingTime(now).toISOString()).toBe('2026-07-04T06:00:00.000Z');
  });

  it('rolls to the next day once 2 AM ET has passed', () => {
    // 2:30 AM ET July 4 = 06:30 UTC
    const now = new Date('2026-07-04T06:30:00Z');
    expect(getNextScoresProcessingTime(now).toISOString()).toBe('2026-07-05T06:00:00.000Z');
  });

  it('handles the EST (winter) offset', () => {
    // 1 AM ET Jan 10 = 06:00 UTC; next run is 2 AM EST = 07:00 UTC same day
    const now = new Date('2026-01-10T06:00:00Z');
    expect(getNextScoresProcessingTime(now).toISOString()).toBe('2026-01-10T07:00:00.000Z');
  });

  it('falls forward to 3 AM EDT on the spring-forward day when 2 AM does not exist', () => {
    // DST starts 2026-03-08 in the US: 2 AM EST jumps to 3 AM EDT.
    const now = new Date('2026-03-08T01:00:00-05:00'); // 1 AM EST that morning
    expect(getNextScoresProcessingTime(now).toISOString()).toBe('2026-03-08T07:00:00.000Z'); // 3 AM EDT
  });
});

describe('getShowRegistrationDeadline', () => {
  it('is 2 AM ET the day after the show', () => {
    const eventDate = new Date(2026, 6, 10); // July 10, local midnight
    // Deadline: July 11 02:00 EDT = 06:00 UTC
    expect(getShowRegistrationDeadline(eventDate).toISOString()).toBe('2026-07-11T06:00:00.000Z');
  });

  it('returns null for missing dates', () => {
    expect(getShowRegistrationDeadline(null)).toBeNull();
    expect(getShowRegistrationDeadline(new Date('nonsense'))).toBeNull();
  });
});

describe('getTradeWeekInfo', () => {
  // Season starting at UTC midnight, the shape the admin UI writes.
  const start = new Date('2026-06-21T00:00:00Z');
  const season = (status, springTrainingDays) => ({
    status,
    schedule: {
      startDate: { toDate: () => start }, // Firestore Timestamp shape
      ...(springTrainingDays ? { springTrainingDays } : {}),
    },
  });

  it('computes the week with raw millisecond math like the backend', () => {
    // Day 3 of the season
    const now = new Date('2026-06-23T12:00:00Z');
    const info = getTradeWeekInfo(season('off-season'), now);
    expect(info.week).toBe(1);
    // Week 1 counter resets exactly 7 days after start
    expect(info.resetsAt.toISOString()).toBe('2026-06-28T00:00:00.000Z');
  });

  it('is unlimited only in week 1 of an off-season', () => {
    const week1 = getTradeWeekInfo(season('off-season'), new Date('2026-06-22T00:00:00Z'));
    expect(week1.isUnlimitedWeek).toBe(true);
    expect(week1.unlimitedEndsAt.toISOString()).toBe('2026-06-28T00:00:00.000Z');

    const week2 = getTradeWeekInfo(season('off-season'), new Date('2026-06-29T00:00:00Z'));
    expect(week2.week).toBe(2);
    expect(week2.isUnlimitedWeek).toBe(false);
  });

  it('is unlimited through week 3 of a live season', () => {
    const week3 = getTradeWeekInfo(season('live-season'), new Date('2026-07-06T00:00:00Z'));
    expect(week3.week).toBe(3);
    expect(week3.isUnlimitedWeek).toBe(true);
    expect(week3.unlimitedEndsAt.toISOString()).toBe('2026-07-12T00:00:00.000Z');

    const week4 = getTradeWeekInfo(season('live-season'), new Date('2026-07-13T00:00:00Z'));
    expect(week4.week).toBe(4);
    expect(week4.isUnlimitedWeek).toBe(false);
  });

  it('excludes spring-training days before competition day 1', () => {
    // 14 spring-training days: 10 days in, competition hasn't reached week 2
    const now = new Date('2026-07-01T00:00:00Z');
    const info = getTradeWeekInfo(season('live-season', 14), now);
    expect(info.week).toBe(1);
    // Week 1 resets at start + (7 + 14) days
    expect(info.resetsAt.toISOString()).toBe('2026-07-12T00:00:00.000Z');
  });

  it('has no further reset in the final week', () => {
    // Day 44 → week 7
    const now = new Date('2026-08-04T00:00:00Z');
    const info = getTradeWeekInfo(season('off-season'), now);
    expect(info.week).toBe(7);
    expect(info.resetsAt).toBeNull();
  });

  it('returns null without a start date', () => {
    expect(getTradeWeekInfo({ schedule: {} })).toBeNull();
    expect(getTradeWeekInfo(null)).toBeNull();
  });
});

describe('formatCountdown', () => {
  it('formats days, hours, and minutes at the right granularity', () => {
    expect(formatCountdown(2 * 24 * 3600e3 + 4 * 3600e3)).toBe('2d 4h');
    expect(formatCountdown(6 * 3600e3 + 12 * 60e3)).toBe('6h 12m');
    expect(formatCountdown(45 * 60e3)).toBe('45m');
    expect(formatCountdown(0)).toBe('now');
    expect(formatCountdown(-5)).toBe('now');
  });
});

describe('formatEtShort', () => {
  it('renders the instant as ET wall time', () => {
    // 2026-06-28T00:00:00Z = Sat 8:00 PM EDT June 27
    expect(formatEtShort(new Date('2026-06-28T00:00:00Z'))).toBe('Sat 8:00 PM ET');
    expect(formatEtShort(null)).toBe('');
  });
});
