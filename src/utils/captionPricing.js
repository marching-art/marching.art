// src/utils/captionPricing.js
// Dynamic caption pricing and validation utilities

/**
 * Point limits for each competition class
 * Based on development guidelines
 */
export const CLASS_POINT_LIMITS = {
  soundSport: 90,
  aClass: 60,
  openClass: 120,
  worldClass: 150
};

/**
 * XP level requirements for class unlocks
 * Level 1 = 1000 XP, so Level 3 = 3000 XP, etc.
 */
export const CLASS_UNLOCK_REQUIREMENTS = {
  soundSport: 0,  // Always available (0 XP)
  aClass: 3,      // Level 3 (3000 XP)
  openClass: 5,   // Level 5 (5000 XP)
  worldClass: 10  // Level 10 (10000 XP)
};

/**
 * XP thresholds for class unlocks (for display purposes)
 */
export const CLASS_XP_THRESHOLDS = {
  soundSport: 0,
  aClass: 3000,      // Level 3
  openClass: 5000,   // Level 5
  worldClass: 10000  // Level 10
};

/**
 * Weeks remaining lockout for each class
 */
export const CLASS_REGISTRATION_LOCKS = {
  soundSport: 0,  // No lock
  aClass: 4,      // Locks 4 weeks before season end
  openClass: 5,   // Locks 5 weeks before season end
  worldClass: 6   // Locks 6 weeks before season end
};

/**
 * CorpsCoin cost to bypass class unlock requirements
 */
export const CLASS_UNLOCK_COSTS = {
  aClass: 1000,
  openClass: 2500,
  worldClass: 5000
};

/**
 * Simplified XP Sources - Clear, achievable amounts
 * Matches backend configuration for consistency
 */
export const XP_SOURCES = {
  weeklyParticipation: 100,  // Submit lineup and participate weekly
  leagueWin: 50,             // Win a weekly league matchup
  seasonCompletion: {
    top10: 500,              // Top 10 finish
    top25: 400,              // Top 25 finish
    top50: 300,              // Top 50 finish
    completed: 200           // Just finishing the season
  }
};

/**
 * Required captions for a valid lineup
 */
export const REQUIRED_CAPTIONS = [
  'GE1',  // General Effect 1
  'GE2',  // General Effect 2
  'VP',   // Visual Proficiency
  'VA',   // Visual Analysis
  'CG',   // Color Guard
  'B',    // Brass
  'MA',   // Music Analysis
  'P'     // Percussion
];

/**
 * Caption categories for UI organization
 */
export const CAPTION_CATEGORIES = {
  GE1: { name: 'General Effect 1', category: 'General Effect', weight: 20, shortName: 'GE1' },
  GE2: { name: 'General Effect 2', category: 'General Effect', weight: 20, shortName: 'GE2' },
  VP: { name: 'Visual Proficiency', category: 'Visual', weight: 10, shortName: 'VP' },
  VA: { name: 'Visual Analysis', category: 'Visual', weight: 10, shortName: 'VA' },
  CG: { name: 'Color Guard', category: 'Visual', weight: 10, shortName: 'CG' },
  B: { name: 'Brass', category: 'Music', weight: 10, shortName: 'B' },
  MA: { name: 'Music Analysis', category: 'Music', weight: 10, shortName: 'MA' },
  P: { name: 'Percussion', category: 'Music', weight: 10, shortName: 'P' }
};

/**
 * Calculate total point value of a lineup
 * @param {Object} lineup - Object mapping caption to corps ID
 * @param {Array} availableCorps - Array of corps with value property
 * @returns {number} Total point value
 */
export const calculateLineupValue = (lineup, availableCorps) => {
  if (!lineup || !availableCorps) return 0;

  let total = 0;
  const corpsMap = new Map(availableCorps.map(c => [c.id, c.value]));

  Object.values(lineup).forEach(corpsId => {
    const value = corpsMap.get(corpsId);
    if (value) total += value;
  });

  return total;
};

/**
 * Check if a lineup is valid for a given class
 * @param {Object} lineup - Caption to corps ID mapping
 * @param {string} corpsClass - Competition class
 * @param {Array} availableCorps - Available corps with values
 * @returns {Object} { valid: boolean, reason: string, totalValue: number }
 */
