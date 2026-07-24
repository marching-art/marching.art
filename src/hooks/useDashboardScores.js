// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Dashboard data hooks: per-caption lineup scores from historical_scores,
// recent results from fantasy_recaps, and the SoundSport Best in Show tally.
//
// All Firestore reads go through the api/season service and react-query, so
// the historical-score years are shared with the Live Scores box and the
// recap days are shared with the Scores page (same query key; the ticker and
// useDashboardData use the bounded fantasyRecapsRecent variant) — mounting
// the Dashboard costs no extra reads when those are already cached.

import { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import {
  getSeasonRecaps,
  getHistoricalScoresForYear,
  getRecentPodiumRecaps,
  RECENT_RECAP_DAYS,
} from '../api/season';
import { queryKeys } from '../lib/queryClient';
import { CAPTIONS } from '../components/Dashboard';
import { getEffectiveDay, processCaptionScores } from '../utils/dashboardScoring';
import { formatRecapDate } from './useScoresData';

const SCORES_STALE_TIME = 5 * 60 * 1000;

export function useLineupScores(lineup, currentDay, activeCorpsClass) {
  const hasLineup = !!lineup && Object.keys(lineup).length > 0;

  // Effective day accounting for 2 AM ET score processing. Guard: if null or
  // < 1 no scores should be visible (Day 1, or Day 2 before 2 AM).
  const effectiveDay = currentDay ? getEffectiveDay(currentDay) : null;
  const shouldFetch = hasLineup && !!effectiveDay && effectiveDay >= 1;

  // Unique source years referenced by the lineup ("corpsName|sourceYear")
  const yearsNeeded = useMemo(() => {
    const years = new Set();
    Object.values(lineup || {}).forEach((value) => {
      if (value) {
        const [, sourceYear] = value.split('|');
        if (sourceYear) years.add(sourceYear);
      }
    });
    return [...years].sort();
  }, [lineup]);

  const { historicalData, anyPending } = useQueries({
    queries: yearsNeeded.map((year) => ({
      queryKey: queryKeys.historicalScores(year),
      queryFn: () => getHistoricalScoresForYear(year),
      enabled: shouldFetch,
      staleTime: SCORES_STALE_TIME,
    })),
    combine: (results) => {
      const byYear = {};
      results.forEach((result, i) => {
        if (result.data) byYear[yearsNeeded[i]] = result.data;
      });
      return {
        historicalData: byYear,
        anyPending: results.some((result) => result.isPending),
      };
    },
  });

  const lineupScoresLoading = shouldFetch && anyPending;

  const lineupScoreData = useMemo(() => {
    if (!shouldFetch || lineupScoresLoading) return {};

    const isSoundSport = activeCorpsClass === 'soundSport';
    const scoreData = {};

    CAPTIONS.forEach((caption) => {
      const value = lineup[caption.id];
      if (!value) {
        scoreData[caption.id] = { score: null, trend: null, nextShow: null };
        return;
      }

      const [corpsName, sourceYear] = value.split('|');
      const yearData = historicalData[sourceYear];

      if (!yearData) {
        scoreData[caption.id] = { score: null, trend: null, nextShow: null };
        return;
      }

      // SoundSport is a ratings-only format — never surface numeric caption
      // or category scores (or their deltas) in the lineup table. Only the
      // next-show scheduling info is kept.
      if (isSoundSport) {
        const baseData = processCaptionScores(yearData, corpsName, caption.id, effectiveDay);
        scoreData[caption.id] = { score: null, trend: null, nextShow: baseData.nextShow };
      } else {
        scoreData[caption.id] = processCaptionScores(yearData, corpsName, caption.id, effectiveDay);
      }
    });

    return scoreData;
  }, [shouldFetch, lineupScoresLoading, lineup, activeCorpsClass, effectiveDay, historicalData]);

  return { lineupScoreData, lineupScoresLoading };
}

export function useRecentResults(user, seasonData, activeCorpsClass, currentDay) {
  const seasonUid = seasonData?.seasonUid;
  const enabled = !!user?.uid && !!seasonUid && !!activeCorpsClass && !!currentDay;

  // Same cache entry as the Scores page's full-archive fetch (which the
  // Dashboard already mounts via useScoresData, so this costs no extra reads)
  const { data: recaps } = useQuery({
    queryKey: queryKeys.fantasyRecaps(seasonUid),
    queryFn: () => getSeasonRecaps(seasonUid),
    enabled,
    staleTime: SCORES_STALE_TIME,
  });

  return useMemo(() => {
    if (!enabled || !recaps || recaps.length === 0) return [];

    // Only show scores from days that have been processed (2 AM ET boundary).
    const effectiveDay = getEffectiveDay(currentDay);
    if (effectiveDay === null) return [];

    const results = [];

    // Sort by day descending and filter to only include processed days
    const sortedRecaps = [...recaps]
      .filter((recap) => recap.offSeasonDay <= effectiveDay)
      .sort((a, b) => (b.offSeasonDay || 0) - (a.offSeasonDay || 0));

    for (const recap of sortedRecaps) {
      for (const show of recap.shows || []) {
        const userResult = (show.results || []).find(
          (r) => r.uid === user.uid && r.corpsClass === activeCorpsClass
        );

        if (userResult && results.length < 5) {
          results.push({
            eventName: show.eventName || show.name || 'Show',
            score: userResult.totalScore,
            placement: userResult.placement,
            // Derive the event date from the season schedule so live-season
            // recaps (whose stored date omitted the spring-training offset)
            // display the correct calendar date. Falls back to the stored
            // recap date for off-season/archived data.
            date: formatRecapDate(recap, seasonData?.schedule),
          });
        }
      }
    }

    return results;
  }, [enabled, recaps, user?.uid, activeCorpsClass, currentDay, seasonData?.schedule]);
}

/**
 * Recent Podium Class results for the signed-in director.
 *
 * Podium scores never appear in fantasy_recaps — the nightly Podium processor
 * writes to the separate podium-recaps collection (one doc per competition day,
 * each carrying `shows: [{ eventName, location, results }]` with per-show
 * placement and full caption breakdowns). This mirrors useRecentResults but
 * reads that collection so the Dashboard's Recent Results box populates for
 * Podium. Returns the same { eventName, score, placement, date } shape.
 */
export function usePodiumRecentResults(user, seasonData, currentDay, enabled = true) {
  const seasonUid = seasonData?.seasonUid;
  const active = enabled && !!user?.uid && !!seasonUid && !!currentDay;

  // Bounded fetch: the box shows at most 5 results, so the last
  // RECENT_RECAP_DAYS day-docs are plenty — no need to download the whole
  // season's Podium archive here (PodiumRecapSheet owns the full-season view).
  const { data: recaps } = useQuery({
    queryKey: queryKeys.podiumRecapsRecent(seasonUid, RECENT_RECAP_DAYS),
    queryFn: () => getRecentPodiumRecaps(seasonUid, RECENT_RECAP_DAYS),
    enabled: active,
    staleTime: SCORES_STALE_TIME,
  });

  return useMemo(() => {
    if (!active || !recaps || recaps.length === 0) return [];

    // Only surface days that have been processed (2 AM ET boundary).
    const effectiveDay = getEffectiveDay(currentDay);
    if (effectiveDay === null) return [];

    const results = [];
    const sortedRecaps = [...recaps]
      .filter((recap) => (recap.competitionDay ?? 0) <= effectiveDay)
      .sort((a, b) => (b.competitionDay || 0) - (a.competitionDay || 0));

    for (const recap of sortedRecaps) {
      for (const show of recap.shows || []) {
        const mine = (show.results || []).find((r) => r.uid === user.uid);
        if (mine && results.length < 5) {
          results.push({
            eventName: show.eventName || 'Show',
            score: mine.totalScore,
            placement: mine.place ?? mine.placement,
            // Podium recaps key by competitionDay; formatRecapDate expects
            // offSeasonDay, so pass a shim to derive the correct calendar date
            // from the season schedule (falls back to a stored date otherwise).
            date: formatRecapDate(
              { offSeasonDay: recap.competitionDay, date: recap.date },
              seasonData?.schedule
            ),
          });
        }
      }
    }

    return results;
  }, [active, recaps, user?.uid, currentDay, seasonData?.schedule]);
}

export function useBestInShowCount(activeCorps, activeCorpsClass, allShows) {
  // Calculate Best in Show count for SoundSport (count of shows where user had the highest score)
  const bestInShowCount = useMemo(() => {
    if (!activeCorps || activeCorpsClass !== 'soundSport' || !allShows?.length) return 0;

    const corpsName = activeCorps.corpsName || activeCorps.name;
    let count = 0;

    allShows.forEach((show) => {
      if (!show.scores?.length) return;

      // Find the highest score in this show
      const maxScore = Math.max(...show.scores.map((s) => s.score || 0));
      if (maxScore <= 0) return;

      // Check if user's corps has the highest score
      const userScore = show.scores.find((s) => s.corpsName === corpsName || s.corps === corpsName);
      if (userScore && userScore.score === maxScore) {
        count++;
      }
    });

    return count;
  }, [activeCorps, activeCorpsClass, allShows]);

  return bestInShowCount;
}
