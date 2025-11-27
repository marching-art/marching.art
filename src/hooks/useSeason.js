// src/hooks/useSeason.js
import { useSeasonStore } from '../store/seasonStore';

/**
 * Hook to access current season data in real-time
 *
 * This hook now uses the global seasonStore to prevent duplicate
 * Firestore listeners across components. The store maintains a single
 * listener that is initialized at app startup.
 *
 * @returns {Object} { seasonData, loading, error, weeksRemaining }
 */
export const useSeason = () => {
  const seasonData = useSeasonStore((state) => state.seasonData);
  const loading = useSeasonStore((state) => state.loading);
  const error = useSeasonStore((state) => state.error);
  const weeksRemaining = useSeasonStore((state) => state.weeksRemaining);

  return {
    seasonData,
    loading,
    error,
    weeksRemaining
  };
};

/**
 * Calculate current day and week of the season
 * @param {Object} seasonData - Season data from Firestore
 * @returns {Object} { currentDay, currentWeek }
 */
export const getSeasonProgress = (seasonData) => {
  if (!seasonData?.schedule?.startDate) {
    return { currentDay: 0, currentWeek: 0 };
  }

  const startDate = seasonData.schedule.startDate.toDate();
  const now = new Date();
  const diffInMillis = now.getTime() - startDate.getTime();
  const currentDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
  const currentWeek = Math.ceil(currentDay / 7);

  return {
    currentDay: Math.max(1, Math.min(currentDay, 49)),
    currentWeek: Math.max(1, Math.min(currentWeek, 7))
  };
};

/**
 * Check if a class registration is locked based on weeks remaining
 * @param {string} corpsClass - Class to check ('soundSport', 'aClass', 'open', 'world')
 * @param {number} weeksRemaining - Weeks until season end
 * @returns {boolean} True if registration is locked
 */
export const isRegistrationLocked = (corpsClass, weeksRemaining) => {
  const locks = {
    world: 6,
    open: 5,
    aClass: 4,
    soundSport: 0
  };

  const lockWeeks = locks[corpsClass] || 0;
  return weeksRemaining < lockWeeks;
};

/**
 * Get season type display information
 * @param {string} status - Season status ('off-season' or 'live-season')
 * @returns {Object} Display info
 */
export const getSeasonTypeInfo = (status) => {
  if (status === 'live-season') {
    return {
      label: 'Live Season',
      color: 'text-red-500',
      bgColor: 'bg-red-500/20',
      description: 'Follow real DCI scores as they happen!'
    };
  }

  return {
    label: 'Off-Season',
    color: 'text-gold-500',
    bgColor: 'bg-gold-500/20',
    description: 'Fantasy competition with historical data'
  };
};

export default useSeason;
