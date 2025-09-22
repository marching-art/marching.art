// utils/classProgression.js - Cumulative Class Progression System
// Users can play ALL unlocked classes simultaneously

// ===============================
// CLASS PROGRESSION CONFIGURATION
// ===============================

export const CORPS_CLASS_PROGRESSION = {
  aClass: {
    name: 'A Class',
    pointCap: 60,
    unlockLevel: 1,
    unlockXP: 0,
    color: 'bg-green-500',
    description: 'Perfect for learning the game - always available',
    icon: '🌱',
    difficulty: 'Beginner'
  },
  openClass: {
    name: 'Open Class', 
    pointCap: 120,
    unlockLevel: 5,
    unlockXP: 1000,
    color: 'bg-blue-500',
    description: 'Competitive intermediate level',
    icon: '🎯',
    difficulty: 'Intermediate'
  },
  worldClass: {
    name: 'World Class',
    pointCap: 150, 
    unlockLevel: 10,
    unlockXP: 2500,
    color: 'bg-yellow-500',
    description: 'Elite competition - ultimate challenge',
    icon: '👑',
    difficulty: 'Elite'
  }
};

// ===============================
// PROGRESSION UTILITIES
// ===============================

// Get all classes available to user based on their level
export const getAvailableClasses = (userLevel) => {
  const availableClasses = [];
  
  Object.entries(CORPS_CLASS_PROGRESSION).forEach(([className, classData]) => {
    if (userLevel >= classData.unlockLevel) {
      availableClasses.push(className);
    }
  });
  
  return availableClasses;
};

// Get all classes user can currently play (cumulative)
export const getPlayableClasses = (userProfile) => {
  const userLevel = userProfile?.level || 1;
  const unlockedClasses = userProfile?.unlockedClasses || ['aClass'];
  
  // Return intersection of unlocked and level-appropriate classes
  const levelAppropriate = getAvailableClasses(userLevel);
  return unlockedClasses.filter(className => levelAppropriate.includes(className));
};

// Check if user can create a new corps in a specific class
export const canCreateCorps = (userProfile, corpsClass) => {
  const playableClasses = getPlayableClasses(userProfile);
  const existingCorps = userProfile?.corps || {};
  
  return playableClasses.includes(corpsClass) && !existingCorps[corpsClass];
};

// Get next class to unlock
export const getNextClassToUnlock = (userLevel) => {
  const classOrder = ['aClass', 'openClass', 'worldClass'];
  
  for (const className of classOrder) {
    const classData = CORPS_CLASS_PROGRESSION[className];
    if (userLevel < classData.unlockLevel) {
      return {
        className,
        ...classData,
        levelsToGo: classData.unlockLevel - userLevel,
        xpToGo: classData.unlockXP - calculateXPForLevel(userLevel)
      };
    }
  }
  
  return null; // All classes unlocked
};

// Calculate XP required for a specific level
export const calculateXPForLevel = (level) => {
  return Math.pow(level - 1, 2) * 100;
};

// ===============================
// USER INTERFACE HELPERS
// ===============================

// Generate class selection UI data
export const getClassSelectionData = (userProfile) => {
  const userLevel = userProfile?.level || 1;
  const playableClasses = getPlayableClasses(userProfile);
  const existingCorps = userProfile?.corps || {};
  
  return Object.entries(CORPS_CLASS_PROGRESSION).map(([className, classData]) => {
    const isUnlocked = playableClasses.includes(className);
    const hasCorps = !!existingCorps[className];
    const canCreate = isUnlocked && !hasCorps;
    
    let status = 'locked';
    if (isUnlocked && hasCorps) status = 'active';
    else if (isUnlocked && !hasCorps) status = 'available';
    else if (!isUnlocked) status = 'locked';
    
    return {
      className,
      ...classData,
      isUnlocked,
      hasCorps,
      canCreate,
      status,
      corps: existingCorps[className] || null,
      unlockProgress: userLevel >= classData.unlockLevel ? 100 : (userLevel / classData.unlockLevel) * 100
    };
  });
};

// Get user's corps summary across all classes
export const getUserCorpsSummary = (userProfile) => {
  const playableClasses = getPlayableClasses(userProfile);
  const existingCorps = userProfile?.corps || {};
  
  const summary = {
    totalAvailableClasses: playableClasses.length,
    totalActiveCorps: 0,
    totalPossibleCorps: playableClasses.length,
    corpsByClass: {},
    completionRate: 0,
    nextUnlock: getNextClassToUnlock(userProfile?.level || 1)
  };
  
  playableClasses.forEach(className => {
    const corps = existingCorps[className];
    const classData = CORPS_CLASS_PROGRESSION[className];
    
    if (corps) {
      summary.totalActiveCorps++;
      summary.corpsByClass[className] = {
        ...corps,
        classData,
        lineupComplete: Object.keys(corps.lineup || {}).length === 8,
        staffComplete: Object.keys(corps.staffLineup || {}).length === 8
      };
    } else {
      summary.corpsByClass[className] = {
        classData,
        available: true,
        canCreate: true
      };
    }
  });
  
  summary.completionRate = (summary.totalActiveCorps / summary.totalPossibleCorps) * 100;
  
  return summary;
};