export const validateLineup = (lineup, corpsClass, availableCorps) => {
  // Check all captions are selected
  const selectedCaptions = Object.keys(lineup);
  if (selectedCaptions.length !== REQUIRED_CAPTIONS.length) {
    return {
      valid: false,
      reason: `Please select all ${REQUIRED_CAPTIONS.length} captions`,
      totalValue: 0
    };
  }

  // Check for missing captions
  const missingCaptions = REQUIRED_CAPTIONS.filter(c => !selectedCaptions.includes(c));
  if (missingCaptions.length > 0) {
    return {
      valid: false,
      reason: `Missing captions: ${missingCaptions.join(', ')}`,
      totalValue: 0
    };
  }

  // Check for duplicate corps selections
  const corpsIds = Object.values(lineup);
  const uniqueCorps = new Set(corpsIds);
  if (corpsIds.length !== uniqueCorps.size) {
    return {
      valid: false,
      reason: 'Cannot select the same corps for multiple captions',
      totalValue: 0
    };
  }

  // Calculate total value
  const totalValue = calculateLineupValue(lineup, availableCorps);

  // Check point limit for class
  const limit = CLASS_POINT_LIMITS[corpsClass];
  if (!limit) {
    return {
      valid: false,
      reason: 'Invalid competition class',
      totalValue
    };
  }

  if (totalValue > limit) {
    return {
      valid: false,
      reason: `Lineup exceeds ${corpsClass} point limit of ${limit} (current: ${totalValue})`,
      totalValue
    };
  }

  return {
    valid: true,
    reason: 'Lineup is valid',
    totalValue
  };
};

/**
 * Generate a unique hash for a lineup to prevent duplicates
 * @param {Object} lineup - Caption to corps ID mapping
 * @returns {string} Hash string
 */
export const generateLineupHash = (lineup) => {
  // Sort captions alphabetically and concatenate corps IDs
  const sortedEntries = REQUIRED_CAPTIONS
    .map(caption => `${caption}:${lineup[caption] || 'none'}`)
    .join('|');

  return btoa(sortedEntries); // Base64 encode
};

/**
 * Check if user can register for a class
 * @param {number} userLevel - User's current XP level
 * @param {number} corpsCoin - User's CorpsCoin balance
 * @param {string} corpsClass - Class to check
 * @param {number} weeksRemaining - Weeks until season end
 * @returns {Object} { canRegister: boolean, reason: string, cost: number }
 */
export const canRegisterForClass = (userLevel, corpsCoin, corpsClass, weeksRemaining) => {
  const requiredLevel = CLASS_UNLOCK_REQUIREMENTS[corpsClass];
  const lockWeeks = CLASS_REGISTRATION_LOCKS[corpsClass];
  const unlockCost = CLASS_UNLOCK_COSTS[corpsClass] || 0;

  // Check if registration is locked due to season timing
  if (weeksRemaining < lockWeeks) {
    return {
      canRegister: false,
      reason: `Registration for ${corpsClass} closed (locks at ${lockWeeks} weeks remaining)`,
      cost: 0
    };
  }

  // Check level requirement
  if (userLevel >= requiredLevel) {
    return {
      canRegister: true,
      reason: 'Level requirement met',
      cost: 0
    };
  }

  // Check if can unlock with CorpsCoin
  if (corpsCoin >= unlockCost) {
    return {
      canRegister: true,
      reason: `Can unlock with ${unlockCost} CorpsCoin`,
      cost: unlockCost,
      requiresPayment: true
    };
  }

  return {
    canRegister: false,
    reason: `Requires Level ${requiredLevel} or ${unlockCost} CorpsCoin (have ${corpsCoin})`,
    cost: unlockCost
  };
};

/**
 * Calculate XP level from total XP
 * @param {number} xp - Total XP
 * @returns {number} Current level
 */
export const calculateLevel = (xp) => {
  return Math.floor(xp / 1000) + 1;
};

/**
 * Calculate XP needed for next level
 * @param {number} currentXP - Current total XP
 * @returns {Object} { current: number, needed: number, percentage: number }
 */
export const getXPProgress = (currentXP) => {
  const currentLevel = calculateLevel(currentXP);
  const xpInCurrentLevel = currentXP % 1000;
  const xpNeeded = 1000;
  const percentage = (xpInCurrentLevel / xpNeeded) * 100;

  return {
    current: xpInCurrentLevel,
    needed: xpNeeded,
    percentage: Math.round(percentage),
    level: currentLevel,
    nextLevel: currentLevel + 1
  };
};

/**
 * Get available caption changes based on weeks remaining
 * @param {number} weeksRemaining - Weeks until finals
 * @returns {number} Number of changes allowed this week
 */
