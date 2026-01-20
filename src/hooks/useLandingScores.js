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
 * Get the current hour in Eastern Time (0-23)
 */
const getEasternHour = () => {
  return parseInt(new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false
  }), 10);
};

/**
 * Get the maximum day of scores that should be displayed.
 *
 * IMPORTANT: Scores for Day N are processed at 2 AM ET on Day N+1.
 * This means Day N scores should NOT be visible until 2 AM ET on Day N+1.
 *
 * Example timeline:
 * - Day 5 competition happens on Day 5
 * - Day 5 scores are processed at 2 AM ET on Day 6
 * - Day 5 scores are visible from 2 AM Day 6 until 2 AM Day 7 (24 hours)
 * - Day 6 competition happens on Day 6
 * - Day 6 scores are processed at 2 AM ET on Day 7
 * - Day 6 scores become visible starting at 2 AM Day 7
 *
 * Formula:
 * - Before 2 AM ET: Show scores up to currentDay - 2 (yesterday's processing hasn't run yet)
 * - At/After 2 AM ET: Show scores up to currentDay - 1 (today's processing just ran)
 *
 * @param {number} currentDay - The current season day (1-49)
 * @returns {number|null} The maximum day of scores to show, or null if none
 */
const getMaxScoreDay = (currentDay) => {
  const hour = getEasternHour();

  // Before 2 AM ET: Today's score processing hasn't run yet.
  // The most recent processing was at 2 AM yesterday for the day before yesterday's competition.
  // Example: On Day 7 at 1 AM, Day 6 processing hasn't happened yet, so show Day 5 scores max.
  //
  // At/After 2 AM ET: Today's score processing has completed.
  // It processed yesterday's competition scores.
  // Example: On Day 7 at 3 AM, Day 6 scores were just processed, so show Day 6 scores max.
  const maxScoreDay = hour < 2 ? currentDay - 2 : currentDay - 1;

  // Return null if no scores should be available yet (e.g., Day 1 or Day 2 before 2 AM)
  return maxScoreDay >= 1 ? maxScoreDay : null;
};

/**
 * Hook to fetch live DCI scores for the landing page
 * Returns ranked scores for all selected corps in the current season
 * using actual historical DCI data
 */
export const useLandingScores = ({ enabled = true } = {}) => {
  const seasonData = useSeasonStore((state) => state.seasonData);
  const currentDay = useSeasonStore((state) => state.currentDay);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [corpsValues, setCorpsValues] = useState([]);
  const [historicalData, setHistoricalData] = useState({});

  // Track whether we're past the 2 AM ET score processing time
  // This state updates every minute to ensure we react to the 2 AM boundary
  const [isPastProcessingTime, setIsPastProcessingTime] = useState(() => getEasternHour() >= 2);

  // Set up interval to check if we've crossed the 2 AM boundary
  useEffect(() => {
    const checkProcessingTime = () => {
      const nowPastProcessingTime = getEasternHour() >= 2;
      setIsPastProcessingTime(prev => {
        // Only update if the value actually changed to avoid unnecessary re-renders
        return prev !== nowPastProcessingTime ? nowPastProcessingTime : prev;
      });
    };

    // Check every minute
    const interval = setInterval(checkProcessingTime, 60000);

    return () => clearInterval(interval);
  }, []);

  // Calculate max score day accounting for 2 AM score processing
  // This recalculates when currentDay changes OR when we cross the 2 AM boundary
  const maxScoreDay = useMemo(() => {
    if (!currentDay) return null;
    return getMaxScoreDay(currentDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDay, isPastProcessingTime]);

  // Fetch season corps and historical scores
  useEffect(() => {
    const fetchData = async () => {
      if (!seasonData?.dataDocId || !enabled) {
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
  }, [seasonData?.dataDocId, enabled]);

  // Process scores for landing page display
  const liveScores = useMemo(() => {
    // Guard: If no data or maxScoreDay is null/0, no scores should be visible
    // maxScoreDay is null on Day 1 and Day 2 before 2 AM (no processed scores yet)
    if (corpsValues.length === 0 || Object.keys(historicalData).length === 0 || !maxScoreDay || maxScoreDay < 1) {
      return [];
    }

    // Build a map of each corps' score history
    const corpsScoreHistory = new Map();

    // For each selected corps, gather their scores from historical data
    corpsValues.forEach(corps => {
      const yearData = historicalData[corps.sourceYear] || [];
      const scores = [];

      yearData.forEach(event => {
        // CRITICAL: Never show scores from the current day or future days
        // Day N scores should only be visible starting at 2 AM on Day N+1
        // This is a hard cap to prevent showing today's competition results before they happen
        if (event.offSeasonDay >= currentDay) return;

        // Also respect the 2 AM processing window:
        // Before 2 AM, yesterday's scores haven't been processed yet, so show up to day-2
        // After 2 AM, yesterday's scores were just processed, so show up to day-1
        if (event.offSeasonDay > maxScoreDay) return;

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
  }, [corpsValues, historicalData, maxScoreDay, currentDay]);

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
