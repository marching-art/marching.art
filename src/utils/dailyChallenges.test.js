// Tests for the daily-challenge helpers that back the dashboard widget and
// profileStore's completeDailyChallenge — the client half of the daily game
// loop. The rotation is mirrored server-side in
// functions/src/helpers/dailyChallenges.js; the pinned fixed-date
// expectations here are IDENTICAL to that file's tests to catch drift.
import { describe, test, expect, vi, afterEach } from 'vitest';
import {
  getGameDay,
  getChallengesForGameDay,
  CHALLENGE_POOL,
  CHALLENGES_PER_DAY,
} from './dailyChallenges';

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

describe('getChallengesForGameDay', () => {
  test('returns three distinct challenges from the pool', () => {
    const picks = getChallengesForGameDay('Sat Jul 04 2026');
    expect(picks).toHaveLength(CHALLENGES_PER_DAY);
    expect(new Set(picks.map((c) => c.id)).size).toBe(CHALLENGES_PER_DAY);
    for (const pick of picks) {
      expect(CHALLENGE_POOL.some((c) => c.id === pick.id)).toBe(true);
    }
  });

  test('is deterministic for the same day', () => {
    expect(getChallengesForGameDay('Sat Jul 04 2026')).toEqual(
      getChallengesForGameDay('Sat Jul 04 2026')
    );
  });

  test('rotates across days', () => {
    const days = ['Sat Jul 04 2026', 'Sun Jul 05 2026', 'Mon Jul 06 2026', 'Tue Jul 07 2026'];
    const signatures = days.map((d) =>
      getChallengesForGameDay(d)
        .map((c) => c.id)
        .join(',')
    );
    expect(new Set(signatures).size).toBeGreaterThanOrEqual(2);
  });

  test('pinned rotation matches the server mirror (sync check)', () => {
    // Same expectation exists in functions/src/helpers/dailyChallenges.test.js
    expect(getChallengesForGameDay('Wed Jan 14 2026').map((c) => c.id)).toEqual([
      'check-lineup',
      'make-prediction',
      'register-show',
    ]);
  });
});

describe('CHALLENGE_POOL', () => {
  test('every challenge is complete, navigable, and checkable', () => {
    for (const challenge of CHALLENGE_POOL) {
      expect(challenge.id).toBeTruthy();
      expect(challenge.label).toBeTruthy();
      expect(challenge.xp).toBeGreaterThan(0);
      // Every challenge is either a link or an in-dashboard action…
      expect(Boolean(challenge.link) || Boolean(challenge.action)).toBe(true);
      // …and carries the client-side auto-claim predicate mirroring the
      // server's verify (decisions, not clicks)
      expect(typeof challenge.check).toBe('function');
    }
    expect(new Set(CHALLENGE_POOL.map((c) => c.id)).size).toBe(CHALLENGE_POOL.length);
  });

  test('ids match the server pool (mirror check)', async () => {
    const server = await import('../../functions/src/helpers/dailyChallenges.js');
    expect(CHALLENGE_POOL.map((c) => c.id).sort()).toEqual(
      server.CHALLENGE_POOL.map((c) => c.id).sort()
    );
  });
});
