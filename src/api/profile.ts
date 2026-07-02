// Profile API - Centralized profile data operations
// Handles all user profile CRUD operations

import {
  doc,
  getDoc,
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
 * Resolve a username via the public `usernames/{username}` lookup collection.
 * Returns `{ found: false }` when the username is unclaimed, or
 * `{ found: true, uid }` when it exists (uid may be null for a malformed
 * record). Errors propagate unchanged so callers can surface their own message.
 */
export async function resolveUsername(
  username: string
): Promise<{ found: boolean; uid: string | null }> {
  const snap = await getDoc(doc(db, 'usernames', username));
  if (!snap.exists()) {
    return { found: false, uid: null };
  }
  return { found: true, uid: snap.data().uid || null };
}

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
//
// NOTE: Profile creation and all economy/progression mutations (XP, level,
// CorpsCoin, class unlocks, stats, trophies) are server-only. They happen in
// Cloud Functions callables (createUserProfile, awardXP, syncClassUnlocks,
// unlockClassWithCorpsCoin, ...) and are blocked for clients by Firestore
// security rules. The helpers below may only touch cosmetic/preference
// fields.
// =============================================================================

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
// CURRENCY
// =============================================================================

/**
 * Check if user can afford a purchase
 */
export async function canAfford(uid: string, cost: number): Promise<boolean> {
  const profile = await getProfile(uid);
  return (profile?.corpsCoin || 0) >= cost;
}
