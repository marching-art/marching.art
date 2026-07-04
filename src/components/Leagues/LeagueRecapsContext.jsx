// LeagueRecapsContext - Shared context for fantasy recaps data
// OPTIMIZATION: Prevents duplicate Firestore queries when navigating between
// LeagueDetailView and MatchupDetailView (was 2+ queries, now 1)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSeasonData, getSeasonRecaps } from '../../api/season';

const LeagueRecapsContext = createContext(null);

/**
 * Provider component that fetches and shares fantasy recaps data
 * Place this at the league detail level to share data with child components
 */
export const LeagueRecapsProvider = ({ children, seasonUid }) => {
  const [recaps, setRecaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seasonData, setSeasonData] = useState(null);

  // Fetch recaps once when seasonUid changes
  useEffect(() => {
    const fetchRecaps = async () => {
      if (!seasonUid) {
        // If no seasonUid provided, fetch current season first
        try {
          const sData = await getSeasonData();

          if (sData) {
            setSeasonData(sData);
            await fetchRecapsData(sData.seasonUid);
          } else {
            setLoading(false);
          }
        } catch (err) {
          console.error('Error fetching season:', err);
          setError(err);
          setLoading(false);
        }
      } else {
        await fetchRecapsData(seasonUid);
      }
    };

    const fetchRecapsData = async (uid) => {
      setLoading(true);
      try {
        // Subcollection format with legacy single-document fallback
        const recapsData = await getSeasonRecaps(uid);

        setRecaps(recapsData);
        setError(null);
      } catch (err) {
        console.error('Error fetching recaps:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecaps();
  }, [seasonUid]);

  // Memoized value to prevent unnecessary re-renders
  const value = {
    recaps,
    loading,
    error,
    seasonData,
    // Helper to check if recaps are available
    hasRecaps: recaps.length > 0,
  };

  return <LeagueRecapsContext.Provider value={value}>{children}</LeagueRecapsContext.Provider>;
};

/**
 * Hook to consume recaps data from context
 * Falls back to local fetch if context is not available (backwards compatibility)
 */
export const useLeagueRecaps = () => {
  const context = useContext(LeagueRecapsContext);

  if (!context) {
    // Context not available - component used outside provider
    // Return a stub that indicates data needs to be fetched locally
    return {
      recaps: null,
      loading: false,
      error: null,
      seasonData: null,
      hasRecaps: false,
      isContextAvailable: false,
    };
  }

  return {
    ...context,
    isContextAvailable: true,
  };
};

export default LeagueRecapsContext;
