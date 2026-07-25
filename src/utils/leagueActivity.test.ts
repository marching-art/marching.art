import { describe, it, expect } from 'vitest';

import {
  getRosterSize,
  getActiveMemberCount,
  isMemberActive,
  isLeagueDormant,
  formatActivityLabel,
} from './leagueActivity';

// The distinction these pin down: a league's roster is permanent, but
// participation is season-scoped. Reading `members.length` as "how alive is
// this league" is what made a league with twelve lapsed directors advertise
// itself as well populated.
const league = (activeMembers: string[] | null, roster = ['a', 'b', 'c']) => ({
  members: roster,
  ...(activeMembers
    ? {
        seasonActivity: {
          seasonUid: 'season-2',
          activeMembers,
          activeMemberCount: activeMembers.length,
          totalMemberCount: roster.length,
          updatedAt: null as never,
        },
      }
    : {}),
});

describe('getRosterSize', () => {
  it('counts everyone who has joined, playing or not', () => {
    expect(getRosterSize(league([], ['a', 'b', 'c']))).toBe(3);
  });

  it('falls back to a denormalized memberCount, then to zero', () => {
    expect(getRosterSize({ memberCount: 7 })).toBe(7);
    expect(getRosterSize(null)).toBe(0);
  });
});

describe('getActiveMemberCount', () => {
  it('reports how many members are registered for the season', () => {
    expect(getActiveMemberCount(league(['a', 'b']))).toBe(2);
  });

  it('distinguishes "nobody is playing" from "we do not know yet"', () => {
    // A league the backend has scored: genuinely empty.
    expect(getActiveMemberCount(league([]))).toBe(0);
    // A league predating the activity block: unknown, and must not be
    // reported as zero by any caller that cares about the difference.
    expect(getActiveMemberCount(league(null))).toBeNull();
  });
});

describe('isMemberActive', () => {
  it('is true only for directors in the active set', () => {
    const l = league(['a']);
    expect(isMemberActive(l, 'a')).toBe(true);
    expect(isMemberActive(l, 'b')).toBe(false);
  });

  it('is false without an activity block or a uid', () => {
    expect(isMemberActive(league(null), 'a')).toBe(false);
    expect(isMemberActive(league(['a']), undefined)).toBe(false);
  });
});

describe('isLeagueDormant', () => {
  it('treats both an empty and an unscored league as not started', () => {
    expect(isLeagueDormant(league([]))).toBe(true);
    expect(isLeagueDormant(league(null))).toBe(true);
  });

  it('is false as soon as one director registers', () => {
    expect(isLeagueDormant(league(['a']))).toBe(false);
  });
});

describe('formatActivityLabel', () => {
  it('leads with participation, not roster size', () => {
    expect(formatActivityLabel(league(['a', 'b'], ['a', 'b', 'c']))).toBe('2 of 3 playing');
    expect(formatActivityLabel(league([], ['a', 'b', 'c']))).toBe('0 of 3 playing');
  });

  it('falls back to a plain member count when participation is unknown', () => {
    expect(formatActivityLabel(league(null, ['a', 'b']))).toBe('2 members');
    expect(formatActivityLabel(league(null, ['a']))).toBe('1 member');
  });
});
