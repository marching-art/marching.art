/**
 * Engagement reward tables — the single source of truth for the daily-login
 * economy: streak milestones (XP + CC + titles), the per-level CorpsCoin
 * stipend, and the streak-freeze price.
 *
 * Lives in helpers/ (not callable/dailyOps.js, which consumes it) so the
 * economy earning guide (callable/economy.js getEarningOpportunities) can
 * read the same numbers without a require cycle — dailyOps already requires
 * economy for coin-history helpers.
 */

// CorpsCoin paid per XP level gained (settled daily against lastRewardedLevel)
const LEVEL_UP_STIPEND = 100;

// Streak milestone rewards (XP + CC + optional free streak freeze)
const STREAK_MILESTONES = {
  3: { xp: 50, coin: 50, title: '3 Day Streak!' },
  7: { xp: 100, coin: 100, title: 'Week Warrior!' },
  14: { xp: 250, coin: 200, title: 'Two Week Terror!' },
  30: { xp: 500, coin: 500, title: 'Monthly Master!', freeFreeze: true },
  60: { xp: 750, coin: 750, title: 'Streak Legend!' },
  100: { xp: 1000, coin: 1000, title: 'Century Club!' },
};

// Streak freeze cost
const STREAK_FREEZE_COST = 300;

module.exports = {
  LEVEL_UP_STIPEND,
  STREAK_MILESTONES,
  STREAK_FREEZE_COST,
};
