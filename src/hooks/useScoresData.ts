// src/hooks/useScoresData.ts
// Centralized hook for fetching and processing scores data
// Supports both current season and archived seasons

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getSeasonRecaps,
  getSeasonRecapDay,
  getSeasonChampions,
  getSeasonStandings,
  type SeasonChampions,
  type SeasonStandings,
  type SeasonStandingsEntry,
} from '../api/season';
import { queryKeys } from '../lib/queryClient';
import { useSeasonStore } from '../store/seasonStore';
import { getEffectiveDay } from '../utils/dashboardScoring';
import { competitionDayToDate } from '../utils/competitionCalendar';
import { getScoreValue, normalizeShowResult } from '../utils/recap';
import type {
  CaptionAggregates,
  CaptionRanks,
  NormalizedScore,
  NormalizedShow,
  RecapDate,
} from '../types/recap';
import type { CaptionScores, CorpsClass } from '../types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Minimal shape accepted by the caption/score helpers. Covers raw recap
 * results, normalized score entries, and aggregated leaderboard entries —
 * the legacy field fallbacks themselves live in utils/recap.ts
 * (getScoreValue) and in calculateCaptionAggregates below.
 */
export interface ScoreLike {
  score?: number;
  totalScore?: number;
  geScore?: number;
  visualScore?: number;
  musicScore?: number;
  captions?: CaptionScores | null;
}

export interface TrendResult {
  trend: 'up' | 'down' | 'stable';
  values: number[];
  direction: number;
}

export interface ColumnStats {
  avg: number;
  top10: number;
  bottom10: number;
}

/** A normalized score entry annotated with the show it came from. */
export type AggregatedScoreEntry = NormalizedScore & {
  eventName: string;
  date: string;
  offSeasonDay: number;
};

/** One corps' leaderboard row on the Scores page. */
export type LeaderboardEntry = {
  corps: string;
  corpsName: string;
  corpsClass: CorpsClass;
  uid: string;
  displayName?: string;
  avatarUrl: string | null;
  scores: AggregatedScoreEntry[];
  totalScore: number;
  showCount: number;
  rank: number;
  score: number;
  trend: TrendResult;
} & CaptionAggregates;

export interface ScoresStats {
  recentShows: number;
  topScore: string;
  corpsActive: number;
  avgScore: string;
}

export interface UseScoresDataOptions {
  seasonId?: string | null;
  classFilter?: string;
  disableArchiveFallback?: boolean;
  /**
   * When true AND the materialized standings cover the season, the full
   * recap-subcollection download is skipped entirely — standings supply the
   * leaderboard/stats/days and `allShows` returns []. Pass this when the
   * visible view doesn't render per-show sheets (the Scores class tabs and
   * the lazy recap view, which fetches single days via useDayRecapShows).
   */
  skipShows?: boolean;
}

/** Recap-ish input for formatRecapDate (also accepts the Podium day shim). */
interface RecapDateSource {
  offSeasonDay?: number | null;
  date?: RecapDate | null;
}

/** `game-settings/season`'s schedule object as competitionDayToDate reads it. */
type SeasonScheduleLike =
  { startDate?: unknown; springTrainingDays?: number; [key: string]: unknown } | null | undefined;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Resolve the display date for a recap day.
 *
 * When the season schedule is known (the live/current season), derive the date
 * from the competition day via the shared spring-training-aware helper. This
 * corrects live-season recaps whose stored `date` was written without the
 * spring-training offset (competition day 1 falls 21 calendar days after
 * startDate, not on startDate). Off-season and archived recaps have no spring
 * training and a correct stored date, so they fall back to the persisted value.
 */
