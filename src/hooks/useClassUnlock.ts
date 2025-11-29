// =============================================================================
// CLASS UNLOCK HOOK
// =============================================================================
// Tracks when new corps classes are unlocked
// Usage: const { newlyUnlockedClass, clearNewlyUnlockedClass } = useClassUnlock(profile);

import { useState, useEffect, useCallback, useRef } from 'react';
import type { UserProfile, CorpsClass } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface UseClassUnlockReturn {
  newlyUnlockedClass: CorpsClass | null;
  clearNewlyUnlockedClass: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useClassUnlock(profile: UserProfile | null): UseClassUnlockReturn {
  const [newlyUnlockedClass, setNewlyUnlockedClass] = useState<CorpsClass | null>(null);
  const previousUnlockedClassesRef = useRef<CorpsClass[]>([]);

  // Detect when a new class is unlocked
  useEffect(() => {
    if (!profile?.unlockedClasses) return;

    const currentUnlocked = profile.unlockedClasses;
    const previousUnlocked = previousUnlockedClassesRef.current;

    // Only check for new classes if we have previous data
    if (previousUnlocked.length > 0) {
      const newlyUnlocked = currentUnlocked.filter(
        (classId) => !previousUnlocked.includes(classId)
      );

      if (newlyUnlocked.length > 0) {
        setNewlyUnlockedClass(newlyUnlocked[0]);
      }
    }

    // Update previous reference
    previousUnlockedClassesRef.current = currentUnlocked;
  }, [profile?.unlockedClasses]);

  const clearNewlyUnlockedClass = useCallback(() => {
    setNewlyUnlockedClass(null);
  }, []);

  return {
    newlyUnlockedClass,
    clearNewlyUnlockedClass,
  };
}

export default useClassUnlock;
