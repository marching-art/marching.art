import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// FIRST VISIT DETECTION HOOK
// =============================================================================
// Differentiates new visitors from returning users using localStorage.
// This enables progressive disclosure: new users see onboarding content,
// returning users get the streamlined data-focused experience they prefer.
//
// Storage key: 'marching_art_visited'
// - Not present or 'false' = first visit
// - 'true' = returning visitor
// =============================================================================

const STORAGE_KEY = 'marching_art_visited';

/**
 * Detects whether the current user is visiting for the first time.
 *
 * @returns {{
 *   isFirstVisit: boolean,
 *   isLoading: boolean,
 *   markAsReturning: () => void,
 *   resetFirstVisit: () => void
 * }}
 *
 * - isFirstVisit: true if user has never visited before
 * - isLoading: true while checking localStorage (prevents flash of wrong content)
 * - markAsReturning: call this when user dismisses onboarding or registers
 * - resetFirstVisit: for testing/debugging only - clears the flag
 */
export function useFirstVisit() {
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Check localStorage on mount
  useEffect(() => {
    try {
      const hasVisited = localStorage.getItem(STORAGE_KEY);
      setIsFirstVisit(hasVisited !== 'true');
    } catch (e) {
      // localStorage unavailable (private browsing, etc.)
      // Default to first visit experience
      console.warn('localStorage unavailable, defaulting to first visit experience');
      setIsFirstVisit(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark user as returning (call on dismiss or after registration)
  const markAsReturning = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
      setIsFirstVisit(false);
    } catch (e) {
      // Silently fail if localStorage unavailable
      console.warn('Could not save visit status to localStorage');
    }
  }, []);

  // Reset for testing/debugging
  const resetFirstVisit = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setIsFirstVisit(true);
    } catch (e) {
      console.warn('Could not reset visit status in localStorage');
    }
  }, []);

  return {
    isFirstVisit,
    isLoading,
    markAsReturning,
    resetFirstVisit,
  };
}
