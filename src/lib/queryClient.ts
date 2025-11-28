// React Query client configuration
// This module sets up and exports the QueryClient for data fetching

import { QueryClient } from '@tanstack/react-query';

// Create a client with sensible defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh for 5 minutes
      staleTime: 5 * 60 * 1000,

      // Cache data for 30 minutes
      gcTime: 30 * 60 * 1000,

      // Retry failed requests 3 times
      retry: 3,

      // Don't refetch on window focus (user might be in the middle of something)
      refetchOnWindowFocus: false,

      // Enable refetch on reconnect
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});

// Query keys for cache management
export const queryKeys = {
  // Profile queries
  profile: (uid: string) => ['profile', uid] as const,
  corps: (uid: string, corpsClass: string) => ['corps', uid, corpsClass] as const,

  // Season queries
  season: () => ['season'] as const,
  fantasyRecaps: (seasonUid: string) => ['fantasyRecaps', seasonUid] as const,

  // Leaderboard queries
  leaderboard: (type: string, corpsClass: string) => ['leaderboard', type, corpsClass] as const,
  lifetimeLeaderboard: (view: string) => ['lifetimeLeaderboard', view] as const,

  // League queries
  myLeagues: (uid: string) => ['myLeagues', uid] as const,
  publicLeagues: () => ['publicLeagues'] as const,
  league: (leagueId: string) => ['league', leagueId] as const,
  leagueStandings: (leagueId: string) => ['leagueStandings', leagueId] as const,
  leagueChat: (leagueId: string) => ['leagueChat', leagueId] as const,
  leagueTrades: (leagueId: string) => ['leagueTrades', leagueId] as const,

  // Staff queries
  staffMarketplace: () => ['staffMarketplace'] as const,
  staffAuctions: () => ['staffAuctions'] as const,
};
