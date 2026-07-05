// Dashboard data hooks: per-caption lineup scores from historical_scores,
// recent results from fantasy_recaps, and the SoundSport Best in Show tally.
// Effect/memo bodies extracted verbatim from Dashboard.jsx.

import { useState, useEffect, useMemo } from 'react';
import { db } from '../api';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { CAPTIONS } from '../components/Dashboard';
import { getEffectiveDay, processCaptionScores } from '../utils/dashboardScoring';
import { formatRecapDate } from './useScoresData';

export function useLineupScores(lineup, currentDay, activeCorpsClass) {
  const [lineupScoreData, setLineupScoreData] = useState({});
  const [lineupScoresLoading, setLineupScoresLoading] = useState(true);

  // Fetch caption scores from historical_scores
  useEffect(() => {
    const fetchLineupScores = async () => {
      if (!lineup || Object.keys(lineup).length === 0 || !currentDay) {
        setLineupScoreData({});
        setLineupScoresLoading(false);
        return;
      }

      setLineupScoresLoading(true);
      const isSoundSport = activeCorpsClass === 'soundSport';

      try {
        // Calculate effective day (accounting for 2AM score processing)
        const effectiveDay = getEffectiveDay(currentDay);

        // Guard: If effectiveDay is null or < 1, no scores should be visible
        // This handles Day 1 (no previous day exists) and Day 2 before 2 AM (Day 1 not processed yet)
        if (!effectiveDay || effectiveDay < 1) {
          setLineupScoreData({});
          setLineupScoresLoading(false);
          return;
        }

        // Get unique years from lineup
        const yearsNeeded = new Set();
        Object.values(lineup).forEach((value) => {
          if (value) {
            const [, sourceYear] = value.split('|');
            if (sourceYear) yearsNeeded.add(sourceYear);
          }
        });

        // Fetch historical_scores for each year
        const historicalData = {};
        const yearPromises = [...yearsNeeded].map(async (year) => {
          const docSnap = await getDoc(doc(db, `historical_scores/${year}`));
          if (docSnap.exists()) {
            historicalData[year] = docSnap.data().data || [];
          }
        });
        await Promise.all(yearPromises);

        // Process scores for each caption slot
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
            // Process scores for this caption (non-SoundSport)
            scoreData[caption.id] = processCaptionScores(
              yearData,
              corpsName,
              caption.id,
              effectiveDay
            );
          }
        });

        setLineupScoreData(scoreData);
      } catch (error) {
        console.error('Error fetching lineup scores:', error);
      } finally {
        setLineupScoresLoading(false);
      }
    };

    fetchLineupScores();
  }, [lineup, currentDay, activeCorpsClass]);

  return { lineupScoreData, lineupScoresLoading };
}

export function useRecentResults(user, seasonData, activeCorpsClass, currentDay) {
  const [recentResults, setRecentResults] = useState([]);

  // Fetch recent results from fantasy_recaps (for sidebar)
  useEffect(() => {
    const fetchRecentResults = async () => {
      if (!user?.uid || !seasonData?.seasonUid || !activeCorpsClass || !currentDay) return;

      // Calculate effective day - only show scores from days that have been processed
      const effectiveDay = getEffectiveDay(currentDay);

      // If no effective day (e.g., day 1), no results should be visible yet
      if (effectiveDay === null) {
        setRecentResults([]);
        return;
      }

      try {
        // OPTIMIZATION: Read from subcollection instead of single large document
        const recapsCollectionRef = collection(db, 'fantasy_recaps', seasonData.seasonUid, 'days');
        const recapsSnapshot = await getDocs(recapsCollectionRef);

        if (!recapsSnapshot.empty) {
          const recaps = recapsSnapshot.docs.map((d) => d.data());
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

          setRecentResults(results);
        }
      } catch (error) {
        console.error('Error fetching recent results:', error);
      }
    };

    fetchRecentResults();
  }, [user?.uid, seasonData?.seasonUid, activeCorpsClass, currentDay]);

  return recentResults;
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
