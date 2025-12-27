// Profile API - Centralized profile data operations
// Handles all user profile CRUD operations

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, paths, withErrorHandling } from './client';
import type { UserProfile, CorpsData, CorpsClass, DeepPartial } from '../types';

// =============================================================================
// READ OPERATIONS
// =============================================================================

/**
 * Get a user's profile by UID
 */
export async function getProfile(uid: string): Promise<UserProfile | null> {
  return withErrorHandling(async () => {
    const profileRef = doc(db, paths.userProfile(uid));
    const profileDoc = await getDoc(profileRef);

    if (!profileDoc.exists()) {
      return null;
    }

    return profileDoc.data() as UserProfile;
  }, 'Failed to fetch profile');
}

/**
 * Subscribe to real-time profile updates
 */
export function subscribeToProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const profileRef = doc(db, paths.userProfile(uid));

  return onSnapshot(
    profileRef,
    (doc) => {
      if (doc.exists()) {
        onData(doc.data() as UserProfile);
      } else {
        onData(null);
      }
    },
    (error) => {
      console.error('Profile subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Get a specific corps for a user
 */
export async function getCorps(
  uid: string,
  corpsClass: CorpsClass
): Promise<CorpsData | null> {
  return withErrorHandling(async () => {
    const profile = await getProfile(uid);
    return profile?.corps?.[corpsClass] || null;
  }, 'Failed to fetch corps data');
}

// =============================================================================
// WRITE OPERATIONS
// =============================================================================

/**
 * Create a new user profile
 */
export async function createProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  return withErrorHandling(async () => {
    const profileRef = doc(db, paths.userProfile(uid));
    await setDoc(profileRef, {
      uid,
      createdAt: new Date(),
      xp: 0,
      xpLevel: 1,
      corpsCoin: 1000,
      unlockedClasses: ['soundSport'],
      corps: {},
      userTitle: 'Rookie',
      ...data,
    });
  }, 'Failed to create profile');
}

/**
 * Update a user's profile
 */
export async function updateProfile(
  uid: string,
  updates: DeepPartial<UserProfile>
): Promise<void> {
  return withErrorHandling(async () => {
    const profileRef = doc(db, paths.userProfile(uid));
    await updateDoc(profileRef, updates as Record<string, unknown>);
  }, 'Failed to update profile');
}

/**
 * Update a specific corps within a profile
 */
export async function updateCorps(
  uid: string,
  corpsClass: CorpsClass,
  updates: Partial<CorpsData>
): Promise<void> {
  return withErrorHandling(async () => {
    const profileRef = doc(db, paths.userProfile(uid));
    const updateKey = `corps.${corpsClass}`;

    // Flatten the updates for Firestore dot notation
    const flattenedUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      flattenedUpdates[`${updateKey}.${key}`] = value;
    }

    await updateDoc(profileRef, flattenedUpdates);
  }, 'Failed to update corps');
}

// =============================================================================
// XP & PROGRESSION
// =============================================================================

/**
 * Add XP to a user and handle level ups
 */
export async function addXp(uid: string, amount: number): Promise<{
  newXp: number;
  newLevel: number;
  leveledUp: boolean;
  unlockedClass?: CorpsClass;
}> {
  return withErrorHandling(async () => {
    const profile = await getProfile(uid);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const currentXp = profile.xp || 0;
    const currentLevel = profile.xpLevel || 1;
    const newXp = currentXp + amount;

    // Calculate new level based on XP thresholds
    const newLevel = calculateLevel(newXp);
    const leveledUp = newLevel > currentLevel;

    // Check for class unlocks based on total XP
    // Thresholds: A Class = 300 XP, Open Class = 2000 XP, World Class = 4000 XP
    let unlockedClass: CorpsClass | undefined;
    const unlockedClasses = [...(profile.unlockedClasses || ['soundSport'])];

    if (newXp >= 300 && !unlockedClasses.includes('aClass')) {
      unlockedClasses.push('aClass');
      unlockedClass = 'aClass';
    }
    if (newXp >= 2000 && !unlockedClasses.includes('open')) {
      unlockedClasses.push('open');
      unlockedClass = 'open';
    }
    if (newXp >= 4000 && !unlockedClasses.includes('world')) {
      unlockedClasses.push('world');
      unlockedClass = 'world';
    }

    // Update profile
    await updateProfile(uid, {
      xp: newXp,
      xpLevel: newLevel,
      unlockedClasses,
      userTitle: getLevelTitle(newLevel),
    });

    return { newXp, newLevel, leveledUp, unlockedClass };
  }, 'Failed to add XP');
}

/**
 * Calculate level from XP
 */
function calculateLevel(xp: number): number {
  // XP thresholds for each level
  const thresholds = [
    0,      // Level 1
    100,    // Level 2
    300,    // Level 3 (unlocks A Class)
    600,    // Level 4
    1000,   // Level 5 (unlocks Open Class)
    1500,   // Level 6
    2100,   // Level 7
    2800,   // Level 8
    3600,   // Level 9
    4500,   // Level 10 (unlocks World Class)
    5500,   // Level 11+
  ];

  let level = 1;
  for (let i = 0; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) {
      level = i + 1;
    } else {
      break;
    }
  }

  // Beyond level 11, each level requires 1000 more XP
  if (xp >= thresholds[thresholds.length - 1]) {
    const extraXp = xp - thresholds[thresholds.length - 1];
    level = thresholds.length + Math.floor(extraXp / 1000);
  }

  return level;
}

/**
 * Get title for a given level
 */
function getLevelTitle(level: number): string {
  const titles: Record<number, string> = {
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
  };

  if (level >= 10) return titles[10];
  return titles[level] || 'Rookie';
}

// =============================================================================
// CURRENCY
// =============================================================================

/**
 * Add or subtract CorpsCoin
 */
export async function updateCorpsCoin(
  uid: string,
  amount: number
): Promise<number> {
  return withErrorHandling(async () => {
    const profile = await getProfile(uid);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const currentCoin = profile.corpsCoin || 0;
    const newCoin = Math.max(0, currentCoin + amount);

    await updateProfile(uid, { corpsCoin: newCoin });

    return newCoin;
  }, 'Failed to update CorpsCoin');
}

/**
 * Check if user can afford a purchase
 */
export async function canAfford(uid: string, cost: number): Promise<boolean> {
  const profile = await getProfile(uid);
  return (profile?.corpsCoin || 0) >= cost;
}
