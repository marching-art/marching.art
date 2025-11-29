// useLeaderboard - React Query hooks for leaderboard data
// Provides cached leaderboard data with pagination support

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import * as leaderboardApi from '../api/leaderboard';
import type { LeaderboardType, CorpsClass, LifetimeStats } from '../types';

/**
 * Hook to fetch a paginated leaderboard
 */
export function useLeaderboard(
  type: LeaderboardType,
  corpsClass: CorpsClass,
  pageSize = 25
) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.leaderboard(type, corpsClass), pageSize],
    queryFn: ({ pageParam }) =>
      leaderboardApi.getLeaderboard(type, corpsClass, pageSize, pageParam),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.lastDoc : undefined,
    staleTime: 5 * 60 * 1000, // Leaderboard data stays fresh for 5 minutes
  });
}

/**
 * Hook to fetch lifetime leaderboard
 */
export function useLifetimeLeaderboard(
  sortBy: keyof LifetimeStats = 'totalPoints',
  pageSize = 25
) {
  return useQuery({
    queryKey: queryKeys.lifetimeLeaderboard(sortBy),
    queryFn: () => leaderboardApi.getLifetimeLeaderboard(sortBy, pageSize),
    staleTime: 10 * 60 * 1000, // Lifetime stats stay fresh for 10 minutes
  });
}

/**
 * Hook to fetch a user's rank in a leaderboard
 */
export function useUserRank(
  type: LeaderboardType,
  corpsClass: CorpsClass,
  username: string | undefined
) {
  return useQuery({
    queryKey: [...queryKeys.leaderboard(type, corpsClass), 'userRank', username],
    queryFn: () => leaderboardApi.getUserRank(type, corpsClass, username!),
    enabled: !!username,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get leaderboard stats
 */
export function useLeaderboardStats(type: LeaderboardType, corpsClass: CorpsClass) {
  return useQuery({
    queryKey: [...queryKeys.leaderboard(type, corpsClass), 'stats'],
    queryFn: () => leaderboardApi.getLeaderboardStats(type, corpsClass),
    staleTime: 10 * 60 * 1000,
  });
}
