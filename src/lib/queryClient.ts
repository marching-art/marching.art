// React Query client configuration
// This module sets up and exports the QueryClient for data fetching

import { QueryClient } from '@tanstack/react-query';

/**
 * Smart retry function that skips retrying 4xx client errors
 * 4xx errors are client errors that won't succeed on retry:
 * - 400 Bad Request
 * - 401 Unauthorized
 * - 403 Forbidden
 * - 404 Not Found
 * - 409 Conflict
 * etc.
 */
const shouldRetry = (failureCount: number, error: unknown): boolean => {
  // Max 3 retries
  if (failureCount >= 3) return false;

  // Check for HTTP status code in various error formats
  const status =
    (error as { status?: number })?.status ||
    (error as { response?: { status?: number } })?.response?.status ||
    (error as { code?: string })?.code;

  // Don't retry 4xx client errors - they won't succeed on retry
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return false;
  }

  // Don't retry Firebase "permission-denied" or "not-found" errors
  if (status === 'permission-denied' || status === 'not-found' || status === 'unauthenticated') {
    return false;
  }

  // Retry other errors (5xx server errors, network errors, etc.)
  return true;
};

// Create a client with sensible defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh for 5 minutes
      staleTime: 5 * 60 * 1000,

      // Cache data for 30 minutes
      gcTime: 30 * 60 * 1000,

      // Smart retry: skip 4xx client errors, retry 5xx/network errors up to 3 times
      retry: shouldRetry,

      // Don't refetch on window focus (user might be in the middle of something)
      refetchOnWindowFocus: false,

      // Enable refetch on reconnect
      refetchOnReconnect: true,
    },
    mutations: {
      // Smart retry for mutations too
      retry: (failureCount, error) => shouldRetry(failureCount, error) && failureCount < 1,
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
  leagueActivity: (leagueId: string) => ['leagueActivity', leagueId] as const,

  // Notification queries
  leagueNotifications: (uid: string) => ['leagueNotifications', uid] as const,
  unreadNotificationCount: (uid: string) => ['unreadNotificationCount', uid] as const,

  // Staff queries
  staffMarketplace: () => ['staffMarketplace'] as const,
  staffAuctions: () => ['staffAuctions'] as const,
};
