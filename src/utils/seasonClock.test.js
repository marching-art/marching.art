// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
import { describe, it, expect } from 'vitest';
import {
  getNextScoresProcessingTime,
  getShowRegistrationDeadline,
  getCaptionChangeInfo,
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

describe('getCaptionChangeInfo', () => {
  // Season starting at UTC midnight, the shape the admin UI writes.
  // Day boundaries land at 8 PM EDT: day 1 = June 21, day 14 ends
  // 2026-07-05T00:00:00Z = Saturday July 4, 8:00 PM EDT.
  const start = new Date('2026-06-21T00:00:00Z');
  const season = (springTrainingDays) => ({
    status: 'off-season',
    schedule: {
      startDate: { toDate: () => start }, // Firestore Timestamp shape
      ...(springTrainingDays ? { springTrainingDays } : {}),
    },
  });
  const info = (nowIso, springDays) => getCaptionChangeInfo(season(springDays), new Date(nowIso));

  it('is unlimited on days 1-14, ending at the day-14 boundary (Sat 8 PM ET)', () => {
    const w = info('2026-06-23T12:00:00Z'); // day 3
    expect(w.phase).toBe('unlimited');
    expect(w.status).toBe('open');
    expect(w.tradeLimit).toBe(Infinity);
    expect(w.unlimitedEndsAt.toISOString()).toBe('2026-07-05T00:00:00.000Z');
    // Weekly limits become usable after day 15 begins + the 2 AM ET run
    expect(w.resetsAt.toISOString()).toBe('2026-07-05T06:00:00.000Z');
    expect(w.nextLimit).toBe(3);
  });

  it('locks on Saturday night even during the unlimited weeks', () => {
    // Day 8 begins 2026-06-28T00:00:00Z (Sat June 27, 8 PM EDT); 9 PM EDT:
    const w = info('2026-06-28T01:00:00Z');
    expect(w.day).toBe(8);
    expect(w.status).toBe('locked');
    expect(w.reopensAt.toISOString()).toBe('2026-06-28T06:00:00.000Z'); // 2 AM EDT

    // After 2 AM ET it reopens, still unlimited
    const reopened = info('2026-06-28T07:00:00Z');
    expect(reopened.status).toBe('open');
    expect(reopened.phase).toBe('unlimited');
  });

  it('allows 3 changes per week on days 15-42', () => {
    const w = info('2026-07-06T12:00:00Z'); // day 16, week 3
    expect(w.phase).toBe('weekly');
    expect(w.status).toBe('open');
    expect(w.week).toBe(3);
    expect(w.tradeLimit).toBe(3);
    // Locks at the Saturday 8 PM ET boundary ending week 3 (day 21)
    expect(w.locksAt.toISOString()).toBe('2026-07-12T00:00:00.000Z');
    // Fresh allotment once week 4 opens after the 2 AM ET run
    expect(w.resetsAt.toISOString()).toBe('2026-07-12T06:00:00.000Z');
  });

  it('locks week-start days until the 2 AM ET score run', () => {
    // Day 22 begins 2026-07-12T00:00:00Z (Sat 8 PM EDT); 9 PM EDT:
    const w = info('2026-07-12T01:00:00Z');
    expect(w.day).toBe(22);
    expect(w.status).toBe('locked');
    expect(w.reopensAt.toISOString()).toBe('2026-07-12T06:00:00.000Z');
  });

  it('closes changes entirely on days 43-44', () => {
    const w = info('2026-08-02T12:00:00Z'); // day 43
    expect(w.phase).toBe('blackout');
    expect(w.status).toBe('closed');
    expect(w.tradeLimit).toBe(0);
    // Championship changes open after day 45 begins + the 2 AM ET run
    expect(w.reopensAt.toISOString()).toBe('2026-08-04T06:00:00.000Z');
    expect(w.nextLimit).toBe(2);
  });

  it('gives 2 changes per day during championships with nightly 8 PM ET locks', () => {
    // Day 45 begins 2026-08-04T00:00:00Z (Mon 8 PM EDT). Before 2 AM ET: locked.
    const locked = info('2026-08-04T01:00:00Z');
    expect(locked.phase).toBe('championship');
    expect(locked.status).toBe('locked');
    expect(locked.reopensAt.toISOString()).toBe('2026-08-04T06:00:00.000Z');

    // Tuesday afternoon: open with the championship limit, closing at the
    // next day boundary (8 PM ET). periodKey is the day, so it resets nightly.
    const open = info('2026-08-04T18:00:00Z');
    expect(open.status).toBe('open');
    expect(open.tradeLimit).toBe(2);
    expect(open.week).toBe(7);
    expect(open.periodKey).toBe(45);
    expect(open.locksAt.toISOString()).toBe('2026-08-05T00:00:00.000Z');
    // The next day keys on a new period (fresh 2 changes).
    expect(info('2026-08-05T18:00:00Z').periodKey).toBe(46);
  });

  it('gates championship changes by the per-day competing-class bracket', () => {
    const infoClass = (nowIso, corpsClass) =>
      getCaptionChangeInfo(season(), new Date(nowIso), corpsClass);

    // Days 45-46: only Open Class and A Class compete.
    expect(infoClass('2026-08-04T18:00:00Z', 'openClass').status).toBe('open');
    expect(infoClass('2026-08-04T18:00:00Z', 'worldClass').status).toBe('closed');
    expect(infoClass('2026-08-04T18:00:00Z', 'worldClass').tradeLimit).toBe(0);

    // Day 47: all classes compete.
    expect(infoClass('2026-08-06T18:00:00Z', 'worldClass').status).toBe('open');
    expect(infoClass('2026-08-06T18:00:00Z', 'aClass').status).toBe('open');

    // Days 48-49 (Finals): only World Class and SoundSport compete.
    expect(infoClass('2026-08-07T18:00:00Z', 'worldClass').status).toBe('open');
    expect(infoClass('2026-08-07T18:00:00Z', 'soundSport').status).toBe('open');
    expect(infoClass('2026-08-07T18:00:00Z', 'openClass').status).toBe('closed');
    expect(infoClass('2026-08-08T18:00:00Z', 'aClass').status).toBe('closed');

    // Class-agnostic call reports the general open window.
    expect(info('2026-08-07T18:00:00Z').status).toBe('open');
  });

  it('closes after the season ends', () => {
    const w = info('2026-08-09T12:00:00Z'); // day 50
    expect(w.phase).toBe('complete');
    expect(w.status).toBe('closed');
    expect(w.tradeLimit).toBe(0);
  });

  it('excludes spring-training days before competition day 1', () => {
    // 21 spring-training days: 10 calendar days in is still pre-competition
    const w = info('2026-07-01T00:00:00Z', 21);
    expect(w.phase).toBe('unlimited');
    expect(w.status).toBe('open');
    // Unlimited ends at start + (21 + 14) days
    expect(w.unlimitedEndsAt.toISOString()).toBe('2026-07-26T00:00:00.000Z');
  });

  it('returns null without a start date', () => {
    expect(getCaptionChangeInfo({ schedule: {} })).toBeNull();
    expect(getCaptionChangeInfo(null)).toBeNull();
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
