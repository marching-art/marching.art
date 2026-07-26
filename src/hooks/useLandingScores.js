// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// src/hooks/useLandingScores.js
// Hook for fetching the "Live Scores" ranking shown on the landing/news pages.
// - Live season: ranks the real current-year DCI corps as they compete, using the
//   live-scraped scores in historical_scores/{seasonYear}.
// - Off-season: ranks the fantasy lineup corps using their historical DCI scores,
//   similar to how fantasy sports show real game results.
//
// Reads go through the api/season service and react-query: the corps pool and
// per-year historical docs share cache entries with the Dashboard lineup table
// (same query keys), so landing/news pages reuse data other surfaces fetched.

import { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { getCorpsValues, getHistoricalScoresForYear } from '../api/season';
import { queryKeys } from '../lib/queryClient';
import { useSeasonStore } from '../store/seasonStore';
import { useRevealedDay } from './useRevealedDay';

const SCORES_STALE_TIME = 5 * 60 * 1000;

/**
 * Calculate total score from individual captions
 * GE contributes directly, Visual and Music are divided by 2
 */
const calculateTotalScore = (captions) => {
  if (!captions) return 0;
  const ge = (captions.GE1 || 0) + (captions.GE2 || 0);
  const visual = ((captions.VP || 0) + (captions.VA || 0) + (captions.CG || 0)) / 2;
  const music = ((captions.B || 0) + (captions.MA || 0) + (captions.P || 0)) / 2;
  return ge + visual + music;
};

/**
 * Hook to fetch live DCI scores for the landing page
 * Returns ranked scores for all selected corps in the current season
 * using actual historical DCI data
 */
export const useLandingScores = ({ enabled = true } = {}) => {
  const seasonData = useSeasonStore((state) => state.seasonData);
  const currentDay = useSeasonStore((state) => state.currentDay);

  // During a live season, the Live Scores box should rank the ACTUAL current-year
  // DCI corps competing right now (scraped into historical_scores/{seasonYear}),
  // not the previous-year corps that fantasy lineup point values are based on.
  const isLiveSeason = seasonData?.status === 'live-season';
  const liveSeasonYear = seasonData?.seasonYear != null ? String(seasonData.seasonYear) : null;
  const dataDocId = seasonData?.dataDocId;

  // Max day of scores to display: the shared reveal boundary — tonight's day
  // the moment its fantasy scoring completes, otherwise everything through
  // the 2 AM ET rollover. This is what keeps live-scraped DCI results (which
  // land in historical_scores before fantasy scoring runs) hidden until the
  // night's scores actually drop.
  const maxScoreDay = useRevealedDay(currentDay);

  // Fantasy pool corps (dci-data doc). Needed in both modes: it defines the
  // off-season ranking list, and in live season it filters the scraped corps
  // to those selectable as caption options.
  const corpsValuesQuery = useQuery({
    queryKey: queryKeys.corpsValues(dataDocId),
    queryFn: () => getCorpsValues(dataDocId),
    enabled: !!dataDocId && enabled,
    staleTime: SCORES_STALE_TIME,
  });
  const poolCorps = corpsValuesQuery.data;

  // Which historical_scores years to load: just the live year during a live
  // season, otherwise every source year referenced by the fantasy pool.
  const yearsNeeded = useMemo(() => {
    if (isLiveSeason && liveSeasonYear) return [liveSeasonYear];
    if (!poolCorps) return [];
    return [...new Set(poolCorps.map((c) => String(c.sourceYear)))].sort();
  }, [isLiveSeason, liveSeasonYear, poolCorps]);

  const {
    historicalData,
    anyPending: yearsPending,
    errorMessage: yearsError,
  } = useQueries({
    queries: yearsNeeded.map((year) => ({
      queryKey: queryKeys.historicalScores(year),
      queryFn: () => getHistoricalScoresForYear(year),
      enabled,
      staleTime: SCORES_STALE_TIME,
    })),
    combine: (results) => {
      const byYear = {};
      results.forEach((result, i) => {
        if (result.data && result.data.length > 0) byYear[yearsNeeded[i]] = result.data;
      });
      return {
        historicalData: byYear,
        anyPending: results.some((result) => result.isPending),
        errorMessage: results.find((result) => result.error)?.error?.message || null,
      };
    },
  });

  // The ranked corps list. Live season: the scraped current-year corps that are
  // also selectable in the fantasy pool (so the 2026 Blue Devils show because
  // the 2025 Blue Devils are a caption option, but a corps whose name isn't in
  // the pool is omitted). Off-season: the fantasy pool itself.
  const corpsValues = useMemo(() => {
    if (isLiveSeason && liveSeasonYear) {
      const yearData = historicalData[liveSeasonYear] || [];
      const selectableNames = new Set((poolCorps || []).map((c) => c.corpsName));

      const uniqueCorps = new Map();
      yearData.forEach((event) => {
        event.scores?.forEach((s) => {
          if (s.corps && selectableNames.has(s.corps) && !uniqueCorps.has(s.corps)) {
            uniqueCorps.set(s.corps, {
              corpsName: s.corps,
              sourceYear: liveSeasonYear,
              points: null,
            });
          }
        });
      });
      return [...uniqueCorps.values()];
    }
    return poolCorps || [];
  }, [isLiveSeason, liveSeasonYear, historicalData, poolCorps]);

  const loading = enabled && !!dataDocId && (corpsValuesQuery.isPending || yearsPending);
  const error = corpsValuesQuery.error?.message || yearsError;

  // Process scores for landing page display
  const liveScores = useMemo(() => {
    // Guard: If no data or maxScoreDay is null/0, no scores should be visible
    // maxScoreDay is null on Day 1 (no processed scores yet)
    if (
      corpsValues.length === 0 ||
      Object.keys(historicalData).length === 0 ||
      !maxScoreDay ||
      maxScoreDay < 1
    ) {
      return [];
    }

    // Build a map of each corps' score history
    const corpsScoreHistory = new Map();

    // For each selected corps, gather their scores from historical data
    corpsValues.forEach((corps) => {
      const yearData = historicalData[String(corps.sourceYear)] || [];
      const scores = [];

      yearData.forEach((event) => {
        // CRITICAL: never show a day past the reveal boundary. During a live
        // season the scraper writes tonight's DCI results into
        // historical_scores BEFORE fantasy scoring runs, so this filter is
        // what keeps them hidden until the night's scores actually drop
        // (maxScoreDay only advances to tonight's day once the backend stamps
        // the night as scored).
        if (event.offSeasonDay > maxScoreDay) return;

        const scoreData = event.scores?.find((s) => s.corps === corps.corpsName);
        if (scoreData && scoreData.captions) {
          const totalScore = calculateTotalScore(scoreData.captions);
          // Skip zero scores (treat as blank)
          if (totalScore > 0) {
            scores.push({
              day: event.offSeasonDay,
              date: event.date,
              eventName: event.eventName,
              totalScore,
              captions: scoreData.captions,
            });
          }
        }
      });

      if (scores.length > 0) {
        // Sort by day descending (most recent first)
        scores.sort((a, b) => b.day - a.day);

        corpsScoreHistory.set(`${corps.corpsName}-${corps.sourceYear}`, {
          corpsName: corps.corpsName,
          sourceYear: corps.sourceYear,
          points: corps.points,
          scores,
        });
      }
    });

    // Process each corps to get their latest score and change
    const rankedScores = [];

    corpsScoreHistory.forEach((data) => {
      const latestScore = data.scores[0].totalScore;
      const latestDay = data.scores[0].day;

      // Find the previous score (from a different day)
      let previousScore = null;
      for (let i = 1; i < data.scores.length; i++) {
        if (data.scores[i].day !== latestDay) {
          previousScore = data.scores[i].totalScore;
          break;
        }
      }

      // Calculate score change
      let change = null;
      let direction = 'stable';
      if (previousScore !== null) {
        change = latestScore - previousScore;
        if (change > 0.001) direction = 'up';
        else if (change < -0.001) direction = 'down';
      }

      rankedScores.push({
        corpsName: data.corpsName,
        sourceYear: data.sourceYear,
        points: data.points,
        score: latestScore,
        change,
        direction,
        showCount: data.scores.length,
        latestDay,
      });
    });

    // Sort by score descending and add ranks
    rankedScores.sort((a, b) => b.score - a.score);
    rankedScores.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return rankedScores;
  }, [corpsValues, historicalData, maxScoreDay]);

  // Get the display day (most recent day with scores)
  const displayDay = useMemo(() => {
    if (liveScores.length === 0) return null;
    return Math.max(...liveScores.map((s) => s.latestDay));
  }, [liveScores]);

  return {
    loading,
    error,
    liveScores,
    displayDay,
    currentDay,
    hasData: liveScores.length > 0,
  };
};

export default useLandingScores;
