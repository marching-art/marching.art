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
    aClass: 3,       // Level 3 (3000 XP) unlocks A Class
    open: 5,         // Level 5 (5000 XP) unlocks Open Class
    world: 10        // Level 10 (10000 XP) unlocks World Class
  },
  /** Weeks after registration when each class auto-unlocks */
  classUnlockWeeks: {
    aClass: 5,       // 5 weeks after registration
    open: 12,        // 12 weeks after registration
    world: 19        // 19 weeks after registration
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

  // Weekly participation — compete in ≥1 show in a week, paid once per
  // participating class at the week boundary of the nightly scoring run
  // (helpers/scoringAwards.js payWeeklyParticipationXP).
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

  // Calculate weeks since registration for time-based unlocks
  const weeksSinceRegistration = getWeeksSinceRegistration(profileData.createdAt);

  if ((newLevel >= XP_CONFIG.classUnlocks.aClass || weeksSinceRegistration >= XP_CONFIG.classUnlockWeeks.aClass) && !unlockedClasses.includes('aClass')) {
    unlockedClasses.push('aClass');
    updates.unlockedClasses = unlockedClasses;
    classUnlocked = 'A Class';
  }
  if ((newLevel >= XP_CONFIG.classUnlocks.open || weeksSinceRegistration >= XP_CONFIG.classUnlockWeeks.open) && !unlockedClasses.includes('openClass')) {
    unlockedClasses.push('openClass');
    updates.unlockedClasses = unlockedClasses;
    classUnlocked = 'Open Class';
  }
  if ((newLevel >= XP_CONFIG.classUnlocks.world || weeksSinceRegistration >= XP_CONFIG.classUnlockWeeks.world) && !unlockedClasses.includes('worldClass')) {
    unlockedClasses.push('worldClass');
    updates.unlockedClasses = unlockedClasses;
    classUnlocked = 'World Class';
  }

  return { updates, newXP, newLevel, classUnlocked };
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

module.exports = {
  calculateXPUpdates,
  calculateLevel,
  getLevelTitle,
  getSeasonCompletionXP,
  getWeeksSinceRegistration,
  XP_CONFIG,
  XP_SOURCES,
  LEVEL_TITLES,
};
