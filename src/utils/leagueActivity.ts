/**
 * Reading a league's season participation on the client.
 *
 * A league's `members` array is permanent, but participation is not: season
 * rollover preserves each director's corps name, so a roster count says who
 * ever joined, not who is playing. The backend materializes the season-scoped
 * answer onto `seasonActivity` (functions/src/helpers/leagueActivity.js) and
 * zeroes it at rollover; these helpers are the only place the client should
 * interpret that block, so every surface agrees on what "active" means.
 *
 * Leagues written before the block existed have no `seasonActivity` until the
 * nightly refresh backfills them. Those read as dormant with an unknown active
 * count, which is the safe direction: the UI says "not started yet" instead of
 * claiming participation it cannot prove.
 */

import type { League, LeagueSeasonActivity } from '../types';

type LeagueLike = Partial<Pick<League, 'members' | 'seasonActivity'>> & {
  memberCount?: number;
};

/** The raw block, or null when the league predates it. */
export function getSeasonActivity(league: LeagueLike | null | undefined) {
  return (league?.seasonActivity as LeagueSeasonActivity | undefined) ?? null;
}

/** Full roster size — everyone who has joined, playing or not. */
export function getRosterSize(league: LeagueLike | null | undefined): number {
  return league?.members?.length ?? league?.memberCount ?? 0;
}

/**
 * How many members are registered for the current season, or null when the
 * league has no activity block yet (unknown, not zero).
 */
export function getActiveMemberCount(league: LeagueLike | null | undefined): number | null {
  const activity = getSeasonActivity(league);
  return activity ? (activity.activeMemberCount ?? 0) : null;
}

/** Is this specific director registered for the current season? */
export function isMemberActive(
  league: LeagueLike | null | undefined,
  uid: string | undefined
): boolean {
  if (!uid) return false;
  const activity = getSeasonActivity(league);
  return Boolean(activity?.activeMembers?.includes(uid));
}

/**
 * Has nobody set a corps up for this season yet?
 *
 * True for a league whose members have all lapsed AND for one that has not been
 * scored yet — both should read as "the season hasn't started here", never as a
 * populated league.
 */
export function isLeagueDormant(league: LeagueLike | null | undefined): boolean {
  return (getActiveMemberCount(league) ?? 0) === 0;
}

/**
 * Short label for a league card: "3 of 12 playing", or the plain roster count
 * when participation is not yet known.
 */
export function formatActivityLabel(league: LeagueLike | null | undefined): string {
  const roster = getRosterSize(league);
  const active = getActiveMemberCount(league);
  if (active === null) return `${roster} member${roster === 1 ? '' : 's'}`;
  return `${active} of ${roster} playing`;
}
