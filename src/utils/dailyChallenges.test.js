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
  test('returns CHALLENGES_PER_DAY distinct challenges from the pool', () => {
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
      'join-league-pool',
      'check-lineup',
    ]);
  });
});

describe('CHALLENGE_POOL', () => {
  test('every challenge is complete, navigable, and claimable', () => {
    for (const challenge of CHALLENGE_POOL) {
      expect(challenge.id).toBeTruthy();
      expect(challenge.label).toBeTruthy();
      expect(challenge.xp).toBeGreaterThan(0);
      // Every challenge is either a link or an in-dashboard action…
      expect(Boolean(challenge.link) || Boolean(challenge.action)).toBe(true);
      // …and either carries a per-day auto-claim predicate (mirroring the
      // server's verify) or is action-gated — claimed on its row interaction
      // instead of auto-claiming off persistent state (check-lineup).
      const actionGated = !challenge.check;
      expect(typeof challenge.check === 'function' || actionGated).toBe(true);
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

  test('drops join-league-pool for a director with no league', () => {
    const day = findGameDayWith('join-league-pool');
    const ids = getAvailableChallengesForGameDay(day, fantasy).map((c) => c.id);
    expect(ids).not.toContain('join-league-pool');
  });

  test('keeps join-league-pool for a league member', () => {
    const day = findGameDayWith('join-league-pool');
    const member = { corps: { worldClass: { corpsName: 'W' } }, leagueIds: ['L1'] };
    const ids = getAvailableChallengesForGameDay(day, member).map((c) => c.id);
    expect(ids).toContain('join-league-pool');
  });
});

describe('join-league-pool check + availability', () => {
  test('auto-claim fires off today’s entered-pool fact in context', () => {
    const member = { leagueIds: ['L1'] };
    // `check` is optional on the pool type (check-lineup is action-gated), so
    // reach it through optional chaining.
    expect(
      byId('join-league-pool').check?.(member, 'd', { leaguePool: { hasEntered: true } })
    ).toBe(true);
    expect(
      byId('join-league-pool').check?.(member, 'd', { leaguePool: { hasEntered: false } })
    ).toBe(false);
    // No context → not done (the profile alone can't show pool entry).
    expect(byId('join-league-pool').check?.(member, 'd')).toBe(false);
  });

  test('available only to directors in at least one league', () => {
    expect(byId('join-league-pool').available({ leagueIds: ['L1'] })).toBe(true);
    expect(byId('join-league-pool').available({ leagueIds: [] })).toBe(false);
    expect(byId('join-league-pool').available({})).toBe(false);
  });

  test('available predicates mirror the server exactly', async () => {
    const server = await import('../../functions/src/helpers/dailyChallenges.js');
    const droppable = CHALLENGE_POOL.filter((c) => c.available)
      .map((c) => c.id)
      .sort();
    const serverDroppable = server.CHALLENGE_POOL.filter((c) => c.available)
      .map((c) => c.id)
      .sort();
    expect(droppable).toEqual(serverDroppable);
  });
});
