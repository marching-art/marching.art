// src/hooks/useLeagueDetail.ts
// Everything the league detail view loads, as one hook.
//
// This replaces a ~300-line useEffect that fetched member profiles, season
// data, matchups and the recap archive, copied all four into useState, and
// recomputed the league tables inline on every run. The reads are now four
// React Query entries (so the cache actually drives re-renders) and the tables
// are a useMemo over pure functions from utils/leagueStats.

import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getMemberProfiles, type LeagueMemberProfile } from '../api/leagues';
import { getSeasonData } from '../api/season';
import { queryKeys } from '../lib/queryClient';
import { getSeasonProgress } from '../utils/seasonProgress';
import {
  computeLeagueTables,
  type LeagueMatchupDoc,
  type LeagueMemberStanding,
  type MatchupsByWeek,
  type WeeklyResults,
} from '../utils/leagueStats';
import { useLeagueMatchups } from './useLeagueMatchups';
import { useLeagueRecaps } from './useLeagueRecaps';
import type { DayRecap } from '../types/recap';

const FIVE_MINUTES = 5 * 60 * 1000;

// Stable empty identities: these feed useMemo dependency lists in
// useLeagueStats and useRivalries, so a fresh `{}` each render would defeat
// their memoization.
const NO_PROFILES: Record<string, LeagueMemberProfile> = {};
const NO_MATCHUPS: MatchupsByWeek = {};
const NO_RESULTS: WeeklyResults = {};
const NO_RECAPS: DayRecap[] = [];
const NO_MATCHUP_DOCS: LeagueMatchupDoc[] = [];
const NO_MEMBERS: string[] = [];

interface LeagueLike {
  id?: string;
  members?: string[];
}

export interface UseLeagueDetailResult {
  memberProfiles: Record<string, LeagueMemberProfile>;
  recaps: DayRecap[];
  currentWeek: number;
  weeklyMatchups: MatchupsByWeek;
  weeklyResults: WeeklyResults;
  /** The computed table, or null when there is nothing to compute from. */
  computedStandings: LeagueMemberStanding[] | null;
  loading: boolean;
  loadError: boolean;
  retry: () => void;
}

/**
 * Load and derive the league detail view's data.
 *
 * Loading/error semantics deliberately match the effect this replaced:
 *  - a league with no members never finishes loading (its queries stay
 *    disabled, which React Query reports as pending);
 *  - a season document that resolves to null skips recaps entirely rather than
 *    hanging on a query that can never run;
 *  - a retry puts the view back into its loading state, hiding the error
 *    banner, and re-toasts if it fails again.
 */
export function useLeagueDetail(league: LeagueLike | null | undefined): UseLeagueDetailResult {
  const leagueId = league?.id;
  const members = league?.members;
  const enabled = !!leagueId && !!members?.length;

  // The membership itself keys the profile cache entry, so a join or leave
  // busts it without any explicit invalidation.
  const membersKey = useMemo(() => (members ? [...members].sort().join(',') : ''), [members]);

  const profilesQuery = useQuery({
    queryKey: queryKeys.leagueMemberProfiles(leagueId || '', membersKey),
    queryFn: () => getMemberProfiles(members!),
    enabled,
    staleTime: FIVE_MINUTES,
  });

  const seasonQuery = useQuery({
    queryKey: queryKeys.season(),
    queryFn: () => getSeasonData(),
    enabled,
    staleTime: FIVE_MINUTES,
  });

  const matchupsQuery = useLeagueMatchups(leagueId, { enabled });

  const seasonData = seasonQuery.data ?? null;
  const seasonUid = seasonData?.seasonUid;
  const recapsEnabled = enabled && !!seasonUid;
  const recapsQuery = useLeagueRecaps(seasonUid, { enabled });

  // Shared 2AM-ET/UTC-normalized week math (utils/seasonProgress) — a raw
  // (now - startDate)/24h count used to roll the week over at midnight UTC
  // (8 PM ET in summer), disagreeing with the seasonStore and the nightly
  // scorer every evening.
  const currentWeek = useMemo(
    () => (seasonData ? Math.max(1, getSeasonProgress(seasonData).currentWeek) : 1),
    [seasonData]
  );

  const recaps = recapsQuery.data ?? NO_RECAPS;
  const matchupDocs = matchupsQuery.data ?? NO_MATCHUP_DOCS;

  // The jank fix: this used to run inline in the fetch effect, walking the
  // whole season archive on the main thread on every load and every retry.
  const tables = useMemo(
    () =>
      computeLeagueTables({
        recaps,
        matchupDocs,
        members: members ?? NO_MEMBERS,
        currentWeek,
      }),
    [recaps, matchupDocs, members, currentWeek]
  );

  const pending =
    profilesQuery.isPending ||
    seasonQuery.isPending ||
    matchupsQuery.isPending ||
    (recapsEnabled && recapsQuery.isPending);

  const isError =
    profilesQuery.isError || seasonQuery.isError || matchupsQuery.isError || recapsQuery.isError;

  const isFetching =
    profilesQuery.isFetching ||
    seasonQuery.isFetching ||
    matchupsQuery.isFetching ||
    recapsQuery.isFetching;

  // A retry is a loading state, not a lingering error state — the banner gives
  // way to the skeletons, exactly as the old `setLoading(true)` did.
  const loading = pending || (isError && isFetching);

  // Surface failures instead of swallowing them to the console: one toast per
  // failed attempt. `errorUpdatedAt` advances on every new failure, which is
  // what distinguishes "still showing the same error" from "the retry failed
  // too" — `isError` alone stays true across both.
  const errorUpdatedAt = Math.max(
    profilesQuery.errorUpdatedAt,
    seasonQuery.errorUpdatedAt,
    matchupsQuery.errorUpdatedAt,
    recapsQuery.errorUpdatedAt
  );
  const error =
    profilesQuery.error || seasonQuery.error || matchupsQuery.error || recapsQuery.error;
  const lastToastedAt = useRef(0);

  useEffect(() => {
    if (!isError || !errorUpdatedAt || errorUpdatedAt === lastToastedAt.current) return;
    lastToastedAt.current = errorUpdatedAt;
    console.error('Error fetching league data:', error);
    toast.error('Could not load league data. Tap retry.');
  }, [isError, errorUpdatedAt, error]);

  const retry = () => {
    void profilesQuery.refetch();
    void seasonQuery.refetch();
    void matchupsQuery.refetch();
    // Refetching a disabled query would fire it with an empty seasonUid.
    if (recapsEnabled) void recapsQuery.refetch();
  };

  return {
    memberProfiles: profilesQuery.data ?? NO_PROFILES,
    recaps,
    currentWeek,
    weeklyMatchups: tables?.weeklyMatchups ?? NO_MATCHUPS,
    weeklyResults: tables?.weeklyResults ?? NO_RESULTS,
    computedStandings: tables?.standings ?? null,
    loading,
    loadError: isError,
    retry,
  };
}
