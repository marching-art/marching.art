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
    aClass: 3,       // Level 3 unlocks A Class
    open: 5,         // Level 5 unlocks Open Class
    world: 10        // Level 10 unlocks World Class
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

module.exports = {
  calculateXPUpdates,
  calculateLevel,
  XP_CONFIG
};