export const formatRecapDate = (
  recap: RecapDateSource | null | undefined,
  seasonSchedule: SeasonScheduleLike
): string => {
  if (typeof recap?.offSeasonDay === 'number') {
    const eventDate = competitionDayToDate(seasonSchedule, recap.offSeasonDay);
    if (eventDate) return eventDate.toLocaleDateString('en-US');
  }
  // Only Timestamp-bearing recaps carry a usable stored date here (legacy
  // string/Date values fall through to 'TBD', matching the original
  // `date?.toDate?.()` chain).
  const stored = recap?.date;
  if (stored && typeof stored === 'object' && 'toDate' in stored) {
    return stored.toDate().toLocaleDateString('en-US', { timeZone: 'UTC' });
  }
  return 'TBD';
};

/**
 * Calculate caption aggregates from a score sheet
 * Returns GE_Total, VIS_Total, MUS_Total, and Total_Score
 */
export const calculateCaptionAggregates = (
  scoreSheet: ScoreLike | null | undefined
): CaptionAggregates => {
  if (!scoreSheet) {
    return { GE_Total: 0, VIS_Total: 0, MUS_Total: 0, Total_Score: 0 };
  }

  // Handle detailed captions (historical data with individual caption scores)
  if (scoreSheet.captions && Object.keys(scoreSheet.captions).length > 0) {
    const captions = scoreSheet.captions;

    // General Effect: GE1 + GE2 (max 40 points total)
    const GE_Total = (captions.GE1 || 0) + (captions.GE2 || 0);

    // Visual: VP + VA + CG (max 30 points, averaged to ~15 for display)
    const VIS_Total = (captions.VP || 0) + (captions.VA || 0) + (captions.CG || 0);

    // Music: B + MA + P (max 30 points, averaged to ~15 for display)
    const MUS_Total = (captions.B || 0) + (captions.MA || 0) + (captions.P || 0);

    // Total score (legacy score/totalScore fallback via getScoreValue)
    const Total_Score = getScoreValue(scoreSheet) || GE_Total + VIS_Total + MUS_Total;

    return { GE_Total, VIS_Total, MUS_Total, Total_Score };
  }

  // Handle aggregate scores (fantasy data with pre-calculated totals)
  return {
    GE_Total: scoreSheet.geScore || 0,
    VIS_Total: scoreSheet.visualScore || 0,
    MUS_Total: scoreSheet.musicScore || 0,
    Total_Score: getScoreValue(scoreSheet),
  };
};

/**
 * Calculate statistics for a column of scores
 * Returns average, percentile thresholds for heatmap coloring
 */
export const calculateColumnStats = (
  scores: ScoreLike[] | null | undefined,
  key: keyof CaptionAggregates
): ColumnStats => {
  if (!scores || scores.length === 0) {
    return { avg: 0, top10: 0, bottom10: 0 };
  }

  const values = scores
    .map((s) => {
      const aggregates = calculateCaptionAggregates(s);
      return aggregates[key] || 0;
    })
    .filter((v) => v > 0);

  if (values.length === 0) {
    return { avg: 0, top10: 0, bottom10: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const top10Index = Math.floor(sorted.length * 0.9);
  const bottom10Index = Math.floor(sorted.length * 0.1);

  return {
    avg,
    top10: sorted[top10Index] || sorted[sorted.length - 1],
    bottom10: sorted[bottom10Index] || sorted[0],
  };
};

/**
 * Determine heatmap color class based on score deviation
 */
export const getHeatmapColor = (value: number, stats: ColumnStats | null | undefined): string => {
  if (!stats || value === 0) return '';

  if (value >= stats.top10) {
    return 'text-green-400';
  } else if (value <= stats.bottom10) {
    return 'text-red-400';
  }
  return '';
};

/**
 * Calculate trend from most recent N scores (for sparkline)
 * Note: scoreHistory is ordered with most recent first (index 0 = newest)
 */
export const calculateTrend = (
  scoreHistory: ScoreLike[] | null | undefined,
  count = 5
): TrendResult => {
  if (!scoreHistory || scoreHistory.length < 2) {
    return { trend: 'stable', values: [], direction: 0 };
  }

  // Get the most recent N scores (first N elements since array is newest-first)
  const recent = scoreHistory.slice(0, count);
  const values = recent.map((s) => getScoreValue(s));

  // values[0] = most recent, values[length-1] = oldest in this window
  const newest = values[0];
  const oldest = values[values.length - 1];

  // Calculate trend: positive if scores are improving (newest > oldest)
  const direction = oldest > 0 ? (newest - oldest) / oldest : 0;

  let trend: TrendResult['trend'] = 'stable';
  if (direction > 0.02) trend = 'up';
  else if (direction < -0.02) trend = 'down';

  // Reverse values for sparkline display (chronological: oldest to newest)
  return { trend, values: [...values].reverse(), direction };
};

/**
 * Generate sparkline SVG path from values
 */
export const generateSparklinePath = (
  values: number[] | null | undefined,
  width = 60,
  height = 20
): string => {
  if (!values || values.length < 2) return '';

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });

  return `M ${points.join(' L ')}`;
};

