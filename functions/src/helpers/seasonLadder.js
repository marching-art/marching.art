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
 * Reward budget: 1,650 CC across all 12 tiers (~1.5 weeks of active-player
 * income spread over 7 weeks) plus the ladder-exclusive Laureate title at the
 * cap. An active player (~450-600 XP/week) maxes the ladder in weeks 6-7;
 * casual players land mid-ladder. Keep the client mirror in
 * src/components/Dashboard/sections/SeasonLadderPanel.jsx in sync.
 */

const LADDER_TIERS = [
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
  // The cap: coin + the ladder-exclusive Laureate title (grant-only shop item)
  { tier: 12, xp: 3600, coin: 300, grantItem: 'title_laureate' },
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
