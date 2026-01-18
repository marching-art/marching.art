// src/hooks/useScoresData.js
// Centralized hook for fetching and processing scores data
// Supports both current season and archived seasons

import { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useSeasonStore } from '../store/seasonStore';

/**
 * Get the effective current day for score filtering
 * Scores are processed at 2 AM, so between midnight and 2 AM
 * we should still show the previous day's cutoff
 * Returns null if no scores should be available yet (e.g., day 1)
 */
const getEffectiveDay = (currentDay) => {
  if (!currentDay) return null;
  const now = new Date();
  const hour = now.getHours();
  // Scores for day N are processed at 2 AM and become available after that.
  // After 2 AM: previous day's scores were just processed (currentDay - 1)
  // Before 2 AM: scores only available up to currentDay - 2 (yesterday's processing hasn't run)
  const effectiveDay = hour < 2 ? currentDay - 2 : currentDay - 1;

  // Return null if no scores should be available yet (e.g., day 1)
  return effectiveDay >= 1 ? effectiveDay : null;
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
    const Total_Score = scoreSheet.score || scoreSheet.totalScore || (GE_Total + VIS_Total + MUS_Total);

    return { GE_Total, VIS_Total, MUS_Total, Total_Score };
  }

  // Handle aggregate scores (fantasy data with pre-calculated totals)
  return {
    GE_Total: scoreSheet.geScore || 0,
    VIS_Total: scoreSheet.visualScore || 0,
    MUS_Total: scoreSheet.musicScore || 0,
    Total_Score: scoreSheet.score || scoreSheet.totalScore || 0
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

  const values = scores.map(s => {
    const aggregates = calculateCaptionAggregates(s);
    return aggregates[key] || 0;
  }).filter(v => v > 0);

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
    bottom10: sorted[bottom10Index] || sorted[0]
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
  const values = recent.map(s => s.score || s.totalScore || 0);

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
  const results = scores.map(s => ({ ...s }));

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
  const {
    seasonId = null,
    classFilter = 'all',
    enabledCaptions = { ge: true, vis: true, mus: true },
    disableArchiveFallback = false
  } = options;

  const currentSeasonUid = useSeasonStore((state) => state.seasonUid);
  const currentSeasonData = useSeasonStore((state) => state.seasonData);
  const currentDay = useSeasonStore((state) => state.currentDay);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allShows, setAllShows] = useState([]);
  const [availableDays, setAvailableDays] = useState([]);
  const [archivedSeasons, setArchivedSeasons] = useState([]);
  const [fallbackSeasonId, setFallbackSeasonId] = useState(null);
  const [displayedSeasonId, setDisplayedSeasonId] = useState(null);
  const [stats, setStats] = useState({
    recentShows: 0,
    topScore: '-',
    corpsActive: 0,
    avgScore: 0
  });

  // Determine which season to fetch (fallbackSeasonId takes precedence when set)
  const targetSeasonId = seasonId || fallbackSeasonId || currentSeasonUid;
  const isArchived = (seasonId && seasonId !== currentSeasonUid) ||
                     (fallbackSeasonId && fallbackSeasonId !== currentSeasonUid);

  // Fetch available archived seasons
  // OPTIMIZATION: Limit to 20 most recent seasons to reduce data transfer
  useEffect(() => {
    const fetchArchivedSeasons = async () => {
      try {
        const championsRef = collection(db, 'season_champions');
        // Query with ordering and limit - reduces payload for users with many past seasons
        const championsQuery = query(championsRef, orderBy('archivedAt', 'desc'), limit(20));
        const championsSnapshot = await getDocs(championsQuery);

        const seasons = [];
        championsSnapshot.forEach(doc => {
          const data = doc.data();
          seasons.push({
            id: doc.id,
            seasonName: data.seasonName,
            seasonType: data.seasonType,
            archivedAt: data.archivedAt?.toDate?.() || new Date(data.archivedAt)
          });
        });

        // Already sorted by query, but keep for safety
        seasons.sort((a, b) => b.archivedAt - a.archivedAt);
        setArchivedSeasons(seasons);
      } catch (err) {
        console.error('Error fetching archived seasons:', err);
      }
    };

    fetchArchivedSeasons();
  }, []);

  // Fetch scores data for target season
  useEffect(() => {
    // Track if this effect is still current to prevent stale data from race conditions
    let isCurrent = true;

    const fetchScoresData = async () => {
      if (!targetSeasonId) return;

      try {
        setLoading(true);
        setError(null);

        // Try new subcollection format first, fallback to legacy single-document format
        // New format: fantasy_recaps/{seasonId}/days/{dayNumber}
        // Legacy format: fantasy_recaps/{seasonId} with recaps array
        const recapsCollectionRef = collection(db, 'fantasy_recaps', targetSeasonId, 'days');
        const recapsSnapshot = await getDocs(recapsCollectionRef);

        let shows = [];
        let recaps = [];

        if (!recapsSnapshot.empty) {
          // New subcollection format
          recaps = recapsSnapshot.docs.map(doc => doc.data());
        } else {
          // Fallback to legacy single-document format for backward compatibility
          const legacyDocRef = doc(db, 'fantasy_recaps', targetSeasonId);
          const legacyDoc = await getDoc(legacyDocRef);
          if (legacyDoc.exists()) {
            const legacyData = legacyDoc.data();
            recaps = legacyData.recaps || [];
          }
        }

        if (recaps.length > 0) {

          // Calculate effective day for score visibility filtering
          // For current season: only show scores from days that have been processed (at 2 AM)
          // For archived seasons: show all data
          const isCurrentSeason = targetSeasonId === currentSeasonUid;
          const effectiveDay = isCurrentSeason ? getEffectiveDay(currentDay) : null;

          // Process all shows and group by day
          shows = recaps.flatMap(recap => {
            // For current season, filter out shows from days that haven't been processed yet
            // effectiveDay is null when no scores should be visible (Day 1 or Day 2 before 2 AM)
            if (isCurrentSeason) {
              if (!effectiveDay || effectiveDay < 1) return []; // No scores visible yet
              if (recap.offSeasonDay > effectiveDay) return []; // Future day scores not yet processed
            }

            return recap.shows?.map(show => ({
              eventName: show.eventName,
              location: show.location,
              date: recap.date?.toDate?.().toLocaleDateString('en-US', { timeZone: 'UTC' }) || 'TBD',
              offSeasonDay: recap.offSeasonDay,
              seasonId: targetSeasonId,
              scores: show.results?.map(result => ({
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
                captions: result.captions || {}
              })).sort((a, b) => b.score - a.score) || []
            })) || [];
          }).sort((a, b) => b.offSeasonDay - a.offSeasonDay);
        }

        // If current season has no data and we haven't already tried a fallback,
        // automatically fall back to the most recent archived season
        // (unless disableArchiveFallback is set, which keeps the view fresh for new seasons)
        if (shows.length === 0 && !seasonId && !fallbackSeasonId && archivedSeasons.length > 0 && !disableArchiveFallback) {
          const mostRecentArchived = archivedSeasons[0];
          console.log(`Current season has no recaps, falling back to ${mostRecentArchived.id}`);
          if (isCurrent) {
            setFallbackSeasonId(mostRecentArchived.id);
          }
          // Don't set loading to false - the fallback will trigger another fetch
          return;
        }

        // Only update state if this effect is still current (prevents race condition
        // when user switches tabs quickly between archive and current season)
        if (!isCurrent) return;

        setAllShows(shows);
        setDisplayedSeasonId(targetSeasonId);

        // Get unique days that have shows (sorted descending - most recent first)
        const days = [...new Set(shows.map(s => s.offSeasonDay))].sort((a, b) => b - a);
        setAvailableDays(days);

        // Calculate stats
        const allScores = shows.flatMap(show => show.scores.map(s => s.score));
        const topScore = allScores.length > 0 ? Math.max(...allScores).toFixed(3) : '-';
        const avgScore = allScores.length > 0
          ? (allScores.reduce((sum, s) => sum + s, 0) / allScores.length).toFixed(3)
          : '0.000';
        const uniqueCorps = new Set(shows.flatMap(show => show.scores.map(s => s.corps)));

        setStats({
          recentShows: shows.length,
          topScore,
          corpsActive: uniqueCorps.size,
          avgScore
        });

        setLoading(false);
      } catch (err) {
        console.error('Error fetching scores:', err);
        if (isCurrent) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchScoresData();

    // Cleanup: mark this effect as stale when dependencies change
    return () => {
      isCurrent = false;
    };
  }, [targetSeasonId, archivedSeasons, seasonId, fallbackSeasonId, disableArchiveFallback, currentDay, currentSeasonUid]);

  // Filter shows by class
  const filteredShows = useMemo(() => {
    if (classFilter === 'all') {
      return allShows.map(show => ({
        ...show,
        scores: show.scores.filter(s => s.corpsClass !== 'soundSport')
      })).filter(show => show.scores.length > 0);
    }

    const classMap = {
      world: 'worldClass',
      open: 'openClass',
      a: 'aClass'
    };
    const targetClass = classMap[classFilter] || classFilter;

    return allShows.map(show => ({
      ...show,
      scores: show.scores.filter(s => s.corpsClass === targetClass)
    })).filter(show => show.scores.length > 0);
  }, [allShows, classFilter]);

  // Aggregate all scores for leaderboard view
  const aggregatedScores = useMemo(() => {
    const corpsScores = new Map();

    filteredShows.forEach(show => {
      show.scores.forEach(score => {
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
            showCount: 0
          });
        }

        const entry = corpsScores.get(corps);
        entry.scores.push({
          ...score,
          eventName: show.eventName,
          date: show.date,
          offSeasonDay: show.offSeasonDay
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
        trend: calculateTrend(entry.scores)
      }));

    // Add caption ranks
    return calculateCaptionRanks(leaderboard);
  }, [filteredShows]);

  // Calculate column statistics for heatmap
  const columnStats = useMemo(() => ({
    GE_Total: calculateColumnStats(aggregatedScores, 'GE_Total'),
    VIS_Total: calculateColumnStats(aggregatedScores, 'VIS_Total'),
    MUS_Total: calculateColumnStats(aggregatedScores, 'MUS_Total'),
    Total_Score: calculateColumnStats(aggregatedScores, 'Total_Score')
  }), [aggregatedScores]);

  // Allow manual season selection
  const selectSeason = useCallback((newSeasonId) => {
    if (newSeasonId === currentSeasonUid) {
      // Clear fallback to return to current season
      setFallbackSeasonId(null);
    } else {
      setFallbackSeasonId(newSeasonId);
    }
  }, [currentSeasonUid]);

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
    selectSeason
  };
};

export default useScoresData;