/**
 * Calculate rank within a specific caption category
 * Optimized: Uses index-based sorting for reduced memory allocation
 *
 * Previous approach: 3 full array copies for sorting + 3 Maps + final map
 * New approach: 3 small [value, index] arrays + direct rank assignment
 *
 * Memory improvement: Sorts lightweight tuples instead of full score objects
 * Speed improvement: Direct index assignment vs Map creation + lookups
 */
export const calculateCaptionRanks = <T extends CaptionAggregates>(
  scores: T[] | null | undefined
): Array<T & CaptionRanks> => {
  if (!scores || scores.length === 0) return [];

  const n = scores.length;

  // Create lightweight [value, originalIndex] tuples for sorting
  // Much more memory-efficient than copying full score objects
  const geIndices: Array<[number, number]> = new Array(n);
  const visIndices: Array<[number, number]> = new Array(n);
  const musIndices: Array<[number, number]> = new Array(n);

  // Single pass to extract all caption values with their indices
  for (let i = 0; i < n; i++) {
    const s = scores[i];
    geIndices[i] = [s.GE_Total || 0, i];
    visIndices[i] = [s.VIS_Total || 0, i];
    musIndices[i] = [s.MUS_Total || 0, i];
  }

  // Sort by value descending (higher score = better rank)
  // Sorting small tuples is faster than sorting objects with many properties
  const compareDesc = (a: [number, number], b: [number, number]) => b[0] - a[0];
  geIndices.sort(compareDesc);
  visIndices.sort(compareDesc);
  musIndices.sort(compareDesc);

  // Create result array once, then assign all ranks directly
  // Avoids creating intermediate Maps and doing Map lookups
  const results = scores.map((s) => ({ ...s })) as Array<T & CaptionRanks>;

  // Assign ranks via direct index access (O(1) per assignment)
  for (let rank = 0; rank < n; rank++) {
    results[geIndices[rank][1]].GE_Rank = rank + 1;
    results[visIndices[rank][1]].VIS_Rank = rank + 1;
    results[musIndices[rank][1]].MUS_Rank = rank + 1;
  }

  return results;
};

/**
 * Normalize one recap day doc into the NormalizedShow[] shape the score
 * views consume. Shared by the season-wide memo below and the single-day
 * lazy hook (useDayRecapShows).
 */
export const normalizeRecapToShows = (
  recap: {
    offSeasonDay: number;
    date?: RecapDate | null;
    shows?: Array<{
      eventName: string;
      location: string;
      results?: Parameters<typeof normalizeShowResult>[0][];
    }>;
  },
  seasonId: string,
  seasonSchedule: SeasonScheduleLike
): NormalizedShow[] => {
  const recapDate = formatRecapDate(recap, seasonSchedule);
  return (
    recap.shows?.map((show) => ({
      eventName: show.eventName,
      location: show.location,
      date: recapDate,
      offSeasonDay: recap.offSeasonDay,
      seasonId,
      scores:
        show.results
          ?.map((result) => normalizeShowResult(result))
          .sort((a, b) => b.score - a.score) || [],
    })) || []
  );
};

