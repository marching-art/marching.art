// src/hooks/useScoresData.js
// Centralized hook for fetching and processing scores data
// Supports both current season and archived seasons

import { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, getDoc, collection, getDocs, query, orderBy, limit, startAfter } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { useSeasonStore } from '../store/seasonStore';

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
 * Optimized: Uses Map lookups O(1) instead of findIndex O(n) for 99%+ performance gain
 * Previous complexity: O(n²) - with 1000 corps = ~1,000,000 operations
 * New complexity: O(n log n) - dominated by sorting = ~10,000 operations
 */
export const calculateCaptionRanks = (scores) => {
  if (!scores || scores.length === 0) return [];

  // Add aggregates to each score
  const withAggregates = scores.map(s => ({
    ...s,
    ...calculateCaptionAggregates(s)
  }));

  // Sort by each category (O(n log n) each)
  const geRanks = [...withAggregates].sort((a, b) => b.GE_Total - a.GE_Total);
  const visRanks = [...withAggregates].sort((a, b) => b.VIS_Total - a.VIS_Total);
  const musRanks = [...withAggregates].sort((a, b) => b.MUS_Total - a.MUS_Total);

  // Build rank Maps for O(1) lookup instead of O(n) findIndex
  const geRankMap = new Map(geRanks.map((s, i) => [s.corps || s.corpsName, i + 1]));
  const visRankMap = new Map(visRanks.map((s, i) => [s.corps || s.corpsName, i + 1]));
  const musRankMap = new Map(musRanks.map((s, i) => [s.corps || s.corpsName, i + 1]));

  return withAggregates.map(score => {
    const corps = score.corps || score.corpsName;
    return {
      ...score,
      GE_Rank: geRankMap.get(corps),
      VIS_Rank: visRankMap.get(corps),
      MUS_Rank: musRankMap.get(corps)
    };
  });
};

/**
 * Main hook for scores data
 */
export const useScoresData = (options = {}) => {
  const {
    seasonId = null,
    classFilter = 'all',
    enabledCaptions = { ge: true, vis: true, mus: true }
  } = options;

  const currentSeasonUid = useSeasonStore((state) => state.seasonUid);
  const currentSeasonData = useSeasonStore((state) => state.seasonData);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allShows, setAllShows] = useState([]);
  const [availableDays, setAvailableDays] = useState([]);
  const [archivedSeasons, setArchivedSeasons] = useState([]);
  const [stats, setStats] = useState({
    recentShows: 0,
    topScore: '-',
    corpsActive: 0,
    avgScore: 0
  });

  // Determine which season to fetch
  const targetSeasonId = seasonId || currentSeasonUid;
  const isArchived = seasonId && seasonId !== currentSeasonUid;

  // Fetch available archived seasons
  useEffect(() => {
    const fetchArchivedSeasons = async () => {
      try {
        const championsRef = collection(db, 'season_champions');
        const championsSnapshot = await getDocs(championsRef);

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

        // Sort by archived date descending
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
    const fetchScoresData = async () => {
      if (!targetSeasonId) return;

      try {
        setLoading(true);
        setError(null);

        // Try fantasy_recaps first (current or past season recaps)
        const recapRef = doc(db, 'fantasy_recaps', targetSeasonId);
        const recapDoc = await getDoc(recapRef);

        if (recapDoc.exists()) {
          const data = recapDoc.data();
          const recaps = data.recaps || [];

          // Process all shows and group by day
          const shows = recaps.flatMap(recap =>
            recap.shows?.map(show => ({
              eventName: show.eventName,
              location: show.location,
              date: recap.date?.toDate?.().toLocaleDateString() || 'TBD',
              offSeasonDay: recap.offSeasonDay,
              seasonId: targetSeasonId,
              scores: show.results?.map(result => ({
                corps: result.corpsName,
                corpsName: result.corpsName,
                score: result.totalScore || 0,
                totalScore: result.totalScore || 0,
                geScore: result.geScore || 0,
                visualScore: result.visualScore || 0,
                musicScore: result.musicScore || 0,
                corpsClass: result.corpsClass,
                captions: result.captions || {}
              })).sort((a, b) => b.score - a.score) || []
            })) || []
          ).sort((a, b) => b.offSeasonDay - a.offSeasonDay);

          setAllShows(shows);

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
        } else {
          // No data found for this season
          setAllShows([]);
          setAvailableDays([]);
          setStats({ recentShows: 0, topScore: '-', corpsActive: 0, avgScore: 0 });
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching scores:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchScoresData();
  }, [targetSeasonId]);

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
    currentSeasonData
  };
};

export default useScoresData;
