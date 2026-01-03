// src/hooks/useLandingScores.js
// Hook for fetching live scores for the landing page
// Shows most recent scores for all corps, ranked by total score
// Only includes scores from before the current season day

import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useSeasonStore } from '../store/seasonStore';

/**
 * Hook to fetch live scores for the landing page
 * Returns ranked scores across all classes (excluding soundSport)
 * with score change from previous performance
 */
export const useLandingScores = () => {
  const seasonUid = useSeasonStore((state) => state.seasonUid);
  const currentDay = useSeasonStore((state) => state.currentDay);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allRecaps, setAllRecaps] = useState([]);

  // Fetch all recaps for the season
  useEffect(() => {
    const fetchRecaps = async () => {
      if (!seasonUid) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const recapRef = doc(db, 'fantasy_recaps', seasonUid);
        const recapDoc = await getDoc(recapRef);

        if (recapDoc.exists()) {
          const data = recapDoc.data();
          setAllRecaps(data.recaps || []);
        } else {
          setAllRecaps([]);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching landing scores:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchRecaps();
  }, [seasonUid]);

  // Process scores for landing page display
  const liveScores = useMemo(() => {
    if (allRecaps.length === 0 || !currentDay) {
      return [];
    }

    // Filter recaps to only include days before current day
    const validRecaps = allRecaps
      .filter(r => r.offSeasonDay < currentDay)
      .sort((a, b) => b.offSeasonDay - a.offSeasonDay); // Most recent first

    if (validRecaps.length === 0) {
      return [];
    }

    // Build a map of each corps' score history
    // Key: corpsName, Value: { scores: [{ score, day }], corpsClass }
    const corpsHistory = new Map();

    validRecaps.forEach(recap => {
      recap.shows?.forEach(show => {
        show.results?.forEach(result => {
          // Skip soundSport
          if (result.corpsClass === 'soundSport') return;

          const corpsName = result.corpsName;
          const score = result.totalScore || 0;
          const day = recap.offSeasonDay;

          if (!corpsHistory.has(corpsName)) {
            corpsHistory.set(corpsName, {
              corpsName,
              corpsClass: result.corpsClass,
              uid: result.uid,
              displayName: result.displayName,
              scores: []
            });
          }

          corpsHistory.get(corpsName).scores.push({ score, day });
        });
      });
    });

    // Process each corps to get their latest score and change
    const rankedScores = [];

    corpsHistory.forEach((data, corpsName) => {
      // Sort scores by day (most recent first)
      const sortedScores = data.scores.sort((a, b) => b.day - a.day);

      if (sortedScores.length === 0) return;

      const latestScore = sortedScores[0].score;
      const latestDay = sortedScores[0].day;

      // Find the previous score (from a different day)
      let previousScore = null;
      for (let i = 1; i < sortedScores.length; i++) {
        if (sortedScores[i].day !== latestDay) {
          previousScore = sortedScores[i].score;
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
        corpsName,
        corpsClass: data.corpsClass,
        uid: data.uid,
        displayName: data.displayName,
        score: latestScore,
        change,
        direction,
        showCount: sortedScores.length,
        latestDay
      });
    });

    // Sort by score descending and add ranks
    rankedScores.sort((a, b) => b.score - a.score);
    rankedScores.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return rankedScores;
  }, [allRecaps, currentDay]);

  // Get the display day (most recent day with scores)
  const displayDay = useMemo(() => {
    if (liveScores.length === 0) return null;
    return Math.max(...liveScores.map(s => s.latestDay));
  }, [liveScores]);

  return {
    loading,
    error,
    liveScores,
    displayDay,
    currentDay,
    hasData: liveScores.length > 0
  };
};

export default useLandingScores;