/**
 * Convert materialized standings entries into the LeaderboardEntry shape the
 * class-standings views consume. History items are hydrated with the entry's
 * identity fields so consumers that read scores[0]/scores[1] (caption
 * breakdowns, rank deltas, sparklines) see the same shape the client-side
 * aggregation produced.
 */
const standingsToLeaderboard = (
  classes: Record<string, SeasonStandingsEntry[]>
): LeaderboardEntry[] => {
  const CLASS_ORDER = ['worldClass', 'openClass', 'aClass'];
  const ordered = [
    ...CLASS_ORDER.filter((cls) => classes[cls]),
    ...Object.keys(classes).filter((cls) => !CLASS_ORDER.includes(cls)),
  ];
  return ordered.flatMap((cls) =>
    (classes[cls] || []).map((entry) => ({
      ...entry,
      corpsClass: entry.corpsClass as CorpsClass,
      scores: entry.scores.map((h) => ({
        ...h,
        corps: entry.corps,
        corpsName: entry.corpsName,
        uid: entry.uid,
        displayName: entry.displayName,
        avatarUrl: entry.avatarUrl,
        corpsClass: entry.corpsClass as CorpsClass,
        captions: {} as CaptionScores,
        eventName: '',
        date: '',
      })),
    }))
  );
};

/**
 * Main hook for scores data
 */
