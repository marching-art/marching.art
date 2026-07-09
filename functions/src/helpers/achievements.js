/**
 * Achievements Catalog & Sweep
 *
 * Single server-side source of truth for profile achievements. Awards happen
 * in one place: the daily sweep inside claimDailyLogin (dailyOps.js), which
 * compares the catalog against the profile's current state and adds anything
 * newly earned — so existing directors are backfilled automatically on their
 * next login, and achievements can never diverge from server state the way
 * the old client-side writers could.
 *
 * Achievement shape matches what the profile/AchievementModal already render:
 * { id, title, description, icon, earnedAt, rarity }
 *
 * ccReward is paid once, when the achievement is first added. Streak-tier
 * achievements carry no ccReward because STREAK_MILESTONES
 * (helpers/engagementRewards.js) already pays coin at the moment the
 * milestone is hit.
 */

/** CorpsCoin paid when an achievement is first earned, by rarity */
const RARITY_CC = { common: 25, rare: 50, epic: 100, legendary: 250 };

/**
 * Catalog entries. `earned(state)` receives a snapshot:
 * { streak, level, unlockedClasses, hasFullLineup, totalShows, totalSeasons,
 *   leagueWins, classRanks }
 */
const ACHIEVEMENT_CATALOG = [
  // --- Streak tiers (coin paid via STREAK_MILESTONES, not here) ---
  { id: 'streak_3', title: '3 Day Streak!', description: 'Logged in 3 days in a row', icon: 'flame', rarity: 'common', ccReward: 0, earned: (s) => s.streak >= 3 },
  { id: 'streak_7', title: '7 Day Streak!', description: 'Logged in 7 days in a row', icon: 'flame', rarity: 'rare', ccReward: 0, earned: (s) => s.streak >= 7 },
  { id: 'streak_14', title: '14 Day Streak!', description: 'Logged in 14 days in a row', icon: 'flame', rarity: 'epic', ccReward: 0, earned: (s) => s.streak >= 14 },
  { id: 'streak_30', title: '30 Day Streak!', description: 'Logged in 30 days in a row', icon: 'flame', rarity: 'legendary', ccReward: 0, earned: (s) => s.streak >= 30 },
  { id: 'streak_60', title: '60 Day Streak!', description: 'Logged in 60 days in a row', icon: 'flame', rarity: 'legendary', ccReward: 0, earned: (s) => s.streak >= 60 },
  { id: 'streak_100', title: '100 Day Streak!', description: 'Logged in 100 days in a row', icon: 'crown', rarity: 'legendary', ccReward: 0, earned: (s) => s.streak >= 100 },

  // --- Level progression ---
  { id: 'level_3', title: 'Rank Up', description: 'Reached XP Level 3', icon: 'award', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.level >= 3 },
  { id: 'level_5', title: 'Veteran', description: 'Reached XP Level 5', icon: 'award', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => s.level >= 5 },
  { id: 'level_10', title: 'Elite Director', description: 'Reached XP Level 10', icon: 'crown', rarity: 'epic', ccReward: RARITY_CC.epic, earned: (s) => s.level >= 10 },
  { id: 'level_15', title: 'Icon', description: 'Reached XP Level 15', icon: 'crown', rarity: 'epic', ccReward: RARITY_CC.epic, earned: (s) => s.level >= 15 },
  { id: 'level_20', title: 'Hall of Famer', description: 'Reached XP Level 20', icon: 'crown', rarity: 'legendary', ccReward: RARITY_CC.legendary, earned: (s) => s.level >= 20 },
  { id: 'level_25', title: 'Immortal', description: 'Reached XP Level 25', icon: 'crown', rarity: 'legendary', ccReward: RARITY_CC.legendary, earned: (s) => s.level >= 25 },

  // --- Class unlocks ---
  { id: 'unlock_aClass', title: 'A Class Access', description: 'Unlocked A Class competition', icon: 'trophy', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.unlockedClasses.includes('aClass') },
  { id: 'unlock_openClass', title: 'Open Class Access', description: 'Unlocked Open Class competition', icon: 'trophy', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => s.unlockedClasses.includes('openClass') },
  { id: 'unlock_worldClass', title: 'World Class Access', description: 'Unlocked World Class competition', icon: 'trophy', rarity: 'epic', ccReward: RARITY_CC.epic, earned: (s) => s.unlockedClasses.includes('worldClass') },

  // --- Career milestones ---
  { id: 'first_lineup', title: 'Full Roster', description: 'Filled all 8 caption slots', icon: 'star', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.hasFullLineup },
  { id: 'shows_10', title: 'Road Warrior', description: 'Competed in 10 career shows', icon: 'star', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.totalShows >= 10 },
  { id: 'shows_50', title: 'Tour Veteran', description: 'Competed in 50 career shows', icon: 'star', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => s.totalShows >= 50 },
  { id: 'shows_100', title: 'Century Tour', description: 'Competed in 100 career shows', icon: 'medal', rarity: 'epic', ccReward: RARITY_CC.epic, earned: (s) => s.totalShows >= 100 },
  { id: 'seasons_1', title: 'Season One', description: 'Completed your first season', icon: 'medal', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.totalSeasons >= 1 },
  { id: 'seasons_5', title: 'Five Year Plan', description: 'Completed 5 seasons', icon: 'medal', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => s.totalSeasons >= 5 },
  { id: 'seasons_10', title: 'Decade of Drums', description: 'Completed 10 seasons', icon: 'crown', rarity: 'legendary', ccReward: RARITY_CC.legendary, earned: (s) => s.totalSeasons >= 10 },

  // --- League ---
  { id: 'league_win_1', title: 'Matchup Victor', description: 'Won a weekly league matchup', icon: 'trophy', rarity: 'common', ccReward: RARITY_CC.common, earned: (s) => s.leagueWins >= 1 },
  { id: 'league_wins_10', title: 'League Force', description: 'Won 10 weekly league matchups', icon: 'trophy', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => s.leagueWins >= 10 },

  // --- Dynasty (trophy case; trophies.* arrays written by nightly scoring) ---
  { id: 'regional_medalist', title: 'Regional Medalist', description: 'Medaled at a regional', icon: 'medal', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => s.regionalTrophies >= 1 },
  { id: 'class_champion', title: 'Class Champion', description: 'Won an Open or A Class Finals title', icon: 'trophy', rarity: 'epic', ccReward: RARITY_CC.epic, earned: (s) => s.classChampionships >= 1 },
  { id: 'world_champion', title: 'Ring Bearer', description: 'Won a Championship Finals title', icon: 'crown', rarity: 'legendary', ccReward: RARITY_CC.legendary, earned: (s) => s.championships >= 1 },
  { id: 'dynasty', title: 'Dynasty', description: 'Won multiple Championship Finals titles', icon: 'crown', rarity: 'legendary', ccReward: RARITY_CC.legendary, earned: (s) => s.championships >= 2 },

  // --- Top-10 standing (per class; classRanks written daily by the rivals job) ---
  { id: 'top_10_aClass', title: 'Top 10 Finish!', description: 'Reached top 10 in A Class', icon: 'trophy', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => (s.classRanks.aClass || Infinity) <= 10 },
  { id: 'top_10_openClass', title: 'Top 10 Finish!', description: 'Reached top 10 in Open Class', icon: 'trophy', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => (s.classRanks.openClass || Infinity) <= 10 },
  { id: 'top_10_worldClass', title: 'Top 10 Finish!', description: 'Reached top 10 in World Class', icon: 'trophy', rarity: 'rare', ccReward: RARITY_CC.rare, earned: (s) => (s.classRanks.worldClass || Infinity) <= 10 },
];

