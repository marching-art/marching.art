// Season reward ladder tier table.
//
// Mirrors functions/src/helpers/seasonLadder.js LADDER_TIERS — keep in sync.
// Lives in utils (not alongside the panel that renders it) because three
// separate surfaces read it: SeasonLadderPanel, the Director's Report's
// pending-claim row, and the Next Action resolver's claimable-reward check.

export interface LadderTier {
  tier: number;
  /** Season XP required to unlock the tier. */
  xp: number;
  /** CorpsCoin paid on claim. */
  coin: number;
  /** Non-currency reward, when the tier grants one. */
  exclusive?: string;
}

export const TIERS: LadderTier[] = [
  { tier: 1, xp: 150, coin: 50 },
  { tier: 2, xp: 300, coin: 50 },
  { tier: 3, xp: 500, coin: 75 },
  { tier: 4, xp: 750, coin: 75 },
  { tier: 5, xp: 1000, coin: 100 },
  { tier: 6, xp: 1300, coin: 100 },
  { tier: 7, xp: 1600, coin: 125 },
  { tier: 8, xp: 2000, coin: 150 },
  { tier: 9, xp: 2400, coin: 175 },
  { tier: 10, xp: 2800, coin: 200 },
  { tier: 11, xp: 3200, coin: 250 },
  { tier: 12, xp: 3600, coin: 300, exclusive: 'Laureate title' },
];

/** The profile fields the ladder is derived from. */
export interface LadderProfile {
  xp?: number;
  xpAtSeasonStart?: number;
  seasonLadder?: { seasonUid?: string; claimed?: number[] } | null;
}

/**
 * XP earned since this season started. `xpAtSeasonStart` is stamped by the
 * season rollover; before it exists (a director who has never rolled over) the
 * ladder has no baseline and reads as zero rather than crediting lifetime XP.
 */
export function getSeasonXP(profile: Pick<LadderProfile, 'xp' | 'xpAtSeasonStart'> | null): number {
  if (typeof profile?.xpAtSeasonStart !== 'number') return 0;
  return Math.max(0, (profile.xp || 0) - profile.xpAtSeasonStart);
}

/**
 * Tiers the director has earned but not yet claimed, lowest first.
 *
 * The claimed list is scoped to a season: `seasonLadder.seasonUid` must match
 * the active season, otherwise last season's claims would suppress this
 * season's rewards.
 */
export function getClaimableLadderTiers(
  profile: LadderProfile | null,
  seasonUid?: string | null
): LadderTier[] {
  if (!profile) return [];
  const seasonXP = getSeasonXP(profile);
  const state = profile.seasonLadder;
  const claimed = !state || (seasonUid && state.seasonUid !== seasonUid) ? [] : state.claimed || [];
  return TIERS.filter((t) => seasonXP >= t.xp && !claimed.includes(t.tier));
}
