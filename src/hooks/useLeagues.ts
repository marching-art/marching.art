// useLeagues - React Query hooks for league data
// Provides cached league data with real-time updates via subscriptions

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '../lib/queryClient';
import * as leaguesApi from '../api/leagues';
import type { LeagueCreationData } from '../types';
import toast from 'react-hot-toast';

/**
 * Hook to fetch leagues the user is a member of
 */
export function useMyLeagues(uid: string | undefined) {
  return useQuery({
    queryKey: queryKeys.myLeagues(uid || ''),
    queryFn: () => leaguesApi.getMyLeagues(uid!),
    enabled: !!uid,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to fetch public leagues with pagination
 */
export function usePublicLeagues(pageSize = 12) {
  return useInfiniteQuery({
    queryKey: queryKeys.publicLeagues(),
    queryFn: ({ pageParam }: { pageParam: unknown }) =>
      leaguesApi.getPublicLeagues(pageSize, pageParam),
    initialPageParam: undefined as unknown,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.lastDoc : undefined,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch a single league
 */
export function useLeague(leagueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.league(leagueId || ''),
    queryFn: () => leaguesApi.getLeague(leagueId!),
    enabled: !!leagueId,
    staleTime: 60 * 1000, // League data stays fresh for 1 minute
  });
}

/**
 * Hook to subscribe to real-time league updates
 * This updates the React Query cache when league data changes
 */
export function useLeagueSubscription(leagueId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!leagueId) return;

    const unsubscribe = leaguesApi.subscribeToLeague(
      leagueId,
      (league) => {
        queryClient.setQueryData(queryKeys.league(leagueId), league);
      },
      (error) => {
        console.error('League subscription error:', error);
        toast.error('Lost connection to league updates. Data may be stale.');
      }
    );

    return () => unsubscribe();
  }, [leagueId, queryClient]);
}

/**
 * Hook to fetch league standings
 */
export function useLeagueStandings(leagueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.leagueStandings(leagueId || ''),
    queryFn: () => leaguesApi.getLeagueStandings(leagueId!),
    enabled: !!leagueId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to create a new league
 */
export function useCreateLeague() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LeagueCreationData) => leaguesApi.createLeague(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.publicLeagues() });
    },
    onError: (error: Error) => {
      console.error('Create league error:', error);
      toast.error('Failed to create league. Please try again.');
    },
  });
}

/**
 * Hook to join a league by ID
 */
export function useJoinLeague(uid: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leagueId: string) => leaguesApi.joinLeague(leagueId),
    onSuccess: () => {
      if (uid) {
        queryClient.invalidateQueries({ queryKey: queryKeys.myLeagues(uid) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.publicLeagues() });
    },
    onError: (error: Error) => {
      console.error('Join league error:', error);
      toast.error('Failed to join league. You may already be a member.');
    },
  });
}

/**
 * Hook to join a league by invite code
 */
export function useJoinLeagueByCode(uid: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteCode: string) => leaguesApi.joinLeagueByCode(inviteCode),
    onSuccess: () => {
      if (uid) {
        queryClient.invalidateQueries({ queryKey: queryKeys.myLeagues(uid) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.publicLeagues() });
    },
    onError: (error: Error) => {
      console.error('Join league by code error:', error);
      toast.error('Invalid invite code or league not found.');
    },
  });
}

/**
 * Hook to leave a league
 */
export function useLeaveLeague(uid: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leagueId: string) => leaguesApi.leaveLeague(leagueId),
    onSuccess: () => {
      if (uid) {
        queryClient.invalidateQueries({ queryKey: queryKeys.myLeagues(uid) });
      }
    },
  });
}