/**
 * Build the state snapshot the catalog predicates evaluate against.
 * `overrides` lets claimDailyLogin pass post-update values (new streak/level/
 * unlockedClasses) that aren't in profileData yet during its transaction.
 */
function buildAchievementState(profileData, overrides = {}) {
  const corps = profileData.corps || {};
  const hasFullLineup = Object.values(corps).some(
    (c) => c && c.lineup && Object.keys(c.lineup).length === 8
  );
  const classRanks = {};
  Object.entries(profileData.classRanks || {}).forEach(([cls, snapshot]) => {
    if (snapshot && typeof snapshot.rank === 'number') classRanks[cls] = snapshot.rank;
  });
  const trophies = profileData.trophies || {};
  return {
    streak: overrides.streak ?? profileData.engagement?.loginStreak ?? 0,
    level: overrides.level ?? profileData.xpLevel ?? 1,
    unlockedClasses: overrides.unlockedClasses ?? profileData.unlockedClasses ?? ['soundSport'],
    hasFullLineup,
    totalShows: profileData.lifetimeStats?.totalShows || 0,
    totalSeasons: profileData.lifetimeStats?.totalSeasons || 0,
    leagueWins: profileData.stats?.leagueWins || 0,
    classRanks,
    regionalTrophies: (trophies.regionals || []).length,
    classChampionships: (trophies.classChampionships || []).length,
    championships: (trophies.championships || []).length,
  };
}

/**
 * Return catalog achievements the profile has newly earned (not yet in
 * profileData.achievements), as ready-to-store objects.
 */
function sweepProfileAchievements(profileData, overrides = {}) {
  const state = buildAchievementState(profileData, overrides);
  const existingIds = new Set((profileData.achievements || []).map((a) => a.id));
  const earnedAt = new Date().toISOString();

  return ACHIEVEMENT_CATALOG.filter((a) => !existingIds.has(a.id) && a.earned(state)).map(
    (a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      icon: a.icon,
      rarity: a.rarity,
      ccReward: a.ccReward,
      earnedAt,
    })
  );
}

/**
 * State-driven cosmetic grants, applied by the daily sweep in claimDailyLogin
 * alongside achievements. Idempotent via cosmetics.owned.
 *
 * Currently one grant: the 'Earned, Not Given' title for unlocking any
 * competition class EARLY via XP level (classUnlockPaths.* === 'xp') — the
 * recognition-asymmetry mark seasons/coin/backstop unlocks never get.
 *
 * @param {Object} profileData - profile snapshot
 * @param {Object} [overrides] - { classUnlockPaths } computed post-update
 *   during the caller's transaction
 * @returns {string[]} shop item ids to arrayUnion into cosmetics.owned
 */
function sweepCosmeticGrants(profileData, overrides = {}) {
  const owned = new Set(profileData.cosmetics?.owned || []);
  const unlockPaths = overrides.classUnlockPaths ?? profileData.classUnlockPaths ?? {};
  const grants = [];
  if (
    Object.values(unlockPaths).some((path) => path === 'xp') &&
    !owned.has('title_earned_not_given')
  ) {
    grants.push('title_earned_not_given');
  }
  return grants;
}

module.exports = {
  ACHIEVEMENT_CATALOG,
  RARITY_CC,
  buildAchievementState,
  sweepProfileAchievements,
  sweepCosmeticGrants,
};