export const useScoresData = (options: UseScoresDataOptions = {}) => {
  const {
    seasonId = null,
    classFilter = 'all',
    disableArchiveFallback = false,
    skipShows = false,
  } = options;

  const currentSeasonUid = useSeasonStore((state) => state.seasonUid);
  const currentSeasonData = useSeasonStore((state) => state.seasonData);
  const currentDay = useSeasonStore((state) => state.currentDay);

  const [error, setError] = useState<string | null>(null);
  const [fallbackSeasonId, setFallbackSeasonId] = useState<string | null>(null);

  // Determine which season to fetch (fallbackSeasonId takes precedence when set)
  const targetSeasonId = seasonId || fallbackSeasonId || currentSeasonUid;
  const isArchived =
    (seasonId && seasonId !== currentSeasonUid) ||
    (fallbackSeasonId && fallbackSeasonId !== currentSeasonUid);

  // Fetch available archived seasons (shared cache with Hall of Champions)
  const { data: archivedSeasons = [] } = useQuery<SeasonChampions[]>({
    queryKey: queryKeys.archivedSeasons(),
    queryFn: getSeasonChampions,
  });

  // Fetch all recap days for the target season; React Query de-duplicates in-session refetches
  // so navigating away and back to the Scores page costs zero extra Firestore reads. (The
  // always-mounted ticker and the Dashboard recent-results box use the bounded
  // fantasyRecapsRecent variant; this full-archive fetch backs the Scores page history.)
  // Archived seasons are immutable — their recap days never change — so they
  // never go stale and can sit in cache for an hour. The current season only
  // changes once per night (the ~2 AM scoring run), so a 60-minute staleTime
  // is plenty — the old 5-minute window re-downloaded the whole season's
  // recap set (up to 49 docs, every show × corps) twelve times an hour for
  // data that wasn't changing. An explicit user refresh still bypasses
  // staleTime (see refetch below), so "check right after the drop" works.
  const isFetchingCurrentSeason = targetSeasonId === currentSeasonUid;

  // Materialized standings: ~4 small docs written nightly by the scoring
  // pipeline. When they cover the season, the class-standings/stats surfaces
  // read these instead of aggregating the whole recap subcollection.
  const {
    data: standings,
    isLoading: standingsLoading,
    refetch: refetchStandings,
  } = useQuery<SeasonStandings | null>({
    queryKey: queryKeys.seasonStandings(targetSeasonId ?? ''),
    queryFn: () => getSeasonStandings(targetSeasonId ?? ''),
    enabled: !!targetSeasonId,
    staleTime: isFetchingCurrentSeason ? 60 * 60 * 1000 : Infinity,
    gcTime: 60 * 60 * 1000,
  });

  // Standings are trustworthy when they exist, cover only ranked classes we
  // need (classFilter 'all' — the Scores page; Dashboard's class-specific
  // filters include SoundSport, which standings never carry), and don't run
  // ahead of the client-side reveal boundary: getEffectiveDay hides the most
  // recent scored day until it "becomes effective" at the 2 AM ET rollover,
  // and the standings doc always reflects the very latest scored day.
  const effectiveDayNow = isFetchingCurrentSeason ? getEffectiveDay(currentDay) : null;
  const standingsUsable = Boolean(
    standings &&
    classFilter === 'all' &&
    (!isFetchingCurrentSeason ||
      (effectiveDayNow != null &&
        (standings.lastScoredDay == null || standings.lastScoredDay <= effectiveDayNow)))
  );

  // The full recap download only runs when a consumer actually needs per-show
  // data (skipShows false) or the standings can't serve this season. While
  // the standings query is still in flight the download stays parked —
  // firing it eagerly would re-download the whole season in parallel and
  // defeat the point on every cold load.
  const recapsEnabled = !!targetSeasonId && (!skipShows || (!standingsLoading && !standingsUsable));
  const {
    data: rawRecaps,
    isLoading: recapsLoading,
    error: queryError,
    refetch: refetchRecaps,
  } = useQuery({
    queryKey: queryKeys.fantasyRecaps(targetSeasonId ?? ''),
    queryFn: () => getSeasonRecaps(targetSeasonId ?? ''),
    enabled: recapsEnabled,
    staleTime: isFetchingCurrentSeason ? 60 * 60 * 1000 : Infinity,
    // gcTime >= staleTime so still-fresh data is never evicted while
    // unobserved (an eviction would force a full re-read on return).
    gcTime: 60 * 60 * 1000,
  });

  const loading = standingsLoading || (recapsEnabled && recapsLoading);

  // Manual refresh must hit whichever sources are live (react-query refetch
  // bypasses staleTime; refetching a disabled query is a no-op).
  const refetch = useCallback(async () => {
    await Promise.all([refetchStandings(), recapsEnabled ? refetchRecaps() : Promise.resolve()]);
  }, [refetchStandings, refetchRecaps, recapsEnabled]);

  // Propagate query errors to the existing error state consumed by callers
  useEffect(() => {
    if (queryError) setError(queryError.message);
  }, [queryError]);

  // If the current season has no data yet, fall back to the most recent archived season
  useEffect(() => {
    if (
      rawRecaps !== undefined &&
      rawRecaps.length === 0 &&
      !seasonId &&
      !fallbackSeasonId &&
      archivedSeasons.length > 0 &&
      !disableArchiveFallback
    ) {
      const mostRecentArchived = archivedSeasons[0];
      console.log(`Current season has no recaps, falling back to ${mostRecentArchived.id}`);
      setFallbackSeasonId(mostRecentArchived.id);
    }
  }, [rawRecaps, seasonId, fallbackSeasonId, archivedSeasons, disableArchiveFallback]);

  // Derive allShows from query data (replaces manual setState)
  const allShows = useMemo<NormalizedShow[]>(() => {
    const recaps = rawRecaps || [];
    if (recaps.length === 0) return [];

    const isCurrentSeason = targetSeasonId === currentSeasonUid;
    const effectiveDay = isCurrentSeason ? getEffectiveDay(currentDay) : null;
    // Only the current season's schedule is loaded here; use it to derive accurate
    // event dates. Archived seasons fall back to their stored (correct) recap date.
    const seasonSchedule = isCurrentSeason ? currentSeasonData?.schedule : null;

    return recaps
      .flatMap((recap): NormalizedShow[] => {
        if (isCurrentSeason) {
          if (!effectiveDay || effectiveDay < 1) return [];
          if (recap.offSeasonDay > effectiveDay) return [];
        }
        return normalizeRecapToShows(recap, targetSeasonId ?? '', seasonSchedule);
      })
      .sort((a, b) => b.offSeasonDay - a.offSeasonDay);
  }, [rawRecaps, targetSeasonId, currentSeasonUid, currentDay, currentSeasonData]);

  // displayedSeasonId: which season's data is currently shown
  const displayedSeasonId = allShows.length > 0 || standingsUsable ? targetSeasonId : null;

  // OPTIMIZATION #8: Derive availableDays from allShows with useMemo instead of state
  // This ensures days are always in sync with shows and removes redundant state updates
  const availableDays = useMemo(() => {
    if (standingsUsable && standings) {
      return [...standings.scoredDays].sort((a, b) => b - a);
    }
    if (allShows.length === 0) return [];
    // Get unique days sorted descending (most recent first)
    return [...new Set(allShows.map((s) => s.offSeasonDay))].sort((a, b) => b - a);
  }, [standingsUsable, standings, allShows]);

  // OPTIMIZATION #8: Derive stats from allShows with useMemo instead of state
  // Eliminates redundant state updates and ensures stats stay in sync with data
  const stats = useMemo<ScoresStats>(() => {
    if (standingsUsable && standings) {
      return standings.stats;
    }
    if (allShows.length === 0) {
      return { recentShows: 0, topScore: '-', corpsActive: 0, avgScore: '0.000' };
    }

    // Single pass: collect all scores and unique corps.
    // SoundSport is a ratings-only format — its numeric scores must never be
    // surfaced, so exclude them from the top/avg score stats (they would
    // otherwise leak an exact SoundSport score via the "High" figure). Corps
    // still count toward the active-corps tally.
    const allScores: number[] = [];
    const uniqueCorps = new Set<string>();

    for (const show of allShows) {
      for (const s of show.scores) {
        uniqueCorps.add(s.corps);
        if (s.corpsClass === 'soundSport') continue;
        allScores.push(s.score);
      }
    }

    const topScore = allScores.length > 0 ? Math.max(...allScores).toFixed(3) : '-';
    const avgScore =
      allScores.length > 0
        ? (allScores.reduce((sum, s) => sum + s, 0) / allScores.length).toFixed(3)
        : '0.000';

    return {
      recentShows: allShows.length,
      topScore,
      corpsActive: uniqueCorps.size,
      avgScore,
    };
  }, [standingsUsable, standings, allShows]);

  // Filter shows by class
  const filteredShows = useMemo<NormalizedShow[]>(() => {
    if (classFilter === 'all') {
      return allShows
        .map((show) => ({
          ...show,
          scores: show.scores.filter((s) => s.corpsClass !== 'soundSport'),
        }))
        .filter((show) => show.scores.length > 0);
    }

    const classMap: Record<string, string> = {
      world: 'worldClass',
      open: 'openClass',
      a: 'aClass',
    };
    const targetClass = classMap[classFilter] || classFilter;

    return allShows
      .map((show) => ({
        ...show,
        scores: show.scores.filter((s) => s.corpsClass === targetClass),
      }))
      .filter((show) => show.scores.length > 0);
  }, [allShows, classFilter]);

  // Aggregate all scores for leaderboard view. When the materialized
  // standings cover this season the nightly pipeline has already done this
  // work — consume it directly instead of re-deriving on every device.
  const aggregatedScores = useMemo(() => {
    if (standingsUsable && standings) {
      return standingsToLeaderboard(standings.classes) as ReturnType<
        typeof calculateCaptionRanks<LeaderboardEntry>
      >;
    }
    interface CorpsAggregate {
      corps: string;
      corpsName: string;
      corpsClass: CorpsClass;
      uid: string;
      displayName?: string;
      avatarUrl: string | null;
      scores: AggregatedScoreEntry[];
      totalScore: number;
      showCount: number;
    }
    const corpsScores = new Map<string, CorpsAggregate>();

    filteredShows.forEach((show) => {
      show.scores.forEach((score) => {
        const corps = score.corps || score.corpsName;
        let entry = corpsScores.get(corps);
        if (!entry) {
          entry = {
            corps,
            corpsName: corps,
            corpsClass: score.corpsClass,
            uid: score.uid,
            displayName: score.displayName,
            avatarUrl: score.avatarUrl || null,
            scores: [],
            totalScore: 0,
            showCount: 0,
          };
          corpsScores.set(corps, entry);
        }

        entry.scores.push({
          ...score,
          eventName: show.eventName,
          date: show.date,
          offSeasonDay: show.offSeasonDay,
        });
        // Use most recent score (first encountered since shows are sorted by offSeasonDay descending)
        if (entry.scores.length === 1) {
          entry.totalScore = score.score;
        }
        entry.showCount++;
      });
    });

    // Convert to array and sort by most recent score
    const leaderboard: LeaderboardEntry[] = Array.from(corpsScores.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
        score: entry.totalScore,
        // scores[0] is the most recent since shows are sorted by offSeasonDay descending
        ...calculateCaptionAggregates(entry.scores[0]),
        trend: calculateTrend(entry.scores),
      }));

    // Add caption ranks
    return calculateCaptionRanks(leaderboard);
  }, [standingsUsable, standings, filteredShows]);

  // Calculate column statistics for heatmap
  const columnStats = useMemo(
    () => ({
      GE_Total: calculateColumnStats(aggregatedScores, 'GE_Total'),
      VIS_Total: calculateColumnStats(aggregatedScores, 'VIS_Total'),
      MUS_Total: calculateColumnStats(aggregatedScores, 'MUS_Total'),
      Total_Score: calculateColumnStats(aggregatedScores, 'Total_Score'),
    }),
    [aggregatedScores]
  );

  // Allow manual season selection
  const selectSeason = useCallback(
    (newSeasonId: string) => {
      if (newSeasonId === currentSeasonUid) {
        // Clear fallback to return to current season
        setFallbackSeasonId(null);
      } else {
        setFallbackSeasonId(newSeasonId);
      }
    },
    [currentSeasonUid]
  );

  return {
    loading,
    error,
    // True when the materialized standings are serving this season — callers
    // use it to pick the lazy recap view over the eager one.
    usingStandings: standingsUsable,
    // Manual refresh (pull-to-refresh on the Scores page). React Query's
    // refetch bypasses staleTime, so an explicit user pull always re-reads.
    refetch,
    allShows: filteredShows,
    unfilteredShows: allShows,
    availableDays,
    archivedSeasons,
    stats,
    aggregatedScores,
    columnStats,
    isArchived,
    currentSeasonUid,
    currentSeasonData,
    displayedSeasonId,
    selectSeason,
  };
};