export const getCaptionChangesAllowed = (weeksRemaining) => {
  if (weeksRemaining >= 5) {
    return Infinity; // Unlimited
  } else if (weeksRemaining >= 1) {
    return 3; // 3 per week
  } else {
    // Final week: 2 between quarters/semis, 2 between semis/finals
    return 4; // Total for the week (managed by specific days)
  }
};

/**
 * Format corps name with year for display
 * @param {Object} corps - Corps object with name and year
 * @returns {string} Formatted name
 */
export const formatCorpsName = (corps) => {
  if (!corps) return '';
  return `${corps.year} ${corps.name}`;
};

/**
 * Get class display information
 * @param {string} corpsClass - Class identifier
 * @returns {Object} Display information
 */
export const getClassInfo = (corpsClass) => {
  const info = {
    soundSport: {
      name: 'SoundSport',
      displayName: 'SoundSport',
      color: 'green',
      bgClass: 'bg-green-500',
      textClass: 'text-green-500',
      description: 'Entry level - Perfect for beginners',
      pointLimit: 90,
      requiredLevel: 0,
      requiredXP: 0
    },
    aClass: {
      name: 'A Class',
      displayName: 'A Class',
      color: 'blue',
      bgClass: 'bg-blue-500',
      textClass: 'text-blue-500',
      description: '3,000 XP or 1,000 CC',
      pointLimit: 60,
      requiredLevel: 3,
      requiredXP: 3000,
      unlockCost: 1000
    },
    open: {
      name: 'Open Class',
      displayName: 'Open Class',
      color: 'purple',
      bgClass: 'bg-purple-500',
      textClass: 'text-purple-500',
      description: '5,000 XP or 2,500 CC',
      pointLimit: 120,
      requiredLevel: 5,
      requiredXP: 5000,
      unlockCost: 2500
    },
    world: {
      name: 'World Class',
      displayName: 'World Class',
      color: 'gold',
      bgClass: 'bg-gold-500',
      textClass: 'text-gold-500',
      description: '10,000 XP or 5,000 CC',
      pointLimit: 150,
      requiredLevel: 10,
      requiredXP: 10000,
      unlockCost: 5000
    }
  };

  return info[corpsClass] || info.soundSport;
};

/**
 * Class progression order (from beginner to elite)
 */
const CLASS_PROGRESSION = ['soundSport', 'aClass', 'openClass', 'worldClass'];

/**
 * Get progress toward next class unlock
 * @param {number} currentXP - User's current total XP
 * @param {Array} unlockedClasses - Array of unlocked class IDs
 * @param {number} corpsCoin - User's CorpsCoin balance
 * @returns {Object|null} Progress info or null if all classes unlocked
 */
export const getNextClassProgress = (currentXP, unlockedClasses = ['soundSport'], corpsCoin = 0) => {
  // Find the next class to unlock
  const nextClass = CLASS_PROGRESSION.find(cls => !unlockedClasses.includes(cls));

  if (!nextClass) {
    return null; // All classes unlocked
  }

  const thresholds = {
    aClass: { xp: 3000, cc: 1000, name: 'A Class', color: 'blue' },
    openClass: { xp: 5000, cc: 2500, name: 'Open Class', color: 'purple' },
    worldClass: { xp: 10000, cc: 5000, name: 'World Class', color: 'gold' }
  };

  const threshold = thresholds[nextClass];
  if (!threshold) return null;

  const xpProgress = Math.min(currentXP / threshold.xp, 1);
  const xpRemaining = Math.max(threshold.xp - currentXP, 0);
  const canUnlockWithCC = corpsCoin >= threshold.cc;

  return {
    nextClass,
    className: threshold.name,
    color: threshold.color,
    requiredXP: threshold.xp,
    currentXP,
    xpProgress: Math.round(xpProgress * 100),
    xpRemaining,
    requiredCC: threshold.cc,
    currentCC: corpsCoin,
    canUnlockWithCC,
    ccRemaining: Math.max(threshold.cc - corpsCoin, 0)
  };
};

export default {
  CLASS_POINT_LIMITS,
  CLASS_UNLOCK_REQUIREMENTS,
  CLASS_XP_THRESHOLDS,
  CLASS_REGISTRATION_LOCKS,
  CLASS_UNLOCK_COSTS,
  XP_SOURCES,
  REQUIRED_CAPTIONS,
  CAPTION_CATEGORIES,
  calculateLineupValue,
  validateLineup,
  generateLineupHash,
  canRegisterForClass,
  calculateLevel,
  getXPProgress,
  getCaptionChangesAllowed,
  formatCorpsName,
  getClassInfo,
  getNextClassProgress
};
