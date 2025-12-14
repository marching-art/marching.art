/**
 * XP Calculations Helper
 *
 * Shared utility for calculating XP updates across all Firebase functions.
 * Ensures consistent XP and level calculation throughout the application.
 */

const admin = require('firebase-admin');

/**
 * XP Configuration
 */
const XP_CONFIG = {
  xpPerLevel: 1000,  // XP required per level
  classUnlocks: {
    aClass: 3,       // Level 3 (3000 XP) unlocks A Class
    open: 5,         // Level 5 (5000 XP) unlocks Open Class
    world: 10        // Level 10 (10000 XP) unlocks World Class
  }
};

/**
 * Simplified XP Sources - Clear, achievable amounts
 * No daily grind required, focused on meaningful participation
 */
const XP_SOURCES = {
  // Weekly participation - just play the game
  weeklyParticipation: 100,    // Submit a lineup and participate in weekly shows

  // League wins - reward competitive success
  leagueWin: 50,               // Win a weekly league matchup

  // Season completion - end of season bonus based on final rank
  seasonCompletion: {
    top10: 500,                // Top 10 finish
    top25: 400,                // Top 25 finish
    top50: 300,                // Top 50 finish
    completed: 200             // Just finishing the season
  }
};

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

  // Also update battle pass if active
  if (profileData.battlePass?.currentSeason) {
    updates['battlePass.xp'] = admin.firestore.FieldValue.increment(xpToAdd);
  }

  // Check for class unlocks
  const unlockedClasses = [...(profileData.unlockedClasses || ['soundSport'])];
  let classUnlocked = null;

  if (newLevel >= XP_CONFIG.classUnlocks.aClass && !unlockedClasses.includes('aClass')) {
    unlockedClasses.push('aClass');
    updates.unlockedClasses = unlockedClasses;
    classUnlocked = 'A Class';
  }
  if (newLevel >= XP_CONFIG.classUnlocks.open && !unlockedClasses.includes('open')) {
    unlockedClasses.push('open');
    updates.unlockedClasses = unlockedClasses;
    classUnlocked = 'Open Class';
  }
  if (newLevel >= XP_CONFIG.classUnlocks.world && !unlockedClasses.includes('world')) {
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
  XP_CONFIG,
  XP_SOURCES
};
