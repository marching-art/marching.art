// Tests for the daily-challenge helpers that back the dashboard widget and
// profileStore's completeDailyChallenge — the client half of the daily game
// loop. The rotation is mirrored server-side in
// functions/src/helpers/dailyChallenges.js; the pinned fixed-date
// expectations here are IDENTICAL to that file's tests to catch drift.
import { describe, test, expect, vi, afterEach } from 'vitest';
import {
  getGameDay,
  getChallengesForGameDay,
  getAvailableChallengesForGameDay,
  CHALLENGE_POOL,
  CHALLENGES_PER_DAY,
} from './dailyChallenges';

/**
 * A game day whose real rotation offers a given challenge id.
 * @param {string} id
 */
const findGameDayWith = (id) => {
  const anchor = new Date('2026-07-01T12:00:00Z');
  for (let i = 0; i < 60; i++) {
    const day = getGameDay(new Date(anchor.getTime() + i * 86400000));
    if (getChallengesForGameDay(day).some((c) => c.id === id)) return day;
  }
  throw new Error(`No game day offers ${id}`);
};
/** @param {string} id */
const byId = (id) => {
  const challenge = CHALLENGE_POOL.find((c) => c.id === id);
  if (!challenge) throw new Error(`No challenge ${id}`);
  return challenge;
};

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

describe('getAvailableChallengesForGameDay (Podium-aware required set)', () => {
  const fantasy = { corps: { worldClass: { corpsName: 'W' } } };
  const podiumOnly = { corps: { podiumClass: { corpsName: 'P' } } };

  test('drops check-lineup for a Podium-only director', () => {
    const day = findGameDayWith('check-lineup');
    const ids = getAvailableChallengesForGameDay(day, podiumOnly).map((c) => c.id);
    expect(ids).not.toContain('check-lineup');
  });

  test('keeps check-lineup for a fantasy director', () => {
    const day = findGameDayWith('check-lineup');
    const ids = getAvailableChallengesForGameDay(day, fantasy).map((c) => c.id);
    expect(ids).toContain('check-lineup');
  });

  test('drops make-prediction when predictions are unavailable', () => {
    const day = findGameDayWith('make-prediction');
    const ids = getAvailableChallengesForGameDay(day, fantasy, {
      predictionAvailable: false,
    }).map((c) => c.id);
    expect(ids).not.toContain('make-prediction');
  });

  test('never drops register-show or set-show-concept', () => {
    for (const id of ['register-show', 'set-show-concept']) {
      const day = findGameDayWith(id);
      expect(getAvailableChallengesForGameDay(day, podiumOnly).map((c) => c.id)).toContain(id);
    }
  });
});

describe('challenge checks with Podium context', () => {
  const podiumOnly = { corps: { podiumClass: { corpsName: 'P' } } };

  test('register-show auto-claim fires off Podium show picks', () => {
    // Before the fix, a Podium director could never auto-claim this — their
    // picks live in the subcollection, invisible to the profile.
    expect(byId('register-show').check(podiumOnly, 'd', { podium: { hasShows: true } })).toBe(true);
    expect(byId('register-show').check(podiumOnly, 'd', { podium: { hasShows: false } })).toBe(
      false
    );
    expect(byId('register-show').check(podiumOnly, 'd')).toBe(false);
  });

  test('set-show-concept auto-claim fires off the Podium concept', () => {
    expect(byId('set-show-concept').check(podiumOnly, 'd', { podium: { hasConcept: true } })).toBe(
      true
    );
    expect(byId('set-show-concept').check(podiumOnly, 'd', { podium: { hasConcept: false } })).toBe(
      false
    );
  });

  test('fantasy checks are unchanged by the context argument', () => {
    const fantasy = {
      corps: { worldClass: { selectedShows: { 1: ['s'] }, showConcept: { theme: 'T' } } },
    };
    expect(byId('register-show').check(fantasy, 'd')).toBe(true);
    expect(byId('set-show-concept').check(fantasy, 'd')).toBe(true);
  });

  test('available predicates mirror the server exactly', async () => {
    const server = await import('../../functions/src/helpers/dailyChallenges.js');
    // check-lineup and make-prediction are the two droppable ones on both sides.
    const droppable = CHALLENGE_POOL.filter((c) => c.available)
      .map((c) => c.id)
      .sort();
    const serverDroppable = server.CHALLENGE_POOL.filter((c) => c.available)
      .map((c) => c.id)
      .sort();
    expect(droppable).toEqual(serverDroppable);
  });
});