// ===============================
// PROGRESSION VALIDATION
// ===============================

// Validate user can perform action in specific class
export const validateClassAction = (userProfile, corpsClass, action) => {
  const playableClasses = getPlayableClasses(userProfile);
  const existingCorps = userProfile?.corps || {};
  
  const validations = {
    create: {
      valid: playableClasses.includes(corpsClass) && !existingCorps[corpsClass],
      message: playableClasses.includes(corpsClass) 
        ? (existingCorps[corpsClass] ? 'Corps already exists in this class' : 'Can create corps')
        : 'Class not yet unlocked'
    },
    
    edit: {
      valid: playableClasses.includes(corpsClass) && !!existingCorps[corpsClass],
      message: playableClasses.includes(corpsClass)
        ? (existingCorps[corpsClass] ? 'Can edit corps' : 'No corps exists in this class')
        : 'Class not yet unlocked'
    },
    
    delete: {
      valid: playableClasses.includes(corpsClass) && !!existingCorps[corpsClass],
      message: playableClasses.includes(corpsClass)
        ? (existingCorps[corpsClass] ? 'Can delete corps' : 'No corps exists in this class')
        : 'Class not yet unlocked'
    },
    
    view: {
      valid: playableClasses.includes(corpsClass),
      message: playableClasses.includes(corpsClass) ? 'Can view class' : 'Class not yet unlocked'
    }
  };
  
  return validations[action] || { valid: false, message: 'Invalid action' };
};

// ===============================
// LEVEL UP PROCESSING
// ===============================

// Process level up and check for newly unlocked classes
export const processLevelUp = (oldLevel, newLevel, currentUnlockedClasses = ['aClass']) => {
  const newlyUnlocked = [];
  const updatedUnlockedClasses = [...currentUnlockedClasses];
  
  Object.entries(CORPS_CLASS_PROGRESSION).forEach(([className, classData]) => {
    // If user just reached the unlock level and doesn't already have it
    if (newLevel >= classData.unlockLevel && 
        oldLevel < classData.unlockLevel && 
        !currentUnlockedClasses.includes(className)) {
      newlyUnlocked.push(className);
      updatedUnlockedClasses.push(className);
    }
  });
  
  return {
    newlyUnlocked,
    updatedUnlockedClasses,
    canNowPlay: getAvailableClasses(newLevel)
  };
};

// ===============================
// DASHBOARD INTEGRATION
// ===============================

// Generate dashboard corps cards with proper status
export const generateCorpsCards = (userProfile) => {
  const classSelectionData = getClassSelectionData(userProfile);
  
  return classSelectionData.map(classInfo => ({
    ...classInfo,
    
    // Action buttons based on status
    primaryAction: (() => {
      switch (classInfo.status) {
        case 'available': return { label: 'Create Corps', action: 'create', style: 'primary' };
        case 'active': return { label: 'Manage Corps', action: 'edit', style: 'secondary' };
        case 'locked': return { label: 'Unlock Required', action: 'info', style: 'disabled' };
        default: return { label: 'View', action: 'view', style: 'outline' };
      }
    })(),
    
    // Secondary actions
    secondaryActions: (() => {
      const actions = [];
      if (classInfo.status === 'active') {
        actions.push({ label: 'View Details', action: 'view' });
        actions.push({ label: 'Edit Lineup', action: 'edit' });
      }
      if (classInfo.status === 'available') {
        actions.push({ label: 'Preview Requirements', action: 'preview' });
      }
      return actions;
    })(),
    
    // Progress indicators
    progressIndicators: {
      unlock: {
        percentage: classInfo.unlockProgress,
        label: classInfo.isUnlocked ? 'Unlocked' : `Level ${classInfo.unlockLevel} required`
      },
      lineup: classInfo.corps ? {
        percentage: (Object.keys(classInfo.corps.lineup || {}).length / 8) * 100,
        label: `${Object.keys(classInfo.corps.lineup || {}).length}/8 positions filled`
      } : null,
      staff: classInfo.corps ? {
        percentage: (Object.keys(classInfo.corps.staffLineup || {}).length / 8) * 100,
        label: `${Object.keys(classInfo.corps.staffLineup || {}).length}/8 staff hired`
      } : null
    }
  }));
};

// ===============================
// EXPORT UTILITIES
// ===============================

export default {
  CORPS_CLASS_PROGRESSION,
  getAvailableClasses,
  getPlayableClasses,
  canCreateCorps,
  getNextClassToUnlock,
  calculateXPForLevel,
  getClassSelectionData,
  getUserCorpsSummary,
  validateClassAction,
  processLevelUp,
  generateCorpsCards
};