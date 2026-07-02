// Tests for the daily-challenge helpers that back profileStore's
// completeDailyChallenge — the client half of the daily game loop.
import { describe, test, expect, vi, afterEach } from 'vitest';
import { getGameDay, pruneOldChallenges, CHALLENGE_DEFINITIONS } from './dailyChallenges';

describe('getGameDay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('returns a date string', () => {
    const day = getGameDay();
    expect(typeof day).toBe('string');
    expect(new Date(day).toString()).not.toBe('Invalid Date');
  });

  test('rolls over to the previous day before 2 AM Eastern', () => {
    // 05:30 UTC in January is 00:30 EST — before the 2 AM boundary, so the
    // game day is still Jan 14th.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T05:30:00Z'));
    expect(getGameDay()).toBe(new Date('2026-01-14T12:00:00Z').toDateString());
  });

  test('uses the current day after 2 AM Eastern', () => {
    // 12:00 UTC in January is 07:00 EST — past the boundary.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    expect(getGameDay()).toBe(new Date('2026-01-15T12:00:00Z').toDateString());
  });

  test('handles daylight saving time (EDT is UTC-4)', () => {
    // 05:30 UTC in July is 01:30 EDT — still the previous game day…
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T05:30:00Z'));
    expect(getGameDay()).toBe(new Date('2026-07-14T12:00:00Z').toDateString());

    // …while 06:30 UTC is 02:30 EDT — past the boundary.
    vi.setSystemTime(new Date('2026-07-15T06:30:00Z'));
    expect(getGameDay()).toBe(new Date('2026-07-15T12:00:00Z').toDateString());
  });
});

describe('pruneOldChallenges', () => {
  const makeChallenges = (count, startDay = 1) => {
    const out = {};
    for (let i = 0; i < count; i++) {
      const d = new Date(2026, 0, startDay + i);
      out[d.toDateString()] = [{ id: `c${i}` }];
    }
    return out;
  };

  test('passes through non-objects unchanged', () => {
    expect(pruneOldChallenges(null)).toBe(null);
    expect(pruneOldChallenges(undefined)).toBe(undefined);
    expect(pruneOldChallenges('nope')).toBe('nope');
  });

  test('keeps 30 or fewer day-buckets untouched', () => {
    const challenges = makeChallenges(30);
    expect(pruneOldChallenges(challenges)).toBe(challenges);
  });

  test('keeps only the most recent 30 of 45 day-buckets', () => {
    const challenges = makeChallenges(45);
    const pruned = pruneOldChallenges(challenges);
    const keys = Object.keys(pruned);

    expect(keys).toHaveLength(30);
    // Oldest 15 dropped, newest kept
    expect(pruned[new Date(2026, 0, 1).toDateString()]).toBeUndefined();
    expect(pruned[new Date(2026, 0, 15).toDateString()]).toBeUndefined();
    expect(pruned[new Date(2026, 0, 16).toDateString()]).toBeDefined();
    expect(pruned[new Date(2026, 0, 45).toDateString()]).toBeDefined();
  });
});

describe('CHALLENGE_DEFINITIONS', () => {
  test('every definition is complete and self-consistent', () => {
    for (const [key, def] of Object.entries(CHALLENGE_DEFINITIONS)) {
      expect(def.id).toBe(key);
      expect(def.title).toBeTruthy();
      expect(def.target).toBeGreaterThan(0);
      expect(def.progress).toBe(def.target); // created pre-completed
      expect(def.completed).toBe(true);
    }
  });
});
