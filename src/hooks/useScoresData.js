// src/hooks/useScoresData.js
// Centralized hook for fetching and processing scores data
// Supports both current season and archived seasons

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSeasonRecaps, getSeasonChampions } from '../api/season';
import { queryKeys } from '../lib/queryClient';
import { useSeasonStore } from '../store/seasonStore';
import { getEffectiveDay } from '../utils/dashboardScoring';

/**
 * Resolve the display date for a recap day.
 *
 * When the season schedule is known (the live/current season), derive the date
 * from the competition day: startDate + springTrainingDays + (offSeasonDay - 1).
 * This matches the Schedule page's getActualDate and corrects live-season recaps
 * whose stored `date` was written without the spring-training offset (competition
 * day 1 falls 21 calendar days after startDate, not on startDate). Off-season and
 * archived recaps have no spring training and a correct stored date, so they fall
 * back to the value persisted on the recap. startDate is stored at UTC midnight,
 * so all math and formatting use UTC to keep the calendar date stable.
 */
export const formatRecapDate = (recap, seasonSchedule) => {
  const startTs = seasonSchedule?.startDate;
  const startDate = startTs?.toDate?.() || (startTs ? new Date(startTs) : null);
  if (startDate && !isNaN(startDate) && typeof recap?.offSeasonDay === 'number') {
    const springTrainingDays = seasonSchedule.springTrainingDays || 0;
    const eventDate = new Date(
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate() + springTrainingDays + (recap.offSeasonDay - 1)
      )
    );
    return eventDate.toLocaleDateString('en-US', { timeZone: 'UTC' });
  }
  return recap?.date?.toDate?.().toLocaleDateString('en-US', { timeZone: 'UTC' }) || 'TBD';
};

/**
 * Calculate caption aggregates from a score sheet
 * Returns GE_Total, VIS_Total, MUS_Total, and Total_Score
 */
export const calculateCaptionAggregates = (scoreSheet) => {
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

    // Total score
    const Total_Score =
      scoreSheet.score || scoreSheet.totalScore || GE_Total + VIS_Total + MUS_Total;

    return { GE_Total, VIS_Total, MUS_Total, Total_Score };
  }

  // Handle aggregate scores (fantasy data with pre-calculated totals)
  return {
    GE_Total: scoreSheet.geScore || 0,
    VIS_Total: scoreSheet.visualScore || 0,
    MUS_Total: scoreSheet.musicScore || 0,
    Total_Score: scoreSheet.score || scoreSheet.totalScore || 0,
  };
};

/**
 * Calculate statistics for a column of scores
 * Returns average, percentile thresholds for heatmap coloring
 */
