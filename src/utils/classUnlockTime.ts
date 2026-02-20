// =============================================================================
// TIME-BASED CLASS UNLOCK UTILITY
// =============================================================================
// Classes can be unlocked by time elapsed since user registration,
// in addition to XP levels and CorpsCoin purchases.
//
// A Class: unlocks after 5 weeks
// Open Class: unlocks after 12 weeks
// World Class: unlocks after 19 weeks

import type { Timestamp } from 'firebase/firestore';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Weeks after registration when each class auto-unlocks */
export const CLASS_UNLOCK_WEEKS: Record<string, number> = {
  aClass: 5,
  open: 12,
  world: 19,
};

const MILLIS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert a Firestore Timestamp or Date to a Date object
 */
function toDate(value: Timestamp | Date | string | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  // Firestore Timestamp
  if (typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate();
  }
  return null;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get the number of full weeks since a user registered.
 */
export function getWeeksSinceRegistration(
  createdAt: Timestamp | Date | string | undefined | null
): number {
  const date = toDate(createdAt);
  if (!date) return 0;
  const elapsed = Date.now() - date.getTime();
  return Math.floor(elapsed / MILLIS_PER_WEEK);
}

/**
 * Get the number of weeks remaining until a specific class auto-unlocks.
 * Returns 0 if already eligible, null if class key is invalid.
 */
export function getWeeksUntilUnlock(
  createdAt: Timestamp | Date | string | undefined | null,
  classKey: string
): number | null {
  const requiredWeeks = CLASS_UNLOCK_WEEKS[classKey];
  if (requiredWeeks === undefined) return null;

  const weeksSince = getWeeksSinceRegistration(createdAt);
  return Math.max(0, requiredWeeks - weeksSince);
}

/**
 * Determine which classes should be unlocked based on time elapsed
 * since registration. Returns an array of class keys that are
 * time-eligible for unlock (always includes 'soundSport').
 */
export function getTimeUnlockedClasses(
  createdAt: Timestamp | Date | string | undefined | null
): string[] {
  const unlocked: string[] = ['soundSport'];
  const weeksSince = getWeeksSinceRegistration(createdAt);

  if (weeksSince >= CLASS_UNLOCK_WEEKS.aClass) unlocked.push('aClass');
  if (weeksSince >= CLASS_UNLOCK_WEEKS.open) unlocked.push('open');
  if (weeksSince >= CLASS_UNLOCK_WEEKS.world) unlocked.push('world');

  return unlocked;
}

/**
 * Given a user's current unlockedClasses array and their createdAt date,
 * return the merged array including any classes that should now be
 * time-unlocked. Returns null if no changes are needed.
 */
export function mergeTimeUnlockedClasses(
  currentUnlocked: string[],
  createdAt: Timestamp | Date | string | undefined | null
): string[] | null {
  const timeEligible = getTimeUnlockedClasses(createdAt);
  const newClasses = timeEligible.filter(
    (cls) => !currentUnlocked.includes(cls)
  );

  if (newClasses.length === 0) return null;

  return [...currentUnlocked, ...newClasses];
}
