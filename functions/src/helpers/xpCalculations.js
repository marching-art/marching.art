/**
 * XP Calculations Helper
 *
 * Shared utility for calculating XP updates across all Firebase functions.
 * Ensures consistent XP and level calculation throughout the application.
 */

const admin = require('firebase-admin');

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
 * XP Sources - Balanced for meaningful progression
 * Active player (~4-5 months to World Class via XP)
 * Target: ~500 XP/week for consistent players
 */
const XP_SOURCES = {
  // Daily login - reward consistency
  dailyLogin: 25,              // 175 XP/week if daily

  // Weekly participation - just play the game
  weeklyParticipation: 200,    // Submit a lineup and participate in weekly shows

  // League wins - reward competitive success
  leagueWin: 100,              // Win a weekly league matchup

  // Streak milestones - reward dedication
  streakMilestone: {
    3: 50,                     // 3-day streak bonus
    7: 100,                    // Week streak bonus
    14: 250,                   // 2-week streak bonus
    30: 500,                   // Month streak bonus
    60: 750,                   // 2-month streak bonus
    100: 1000,                 // Century streak bonus
  },

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
    xpLevel: newLevel
  };

  // Check for class unlocks (by XP level OR time since registration)
  const unlockedClasses = [...(profileData.unlockedClasses || ['soundSport'])];
  let classUnlocked = null;

  // Calculate weeks since registration for time-based unlocks
  const weeksSinceRegistration = getWeeksSinceRegistration(profileData.createdAt);

  if ((newLevel >= XP_CONFIG.classUnlocks.aClass || weeksSinceRegistration >= XP_CONFIG.classUnlockWeeks.aClass) && !unlockedClasses.includes('aClass')) {
    unlockedClasses.push('aClass');
    updates.unlockedClasses = unlockedClasses;
    classUnlocked = 'A Class';
  }
  if ((newLevel >= XP_CONFIG.classUnlocks.open || weeksSinceRegistration >= XP_CONFIG.classUnlockWeeks.open) && !unlockedClasses.includes('open')) {
    unlockedClasses.push('open');
    updates.unlockedClasses = unlockedClasses;
    classUnlocked = 'Open Class';
  }
  if ((newLevel >= XP_CONFIG.classUnlocks.world || weeksSinceRegistration >= XP_CONFIG.classUnlockWeeks.world) && !unlockedClasses.includes('world')) {
    unlockedClasses.push('world');
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
  getSeasonCompletionXP,
  getWeeksSinceRegistration,
  XP_CONFIG,
  XP_SOURCES
};
