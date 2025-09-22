// src/utils/profileCompatibility.js
// Corps class definitions and compatibility functions

export const CORPS_CLASSES = {
  aClass: {
    name: 'A Class',
    pointCap: 60,
    description: 'Entry level fantasy drum corps competition',
    unlockLevel: 1,
    unlockXP: 0,
    color: 'bg-green-500',
    features: {
      staffMultiplierCap: 0.05,
      maxStaffMembers: 4,
      tradingEnabled: false
    }
  },
  openClass: {
    name: 'Open Class',
    pointCap: 120,
    description: 'Intermediate level with expanded features',
    unlockLevel: 5,
    unlockXP: 1000,
    color: 'bg-blue-500',
    features: {
      staffMultiplierCap: 0.10,
      maxStaffMembers: 6,
      tradingEnabled: true
    }
  },
  worldClass: {
    name: 'World Class',
    pointCap: 150,
    description: 'Elite level with all premium features',
    unlockLevel: 10,
    unlockXP: 2500,
    color: 'bg-purple-500',
    features: {
      staffMultiplierCap: 0.15,
      maxStaffMembers: 8,
      tradingEnabled: true,
      advancedAnalytics: true,
      aiRecommendations: true
    }
  }
};

// Check if user can access a specific corps class
export function canAccessClass(userLevel, className) {
  const classDetails = CORPS_CLASSES[className];
  if (!classDetails) return false;
  
  return userLevel >= classDetails.unlockLevel;
}

// Get available classes for user level
export function getAvailableClasses(userLevel) {
  return Object.entries(CORPS_CLASSES)
    .filter(([, details]) => userLevel >= details.unlockLevel)
    .map(([key, details]) => ({ key, ...details }));
}

// Get next class to unlock
export function getNextClass(userLevel) {
  const sortedClasses = Object.entries(CORPS_CLASSES)
    .sort(([, a], [, b]) => a.unlockLevel - b.unlockLevel);
  
  for (const [key, details] of sortedClasses) {
    if (userLevel < details.unlockLevel) {
      return { key, ...details };
    }
  }
  
  return null; // All classes unlocked
}

// Calculate XP needed for next class
export function getXPNeededForNextClass(userXP, userLevel) {
  const nextClass = getNextClass(userLevel);
  if (!nextClass) return 0;
  
  return Math.max(0, nextClass.unlockXP - userXP);
}

export default CORPS_CLASSES;