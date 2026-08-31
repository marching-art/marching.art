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
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.lastDoc : undefined),
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
 * Hook to resolve a league's invite code. Legacy league docs carry the code
 * directly; new leagues store it in the member-only meta/private doc, so fall
 * back to fetching that when the doc field is absent.
 */
export function useLeagueInviteCode(
  league: { id?: string; inviteCode?: string } | null | undefined
) {
  const legacyCode = league?.inviteCode;
  const { data } = useQuery({
    queryKey: queryKeys.leagueInviteCode(league?.id || ''),
    queryFn: () => leaguesApi.getLeagueInviteCode(league!.id!),
    enabled: !!league?.id && !legacyCode,
    staleTime: Infinity, // Codes are immutable once created
  });
  return legacyCode ?? data ?? null;
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
export function useCreateLeague(uid: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LeagueCreationData) => leaguesApi.createLeague(data),
    onSuccess: () => {
      if (uid) {
        queryClient.invalidateQueries({ queryKey: queryKeys.myLeagues(uid) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.publicLeagues() });
    },
    // No toast here: the caller (Leagues.handleCreateLeague) surfaces the
    // server's specific message; a second generic toast on top of it read as
    // the app malfunctioning.
    onError: (error: Error) => {
      console.error('Create league error:', error);
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
    // No toast here: Leagues.handleJoinLeague toasts the server's message.
    onError: (error: Error) => {
      console.error('Join league error:', error);
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
    // No toast here: Leagues.handleJoinByCode toasts the server's message
    // (which distinguishes "invalid code" from e.g. "league is full").
    onError: (error: Error) => {
      console.error('Join league by code error:', error);
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

/**
 * Hook for a commissioner to remove a member.
 *
 * Invalidates the league doc and standings: removal rewrites `members`,
 * `seasonActivity`, and the standings table in one server call.
 */
export function useRemoveLeagueMember(leagueId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => leaguesApi.removeLeagueMember(leagueId!, memberId),
    onSuccess: () => {
      if (leagueId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.league(leagueId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.leagueStandings(leagueId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.publicLeagues() });
    },
    // No toast here: the only caller (Leagues/tabs/SettingsTab) catches the
    // rejection to clear its own pending state and toasts there, so raising one
    // from the hook as well showed the same failure twice.
    onError: (error: Error) => {
      console.error('Remove league member error:', error);
    },
  });
}
