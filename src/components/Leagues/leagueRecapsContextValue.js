// src/components/Leagues/leagueRecapsContextValue.js
// Recaps context + consumer hook live outside LeagueRecapsContext.jsx so that
// file only exports components, which keeps Vite's fast refresh working
// (react-refresh/only-export-components). The provider value is supplied by
// <LeagueRecapsProvider /> in LeagueRecapsContext.jsx.

import { createContext, useContext } from 'react';

export const LeagueRecapsContext = createContext(null);

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
