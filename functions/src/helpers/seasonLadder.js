/**
 * Seasonal Reward Ladder
 *
 * A free, single-track reward ladder that runs every 49-day season. Progress
 * is the XP earned THIS season — computed as profile.xp minus
 * profile.xpAtSeasonStart (stamped at season rollover, lazily initialized by
 * claimDailyLogin for accounts that predate the feature). No separate XP pool,
 * no premium track, no FOMO mechanics: every XP source the game already has
 * feeds the ladder automatically.
 *
 * Tier claims are validated by the claimLadderTier callable and recorded in
 * profile.seasonLadder = { seasonUid, claimed: [tier, ...] } (server-only —
 * tiers carry currency). Claims reset naturally each season because the
 * seasonUid changes.
 *
 * Reward budget: 1,650 CC across all 12 tiers plus the ladder-exclusive
 * Laureate title at the cap. XP thresholds are paced against the real
 * active-player earn rate (~1,500-1,800 XP/week once login, challenges,
 * predictions and nightly scores are all in play — the ladder's first draft
 * assumed ~450-600/week and an active player maxed it in week 2), so the cap
 * (10,800 XP) now lands in weeks 6-7 and casual players finish mid-ladder.
 * Keep the client mirror in src/utils/seasonLadder.ts (and the panel that
 * reads it) in sync.
 */

const LADDER_TIERS = [
  { tier: 1, xp: 450, coin: 50 },
  { tier: 2, xp: 900, coin: 50 },
  { tier: 3, xp: 1500, coin: 75 },
  { tier: 4, xp: 2250, coin: 75 },
  { tier: 5, xp: 3000, coin: 100 },
  { tier: 6, xp: 3900, coin: 100 },
  { tier: 7, xp: 4800, coin: 125 },
  { tier: 8, xp: 6000, coin: 150 },
  { tier: 9, xp: 7200, coin: 175 },
  { tier: 10, xp: 8400, coin: 200 },
  { tier: 11, xp: 9600, coin: 250 },
  // The cap: coin + the ladder-exclusive Laureate title (grant-only shop item)
  { tier: 12, xp: 10800, coin: 300, grantItem: 'title_laureate' },
];

function getLadderTier(tier) {
  return LADDER_TIERS.find((t) => t.tier === tier) || null;
}

/** XP earned this season, from the profile's rollover baseline. */
function getSeasonXP(profileData) {
  if (typeof profileData.xpAtSeasonStart !== 'number') return 0;
  return Math.max(0, (profileData.xp || 0) - profileData.xpAtSeasonStart);
}

module.exports = {
  LADDER_TIERS,
  getLadderTier,
  getSeasonXP,
};
