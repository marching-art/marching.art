// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
/**
 * XP Calculations Helper
 *
 * Shared utility for calculating XP updates across all Firebase functions.
 * Ensures consistent XP and level calculation throughout the application.
 */


/**
 * XP Configuration
 * Balanced for ~4-5 month path to World Class for active players
 */
const XP_CONFIG = {
  xpPerLevel: 1000,  // XP required per level
  classUnlocks: {
    aClass: 3,       // Level 3 (3000 XP) unlocks A Class early
    open: 5,         // Level 5 (5000 XP) unlocks Open Class early
    world: 10        // Level 10 (10000 XP) unlocks World Class early
  },
  /**
   * Seasons actively completed (lifetimeStats.totalSeasons — competed in ≥1
   * show in a season that then archived) that unlock each class. This is the
   * "play = earning" path: finish a season, graduate a class. The old
   * calendar path (5/12/19 weeks since registration, granted whether or not
   * you played) is gone — it out-ran active play and made the XP path
   * decorative. Owner-approved redesign: docs/GAMIFICATION.md.
   */
  classUnlockSeasons: {
    aClass: 1,       // complete 1 season
    open: 2,         // complete 2 seasons
    world: 3         // complete 3 seasons
  },
  /**
   * Silent anti-frustration backstop: after ~a year of account age a class
   * unlocks regardless, set so far out that any active play beats it. Granted
   * without the graduation fanfare (unlockPath 'backstop').
   */
  backstopWeeks: {
    aClass: 52,
    open: 56,
    world: 60
  }
};

/**
 * Title mapping - must stay in sync with the client mirror in
 * src/components/Profile/directorProfileHelpers.ts.
 * The ladder continues past Level 10 so long-term directors keep a title to
 * chase: 10 Legend → 15 Icon → 20 Hall of Famer → 25 Immortal → 30 Eternal.
 */
const LEVEL_TITLES = {
  1: 'Rookie',
  2: 'Trainee',
  3: 'Assistant',
  4: 'Coordinator',
  5: 'Instructor',
  6: 'Caption Head',
  7: 'Program Director',
  8: 'Director',
  9: 'Executive Director',
  10: 'Legend',
  15: 'Icon',
  20: 'Hall of Famer',
  25: 'Immortal',
  30: 'Eternal',
};

/** Extended-tier thresholds, highest first, for levels 10+ */
const EXTENDED_TITLE_TIERS = [30, 25, 20, 15, 10];

/**
 * Get the director title for a given level (1+).
 * Levels 10+ resolve to the highest extended tier reached.
 */
function getLevelTitle(level) {
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  if (lvl >= 10) {
    const tier = EXTENDED_TITLE_TIERS.find((t) => lvl >= t);
    return LEVEL_TITLES[tier];
  }
  return LEVEL_TITLES[lvl] || 'Rookie';
}

/**
 * XP Sources - Balanced for meaningful progression
 * Active player (~4-5 months to World Class via XP)
 * Target: ~500 XP/week for consistent players
 */
const XP_SOURCES = {
  // Daily login - reward consistency
  dailyLogin: 25,              // 175 XP/week if daily

  // Compete in a show — the core act. Paid per attended show alongside the
  // participation CC in the nightly scoring run (≤4 shows/week → ≤100/wk).
  showParticipation: 25,

  // Weekly participation — compete in ≥1 show in a week, paid once per
  // participating class at the week boundary of the nightly scoring run
  // (helpers/weeklyMatchups.js payWeeklyParticipationXP).
  weeklyParticipation: 150,

  // League wins — paid alongside the weekly-win CorpsCoin in
  // processWeeklyMatchups. Byes and ties award nothing.
  leagueWin: 100,

  // Streak-milestone XP/CC live in STREAK_MILESTONES
  // (helpers/engagementRewards.js), the single source of truth — it also
  // carries the CC amounts and titles.

  // Season completion - end of season bonus based on final rank
  seasonCompletion: {
    top10: 500,                // Top 10 finish
    top25: 400,                // Top 25 finish
    top50: 300,                // Top 50 finish
    completed: 200             // Just finishing the season
  }
};

const MILLIS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Calculate full weeks elapsed since user registration.
 * Handles Firestore Timestamps, JS Dates, and ISO strings.
 *
 * @param {Object|Date|string} createdAt - User's registration date
 * @returns {number} Full weeks since registration (0 if invalid)
 */
function getWeeksSinceRegistration(createdAt) {
  if (!createdAt) return 0;
  let date;
  if (createdAt.toDate) {
    date = createdAt.toDate(); // Firestore Timestamp
  } else if (createdAt instanceof Date) {
    date = createdAt;
  } else if (typeof createdAt === 'string') {
    date = new Date(createdAt);
  } else {
    return 0;
  }
  const elapsed = Date.now() - date.getTime();
  return Math.floor(elapsed / MILLIS_PER_WEEK);
}

/**
 * Calculate XP updates including level and class unlocks
 *
 * @param {Object} profileData - Current profile data from Firestore
 * @param {number} xpToAdd - Amount of XP to add
 * @returns {Object} Object containing updates, newXP, newLevel, and classUnlocked
 */
