/**
 * useGuestPreview Hook - Guest Preview Mode State Management
 *
 * Manages the guest preview experience for unauthenticated users.
 * Allows visitors to experience the dashboard with demo data before registering.
 * Persists guest modifications (like lineup changes) in localStorage.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DEMO_CORPS,
  DEMO_PROFILE,
  DEMO_SEASON,
  DEMO_CORPS_STATS,
  DEMO_RECENT_SCORES,
  DEMO_UPCOMING_SHOWS,
  DEMO_LEADERBOARD_POSITION,
} from '../data/demoCorps';

// =============================================================================
// STORAGE KEYS
// =============================================================================

const STORAGE_KEYS = {
  GUEST_CORPS: 'marching_art_guest_corps',
  GUEST_LINEUP: 'marching_art_guest_lineup',
  GUEST_STARTED: 'marching_art_guest_started',
  GUEST_INTERACTIONS: 'marching_art_guest_interactions',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Safely get data from localStorage with JSON parsing
 */
function getStoredData(key, defaultValue) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Safely set data in localStorage with JSON stringification
 */
function setStoredData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// GUEST PREVIEW HOOK
// =============================================================================

export function useGuestPreview() {
  // Track if guest has started the preview (for analytics)
  const [hasStartedPreview, setHasStartedPreview] = useState(false);

  // Guest's modified lineup (persisted to localStorage)
  const [guestLineup, setGuestLineup] = useState(null);

  // Track guest interactions for showing registration prompts
  const [interactions, setInteractions] = useState({
    lineupClicks: 0,
    leagueClicks: 0,
    showClicks: 0,
    totalClicks: 0,
    lastInteraction: null,
  });

  // Loading state
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage
  useEffect(() => {
    const started = getStoredData(STORAGE_KEYS.GUEST_STARTED, false);
    const lineup = getStoredData(STORAGE_KEYS.GUEST_LINEUP, null);
    const storedInteractions = getStoredData(STORAGE_KEYS.GUEST_INTERACTIONS, null);

    setHasStartedPreview(started);
    setGuestLineup(lineup);
    if (storedInteractions) {
      setInteractions(storedInteractions);
    }
    setIsLoading(false);
  }, []);

  // =============================================================================
  // GUEST PREVIEW ACTIONS
  // =============================================================================

  /**
   * Start the guest preview experience
   * Called when user clicks "Try Demo" or "Preview"
   */
  const startPreview = useCallback(() => {
    setHasStartedPreview(true);
    setStoredData(STORAGE_KEYS.GUEST_STARTED, true);
  }, []);

  /**
   * Track an interaction (for showing registration prompts at the right time)
   */
  const trackInteraction = useCallback((type) => {
    setInteractions((prev) => {
      const updated = {
        ...prev,
        totalClicks: prev.totalClicks + 1,
        lastInteraction: Date.now(),
      };

      // Track specific interaction types
      switch (type) {
        case 'lineup':
          updated.lineupClicks = (prev.lineupClicks || 0) + 1;
          break;
        case 'league':
          updated.leagueClicks = (prev.leagueClicks || 0) + 1;
          break;
        case 'show':
          updated.showClicks = (prev.showClicks || 0) + 1;
          break;
        default:
          break;
      }

      setStoredData(STORAGE_KEYS.GUEST_INTERACTIONS, updated);
      return updated;
    });
  }, []);

  /**
   * Update the guest's lineup (demo modification)
   * This allows guests to "play" with lineup selection
   */
  const updateGuestLineup = useCallback((caption, value) => {
    setGuestLineup((prev) => {
      const currentLineup = prev || DEMO_CORPS.lineup;
      const updated = {
        ...currentLineup,
        [caption]: value,
      };
      setStoredData(STORAGE_KEYS.GUEST_LINEUP, updated);
      return updated;
    });
  }, []);

  /**
   * Reset the guest preview to default state
   */
  const resetPreview = useCallback(() => {
    setGuestLineup(null);
    setInteractions({
      lineupClicks: 0,
      leagueClicks: 0,
      showClicks: 0,
      totalClicks: 0,
      lastInteraction: null,
    });

    localStorage.removeItem(STORAGE_KEYS.GUEST_LINEUP);
    localStorage.removeItem(STORAGE_KEYS.GUEST_INTERACTIONS);
    // Note: We don't remove GUEST_STARTED so we know they've seen the preview
  }, []);

  /**
   * Clear all guest data (called after successful registration)
   */
  const clearGuestData = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
    setHasStartedPreview(false);
    setGuestLineup(null);
    setInteractions({
      lineupClicks: 0,
      leagueClicks: 0,
      showClicks: 0,
      totalClicks: 0,
      lastInteraction: null,
    });
  }, []);

  // =============================================================================
  // COMPUTED DEMO DATA
  // =============================================================================

  /**
   * Get the current demo corps with any guest modifications
   */
  const demoCorps = useMemo(() => {
    if (!guestLineup) return DEMO_CORPS;
    return {
      ...DEMO_CORPS,
      lineup: guestLineup,
    };
  }, [guestLineup]);

  /**
   * Get the full demo profile with current corps data
   */
  const demoProfile = useMemo(() => ({
    ...DEMO_PROFILE,
    corps: {
      ...DEMO_PROFILE.corps,
      world: demoCorps,
    },
  }), [demoCorps]);

  /**
   * Should we prompt for registration?
   * After N interactions, we show a soft prompt
   */
  const shouldPromptRegistration = useMemo(() => {
    // Prompt after 3 lineup clicks, 2 league clicks, or 5 total interactions
    return (
      interactions.lineupClicks >= 3 ||
      interactions.leagueClicks >= 2 ||
      interactions.totalClicks >= 5
    );
  }, [interactions]);

  /**
   * Has the user been engaged enough to show a "save progress" prompt?
   */
  const hasEngaged = useMemo(() => {
    return interactions.totalClicks >= 2 || guestLineup !== null;
  }, [interactions.totalClicks, guestLineup]);

  // =============================================================================
  // RETURN VALUES
  // =============================================================================

  return {
    // State
    isLoading,
    hasStartedPreview,
    guestLineup,
    interactions,

    // Demo data (read-only)
    demoCorps,
    demoProfile,
    demoSeason: DEMO_SEASON,
    demoStats: DEMO_CORPS_STATS,
    demoRecentScores: DEMO_RECENT_SCORES,
    demoUpcomingShows: DEMO_UPCOMING_SHOWS,
    demoLeaderboardPosition: DEMO_LEADERBOARD_POSITION,

    // Computed
    shouldPromptRegistration,
    hasEngaged,

    // Actions
    startPreview,
    trackInteraction,
    updateGuestLineup,
    resetPreview,
    clearGuestData,
  };
}

export default useGuestPreview;
