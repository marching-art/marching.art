// src/hooks/useSeason.js
import { useSeasonStore } from '../store/seasonStore';

/**
 * Hook to access current season data in real-time.
 *
 * Reads from the global seasonStore, which maintains a single Firestore
 * listener (initialized at app startup) and derives currentDay/currentWeek
 * from the one canonical source (utils/seasonProgress, mirroring the backend
 * game-day math). Consuming currentDay/currentWeek from here guarantees every
 * screen agrees on the season clock instead of recomputing it locally.
 *
 * @returns {Object} { seasonData, loading, error, weeksRemaining, currentDay, currentWeek }
 */
export const useSeason = () => {
  const seasonData = useSeasonStore((state) => state.seasonData);
  const loading = useSeasonStore((state) => state.loading);
  const error = useSeasonStore((state) => state.error);
  const weeksRemaining = useSeasonStore((state) => state.weeksRemaining);
  const currentDay = useSeasonStore((state) => state.currentDay);
  const currentWeek = useSeasonStore((state) => state.currentWeek);

  return {
    seasonData,
    loading,
    error,
    weeksRemaining,
    currentDay,
    currentWeek,
  };
};

export default useSeason;