function calculateXPUpdates(profileData, xpToAdd) {
  const currentXP = profileData.xp || 0;
  const newXP = currentXP + xpToAdd;
  const newLevel = Math.floor(newXP / XP_CONFIG.xpPerLevel) + 1;

  const updates = {
    xp: newXP,
    xpLevel: newLevel,
    userTitle: getLevelTitle(newLevel)
  };

  // Check for class unlocks (by XP level OR time since registration).
  // Canonicalize stored entries — some legacy profiles contain short keys
  // ('open', 'world') that don't match the canonical format used elsewhere
  // ('openClass', 'worldClass', 'aClass', 'soundSport').
  const CANONICAL = {
    soundSport: 'soundSport',
    aClass: 'aClass',
    open: 'openClass',
    openClass: 'openClass',
    world: 'worldClass',
    worldClass: 'worldClass',
  };
  const rawUnlocked = profileData.unlockedClasses || ['soundSport'];
  const unlockedClasses = Array.from(
    new Set(rawUnlocked.map((c) => CANONICAL[c] || c))
  );
  // If canonicalization changed anything, persist the cleaned array.
  const canonicalizationChanged =
    unlockedClasses.length !== rawUnlocked.length ||
    unlockedClasses.some((c, i) => c !== rawUnlocked[i]);
  if (canonicalizationChanged) {
    updates.unlockedClasses = unlockedClasses;
  }

  let classUnlocked = null;
  let unlockPath = null;

  // Unlock inputs: XP level (early, earned), seasons actively completed
  // (the standard "play = earning" path), and a distant silent backstop.
  // unlockedClasses is additive and never revoked, so profiles that already
  // hold classes from the retired calendar path keep them untouched.
  const totalSeasons = profileData.lifetimeStats?.totalSeasons || 0;
  const weeksSinceRegistration = getWeeksSinceRegistration(profileData.createdAt);

  const CLASS_LABELS = { aClass: 'A Class', open: 'Open Class', world: 'World Class' };
  const CANONICAL_KEY = { aClass: 'aClass', open: 'openClass', world: 'worldClass' };

  for (const key of ['aClass', 'open', 'world']) {
    const canonical = CANONICAL_KEY[key];
    if (unlockedClasses.includes(canonical)) continue;

    const byLevel = newLevel >= XP_CONFIG.classUnlocks[key];
    const bySeasons = totalSeasons >= XP_CONFIG.classUnlockSeasons[key];
    const byBackstop = weeksSinceRegistration >= XP_CONFIG.backstopWeeks[key];
    if (!byLevel && !bySeasons && !byBackstop) continue;

    unlockedClasses.push(canonical);
    updates.unlockedClasses = unlockedClasses;
    classUnlocked = CLASS_LABELS[key];
    // Recognition asymmetry: 'xp' unlocks earn the "did it the hard way"
    // mark; 'seasons' is the earned-by-playing graduation; 'backstop' is
    // granted silently (no fanfare, no cosmetic).
    unlockPath = byLevel ? 'xp' : bySeasons ? 'seasons' : 'backstop';
    updates[`classUnlockPaths.${canonical}`] = unlockPath;
  }

  return { updates, newXP, newLevel, classUnlocked, unlockPath };
}

/**
 * Calculate XP level from total XP
 *
 * @param {number} xp - Total XP
 * @returns {number} Level (1-based)
 */
function calculateLevel(xp) {
  return Math.floor((xp || 0) / XP_CONFIG.xpPerLevel) + 1;
}

/**
 * Calculate season completion XP based on final rank
 * @param {number} rank - Final rank in class
 * @param {number} totalParticipants - Total participants in class
 * @returns {number} XP to award
 */
function getSeasonCompletionXP(rank, totalParticipants) {
  if (!rank || rank <= 0) return XP_SOURCES.seasonCompletion.completed;

  const percentile = (rank / totalParticipants) * 100;

  if (percentile <= 10 || rank <= 10) {
    return XP_SOURCES.seasonCompletion.top10;
  } else if (percentile <= 25 || rank <= 25) {
    return XP_SOURCES.seasonCompletion.top25;
  } else if (percentile <= 50 || rank <= 50) {
    return XP_SOURCES.seasonCompletion.top50;
  }

  return XP_SOURCES.seasonCompletion.completed;
}

/**
 * Season-ladder baseline for accounts that predate the ladder: returns a
 * one-time { xpAtSeasonStart } stamp (the profile's pre-award XP) when the
 * baseline is missing, else {}. Merged into every daily XP callable's update
 * so the ladder starts counting on a player's first XP event after deploy —
 * new seasons stamp the baseline properly at rollover.
 */
function seasonBaselineStamp(profileData) {
  return typeof profileData.xpAtSeasonStart === "number"
    ? {}
    : { xpAtSeasonStart: profileData.xp || 0 };
}

module.exports = {
  calculateXPUpdates,
  calculateLevel,
  getLevelTitle,
  getSeasonCompletionXP,
  getWeeksSinceRegistration,
  seasonBaselineStamp,
  XP_CONFIG,
  XP_SOURCES,
  LEVEL_TITLES,
};
