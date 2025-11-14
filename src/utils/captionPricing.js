// src/utils/captionPricing.js
// Dynamic caption pricing and validation utilities

/**
 * Point limits for each competition class
 * Based on development guidelines
 */
export const CLASS_POINT_LIMITS = {
  soundSport: 90,
  aClass: 60,
  open: 120,
  world: 150
};

/**
 * XP level requirements for class unlocks
 */
export const CLASS_UNLOCK_REQUIREMENTS = {
  soundSport: 0,  // Always available
  aClass: 3,      // Level 3
  open: 5,        // Level 5
  world: 10       // Level 10
};

/**
 * Weeks remaining lockout for each class
 */
export const CLASS_REGISTRATION_LOCKS = {
  soundSport: 0,  // No lock
  aClass: 4,      // Locks 4 weeks before season end
  open: 5,        // Locks 5 weeks before season end
  world: 6        // Locks 6 weeks before season end
};

/**
 * CorpsCoin cost to bypass class unlock requirements
 */
export const CLASS_UNLOCK_COSTS = {
  aClass: 1000,
  open: 2500,
  world: 5000
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
      requiredLevel: 0
    },
    aClass: {
      name: 'A Class',
      displayName: 'A Class',
      color: 'blue',
      bgClass: 'bg-blue-500',
      textClass: 'text-blue-500',
      description: 'Intermediate - Requires Level 3',
      pointLimit: 60,
      requiredLevel: 3
    },
    open: {
      name: 'Open Class',
      displayName: 'Open Class',
      color: 'purple',
      bgClass: 'bg-purple-500',
      textClass: 'text-purple-500',
      description: 'Advanced - Requires Level 5',
      pointLimit: 120,
      requiredLevel: 5
    },
    world: {
      name: 'World Class',
      displayName: 'World Class',
      color: 'gold',
      bgClass: 'bg-gold-500',
      textClass: 'text-gold-500',
      description: 'Elite - Requires Level 10',
      pointLimit: 150,
      requiredLevel: 10
    }
  };

  return info[corpsClass] || info.soundSport;
};

export default {
  CLASS_POINT_LIMITS,
  CLASS_UNLOCK_REQUIREMENTS,
  CLASS_REGISTRATION_LOCKS,
  CLASS_UNLOCK_COSTS,
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
  getClassInfo
};