/**
 * Lazily fetch one day's recap and normalize it to shows. The Scores page's
 * recap view uses this with the standings-supplied day list, so switching a
 * day tab costs one doc read (cached per day) instead of the whole season
 * having been downloaded up front.
 */
export const useDayRecapShows = (
  seasonId: string | null | undefined,
  day: number | null,
  enabled = true
) => {
  const currentSeasonUid = useSeasonStore((state) => state.seasonUid);
  const currentSeasonData = useSeasonStore((state) => state.seasonData);
  const isCurrentSeason = seasonId === currentSeasonUid;

  const queryEnabled = enabled && !!seasonId && typeof day === 'number';
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.fantasyRecapDay(seasonId ?? '', day ?? 0),
    queryFn: () => getSeasonRecapDay(seasonId ?? '', day ?? 0),
    enabled: queryEnabled,
    // A scored day's recap is immutable once written; the current season's
    // latest day can in principle be re-run, so give it the same 60-minute
    // window the season-wide query uses.
    staleTime: isCurrentSeason ? 60 * 60 * 1000 : Infinity,
    gcTime: 60 * 60 * 1000,
  });

  const shows = useMemo<NormalizedShow[]>(() => {
    if (!data) return [];
    const seasonSchedule = isCurrentSeason ? currentSeasonData?.schedule : null;
    return normalizeRecapToShows(data, seasonId ?? '', seasonSchedule);
  }, [data, seasonId, isCurrentSeason, currentSeasonData]);

  return { shows, loading: queryEnabled && isLoading };
};

export default useScoresData;
