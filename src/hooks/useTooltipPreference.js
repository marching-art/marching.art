import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// TOOLTIP PREFERENCE HOOK
// =============================================================================
// Manages user preference for showing/hiding jargon tooltips.
// Default: ON for new users, can be toggled in settings.
// Auto-disables after 7 days of use (experienced user heuristic).
//
// Storage keys:
// - marching_art_tooltips_enabled: 'true' | 'false'
// - marching_art_first_seen: timestamp (for auto-disable logic)
// =============================================================================

const STORAGE_KEY_ENABLED = 'marching_art_tooltips_enabled';
const STORAGE_KEY_FIRST_SEEN = 'marching_art_first_seen';
const AUTO_DISABLE_DAYS = 7;

/**
 * Hook for managing tooltip visibility preferences.
 *
 * @returns {{
 *   tooltipsEnabled: boolean,
 *   isLoading: boolean,
 *   setTooltipsEnabled: (enabled: boolean) => void,
 *   toggleTooltips: () => void
 * }}
 */
export function useTooltipPreference() {
  const [tooltipsEnabled, setTooltipsEnabledState] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage
  useEffect(() => {
    try {
      const storedEnabled = localStorage.getItem(STORAGE_KEY_ENABLED);
      const firstSeen = localStorage.getItem(STORAGE_KEY_FIRST_SEEN);
      const now = Date.now();

      // First time seeing tooltips - record timestamp
      if (!firstSeen) {
        localStorage.setItem(STORAGE_KEY_FIRST_SEEN, now.toString());
      }

      // Check if user has explicitly set a preference
      if (storedEnabled !== null) {
        setTooltipsEnabledState(storedEnabled === 'true');
      } else {
        // No explicit preference - check if auto-disable should kick in
        if (firstSeen) {
          const daysSinceFirst = (now - parseInt(firstSeen, 10)) / (1000 * 60 * 60 * 24);
          if (daysSinceFirst >= AUTO_DISABLE_DAYS) {
            // Auto-disable for experienced users
            setTooltipsEnabledState(false);
            localStorage.setItem(STORAGE_KEY_ENABLED, 'false');
          }
        }
      }
    } catch (e) {
      // localStorage unavailable - default to enabled
      console.warn('localStorage unavailable for tooltip preferences');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set preference explicitly
  const setTooltipsEnabled = useCallback((enabled) => {
    try {
      localStorage.setItem(STORAGE_KEY_ENABLED, enabled.toString());
      setTooltipsEnabledState(enabled);
    } catch (e) {
      console.warn('Could not save tooltip preference');
      setTooltipsEnabledState(enabled);
    }
  }, []);

  // Toggle preference
  const toggleTooltips = useCallback(() => {
    setTooltipsEnabled(!tooltipsEnabled);
  }, [tooltipsEnabled, setTooltipsEnabled]);

  return {
    tooltipsEnabled,
    isLoading,
    setTooltipsEnabled,
    toggleTooltips,
  };
}
