// src/hooks/useLandingScores.js
// Hook for fetching live DCI scores for the landing page
// Shows real historical DCI scores for the selected corps in the current season
// Similar to how ESPN Fantasy shows actual game results

import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useSeasonStore } from '../store/seasonStore';

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
 * Get the effective current day for score filtering
 * Scores are processed at 2 AM, so between midnight and 2 AM
 * we should still show the previous day's cutoff
 */
const getEffectiveDay = (currentDay) => {
  const now = new Date();
  const hour = now.getHours();
  // Between midnight (0) and 2 AM, scores haven't been processed yet
  // So use currentDay - 1 to avoid showing unprocessed scores
  if (hour < 2) {
    return Math.max(1, currentDay - 1);
  }
  return currentDay;
};

/**
 * Hook to fetch live DCI scores for the landing page
 * Returns ranked scores for all selected corps in the current season
 * using actual historical DCI data
 */
export const useLandingScores = () => {
  const seasonData = useSeasonStore((state) => state.seasonData);
  const currentDay = useSeasonStore((state) => state.currentDay);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [corpsValues, setCorpsValues] = useState([]);
  const [historicalData, setHistoricalData] = useState({});

  // Calculate effective day accounting for 2 AM score processing
  const effectiveDay = useMemo(() => {
    if (!currentDay) return null;
    return getEffectiveDay(currentDay);
  }, [currentDay]);

  // Fetch season corps and historical scores
  useEffect(() => {
    const fetchData = async () => {
      if (!seasonData?.dataDocId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // 1. Get corps values (selected corps for each point value)
        const corpsDataDoc = await getDoc(doc(db, `dci-data/${seasonData.dataDocId}`));
        if (!corpsDataDoc.exists()) {
          setLoading(false);
          return;
        }
        const corpsData = corpsDataDoc.data();
        const corps = corpsData.corpsValues || [];
        setCorpsValues(corps);

        // 2. Get unique years to fetch
        const yearsToFetch = [...new Set(corps.map(c => c.sourceYear))];

        // 3. Fetch historical scores for each year
        const historicalPromises = yearsToFetch.map(year =>
          getDoc(doc(db, `historical_scores/${year}`))
        );
        const historicalDocs = await Promise.all(historicalPromises);

        const historical = {};
        historicalDocs.forEach((docSnap) => {
          if (docSnap.exists()) {
            historical[docSnap.id] = docSnap.data().data || [];
          }
        });
        setHistoricalData(historical);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching landing scores:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [seasonData?.dataDocId]);

  // Process scores for landing page display
  const liveScores = useMemo(() => {
    if (corpsValues.length === 0 || Object.keys(historicalData).length === 0 || !effectiveDay) {
      return [];
    }

    // Build a map of each corps' score history
    const corpsScoreHistory = new Map();

    // For each selected corps, gather their scores from historical data
    corpsValues.forEach(corps => {
      const yearData = historicalData[corps.sourceYear] || [];
      const scores = [];

      yearData.forEach(event => {
        // Only include scores from days up to and including the effective day
        // effectiveDay represents the day whose scores have been processed (at 2 AM)
        if (event.offSeasonDay > effectiveDay) return;

        const scoreData = event.scores?.find(s => s.corps === corps.corpsName);
        if (scoreData && scoreData.captions) {
          const totalScore = calculateTotalScore(scoreData.captions);
          // Skip zero scores (treat as blank)
          if (totalScore > 0) {
            scores.push({
              day: event.offSeasonDay,
              date: event.date,
              eventName: event.eventName,
              totalScore,
              captions: scoreData.captions
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
          scores
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
        latestDay
      });
    });

    // Sort by score descending and add ranks
    rankedScores.sort((a, b) => b.score - a.score);
    rankedScores.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return rankedScores;
  }, [corpsValues, historicalData, effectiveDay]);

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