export const calculateColumnStats = (scores, key) => {
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
export const getHeatmapColor = (value, stats) => {
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
export const calculateTrend = (scoreHistory, count = 5) => {
  if (!scoreHistory || scoreHistory.length < 2) {
    return { trend: 'stable', values: [], direction: 0 };
  }

  // Get the most recent N scores (first N elements since array is newest-first)
  const recent = scoreHistory.slice(0, count);
  const values = recent.map((s) => s.score || s.totalScore || 0);

  // values[0] = most recent, values[length-1] = oldest in this window
  const newest = values[0];
  const oldest = values[values.length - 1];

  // Calculate trend: positive if scores are improving (newest > oldest)
  const direction = oldest > 0 ? (newest - oldest) / oldest : 0;

  let trend = 'stable';
  if (direction > 0.02) trend = 'up';
  else if (direction < -0.02) trend = 'down';

  // Reverse values for sparkline display (chronological: oldest to newest)
  return { trend, values: [...values].reverse(), direction };
};

/**
 * Generate sparkline SVG path from values
 */
export const generateSparklinePath = (values, width = 60, height = 20) => {
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
export const calculateCaptionRanks = (scores) => {
  if (!scores || scores.length === 0) return [];

  const n = scores.length;

  // Create lightweight [value, originalIndex] tuples for sorting
  // Much more memory-efficient than copying full score objects
  const geIndices = new Array(n);
  const visIndices = new Array(n);
  const musIndices = new Array(n);

  // Single pass to extract all caption values with their indices
  for (let i = 0; i < n; i++) {
    const s = scores[i];
    geIndices[i] = [s.GE_Total || 0, i];
    visIndices[i] = [s.VIS_Total || 0, i];
    musIndices[i] = [s.MUS_Total || 0, i];
  }

  // Sort by value descending (higher score = better rank)
  // Sorting small tuples is faster than sorting objects with many properties
  const compareDesc = (a, b) => b[0] - a[0];
  geIndices.sort(compareDesc);
  visIndices.sort(compareDesc);
  musIndices.sort(compareDesc);

  // Create result array once, then assign all ranks directly
  // Avoids creating intermediate Maps and doing Map lookups
  const results = scores.map((s) => ({ ...s }));

  // Assign ranks via direct index access (O(1) per assignment)
  for (let rank = 0; rank < n; rank++) {
    results[geIndices[rank][1]].GE_Rank = rank + 1;
    results[visIndices[rank][1]].VIS_Rank = rank + 1;
    results[musIndices[rank][1]].MUS_Rank = rank + 1;
  }

  return results;
};

/**
 * Main hook for scores data
 */
export const useScoresData = (options = {}) => {
  const { seasonId = null, classFilter = 'all', disableArchiveFallback = false } = options;

  const currentSeasonUid = useSeasonStore((state) => state.seasonUid);
  const currentSeasonData = useSeasonStore((state) => state.seasonData);
  const currentDay = useSeasonStore((state) => state.currentDay);

  const [error, setError] = useState(null);
  const [fallbackSeasonId, setFallbackSeasonId] = useState(null);

  // Determine which season to fetch (fallbackSeasonId takes precedence when set)
  const targetSeasonId = seasonId || fallbackSeasonId || currentSeasonUid;
  const isArchived =
    (seasonId && seasonId !== currentSeasonUid) ||
    (fallbackSeasonId && fallbackSeasonId !== currentSeasonUid);

  // Fetch available archived seasons (shared cache with Hall of Champions)
  const { data: archivedSeasons = [] } = useQuery({
    queryKey: queryKeys.archivedSeasons(),
    queryFn: getSeasonChampions,
  });

  // Fetch all recap days for the target season; React Query de-duplicates in-session refetches
  // so navigating away and back to the Scores page costs zero extra Firestore reads. The
  // ticker and Dashboard recent-results hooks share this exact cache entry.
  const {
    data: rawRecaps,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.fantasyRecaps(targetSeasonId),
    queryFn: () => getSeasonRecaps(targetSeasonId),
    enabled: !!targetSeasonId,
    staleTime: 5 * 60 * 1000,
  });

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
  const allShows = useMemo(() => {
    const recaps = rawRecaps || [];
    if (recaps.length === 0) return [];

    const isCurrentSeason = targetSeasonId === currentSeasonUid;
    const effectiveDay = isCurrentSeason ? getEffectiveDay(currentDay) : null;
    // Only the current season's schedule is loaded here; use it to derive accurate
    // event dates. Archived seasons fall back to their stored (correct) recap date.
    const seasonSchedule = isCurrentSeason ? currentSeasonData?.schedule : null;

    return recaps
      .flatMap((recap) => {
        if (isCurrentSeason) {
          if (!effectiveDay || effectiveDay < 1) return [];
          if (recap.offSeasonDay > effectiveDay) return [];
        }
        const recapDate = formatRecapDate(recap, seasonSchedule);
        return (
          recap.shows?.map((show) => ({
            eventName: show.eventName,
            location: show.location,
            date: recapDate,
            offSeasonDay: recap.offSeasonDay,
            seasonId: targetSeasonId,
            scores:
              show.results
                ?.map((result) => ({
                  corps: result.corpsName,
                  corpsName: result.corpsName,
                  uid: result.uid,
                  displayName: result.displayName,
                  avatarUrl: result.avatarUrl || null,
                  score: result.totalScore || 0,
                  totalScore: result.totalScore || 0,
                  geScore: result.geScore || 0,
                  visualScore: result.visualScore || 0,
                  musicScore: result.musicScore || 0,
                  corpsClass: result.corpsClass,
                  captions: result.captions || {},
                }))
                .sort((a, b) => b.score - a.score) || [],
          })) || []
        );
      })
      .sort((a, b) => b.offSeasonDay - a.offSeasonDay);
  }, [rawRecaps, targetSeasonId, currentSeasonUid, currentDay, currentSeasonData]);

  // displayedSeasonId: which season's data is currently shown
  const displayedSeasonId = allShows.length > 0 ? targetSeasonId : null;

  // OPTIMIZATION #8: Derive availableDays from allShows with useMemo instead of state
  // This ensures days are always in sync with shows and removes redundant state updates
  const availableDays = useMemo(() => {
    if (allShows.length === 0) return [];
    // Get unique days sorted descending (most recent first)
    return [...new Set(allShows.map((s) => s.offSeasonDay))].sort((a, b) => b - a);
  }, [allShows]);

  // OPTIMIZATION #8: Derive stats from allShows with useMemo instead of state
  // Eliminates redundant state updates and ensures stats stay in sync with data
  const stats = useMemo(() => {
    if (allShows.length === 0) {
      return { recentShows: 0, topScore: '-', corpsActive: 0, avgScore: '0.000' };
    }

    // Single pass: collect all scores and unique corps.
    // SoundSport is a ratings-only format — its numeric scores must never be
    // surfaced, so exclude them from the top/avg score stats (they would
    // otherwise leak an exact SoundSport score via the "High" figure). Corps
    // still count toward the active-corps tally.
    const allScores = [];
    const uniqueCorps = new Set();

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
  }, [allShows]);

  // Filter shows by class
  const filteredShows = useMemo(() => {
    if (classFilter === 'all') {
      return allShows
        .map((show) => ({
          ...show,
          scores: show.scores.filter((s) => s.corpsClass !== 'soundSport'),
        }))
        .filter((show) => show.scores.length > 0);
    }

    const classMap = {
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

  // Aggregate all scores for leaderboard view
  const aggregatedScores = useMemo(() => {
    const corpsScores = new Map();

    filteredShows.forEach((show) => {
      show.scores.forEach((score) => {
        const corps = score.corps || score.corpsName;
        if (!corpsScores.has(corps)) {
          corpsScores.set(corps, {
            corps,
            corpsName: corps,
            corpsClass: score.corpsClass,
            uid: score.uid,
            displayName: score.displayName,
            avatarUrl: score.avatarUrl || null,
            scores: [],
            totalScore: 0,
            showCount: 0,
          });
        }

        const entry = corpsScores.get(corps);
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
    const leaderboard = Array.from(corpsScores.values())
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
  }, [filteredShows]);

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
    (newSeasonId) => {
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

export default useScoresData;
