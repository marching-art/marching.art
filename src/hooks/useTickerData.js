// src/hooks/useTickerData.js
// Hook for fetching real-time ticker data from previous day's scores
// Displays data like a sports stats ticker

import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useSeasonStore } from '../store/seasonStore';
import { calculateCaptionAggregates, calculateTrend } from './useScoresData';

/**
 * Get abbreviated corps name for ticker display
 */
const getCorpsAbbreviation = (name) => {
  const abbreviations = {
    'Blue Devils': 'BD',
    'Carolina Crown': 'CC',
    'Boston Crusaders': 'BAC',
    'Santa Clara Vanguard': 'SCV',
    'The Cavaliers': 'CAV',
    'Phantom Regiment': 'PR',
    'Blue Knights': 'BK',
    'Blue Stars': 'BSTARS',
    'Bluecoats': 'BLOO',
    'The Cadets': 'CAD',
    'Colts': 'COLTS',
    'Crossmen': 'CX',
    'Genesis': 'GEN',
    'Jersey Surf': 'SURF',
    'Madison Scouts': 'MAD',
    'Mandarins': 'MAN',
    'Music City': 'MC',
    'Pacific Crest': 'PC',
    'Phantom Regiment': 'PR',
    'Spartans': 'SPA',
    'Spirit of Atlanta': 'SOA',
    'Troopers': 'TROOP',
  };

  // Try exact match first
  if (abbreviations[name]) return abbreviations[name];

  // Try partial match
  for (const [fullName, abbr] of Object.entries(abbreviations)) {
    if (name.toLowerCase().includes(fullName.toLowerCase()) ||
        fullName.toLowerCase().includes(name.toLowerCase())) {
      return abbr;
    }
  }

  // Fallback: create abbreviation from first letters
  return name
    .split(' ')
    .filter(word => !['The', 'of'].includes(word))
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
};

/**
 * Hook to fetch ticker data from the previous day's shows
 */
export const useTickerData = () => {
  const seasonUid = useSeasonStore((state) => state.seasonUid);
  const currentDay = useSeasonStore((state) => state.currentDay);
  const seasonData = useSeasonStore((state) => state.seasonData);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allRecaps, setAllRecaps] = useState([]);

  // The day to show is the most recent day with scores (currentDay - 1, or latest available)
  const displayDay = useMemo(() => {
    if (allRecaps.length === 0) return null;

    // Find the most recent day that has scores and is before or equal to current day
    const availableDays = allRecaps
      .map(r => r.offSeasonDay)
      .filter(day => day < currentDay)
      .sort((a, b) => b - a);

    return availableDays[0] || null;
  }, [allRecaps, currentDay]);

  // Fetch all recaps for the season
  useEffect(() => {
    const fetchRecaps = async () => {
      if (!seasonUid) return;

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
        console.error('Error fetching ticker data:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchRecaps();
  }, [seasonUid]);

  // Process the previous day's data
  const tickerData = useMemo(() => {
    if (!displayDay || allRecaps.length === 0) {
      return {
        yesterdayScores: [],
        captionLeaders: { ge: null, visual: null, music: null },
        biggestMovers: [],
        seasonLeaders: [],
        dayLabel: 'No Data',
        showCount: 0,
      };
    }

    // Get the recap for the display day
    const dayRecap = allRecaps.find(r => r.offSeasonDay === displayDay);
    if (!dayRecap) {
      return {
        yesterdayScores: [],
        captionLeaders: { ge: null, visual: null, music: null },
        biggestMovers: [],
        seasonLeaders: [],
        dayLabel: `Day ${displayDay}`,
        showCount: 0,
      };
    }

    // Get all results from the day's shows
    const allResults = dayRecap.shows?.flatMap(show =>
      show.results?.map(result => ({
        ...result,
        eventName: show.eventName,
        location: show.location,
      })) || []
    ) || [];

    // Filter out SoundSport
    const filteredResults = allResults.filter(r => r.corpsClass !== 'soundSport');

    // Sort by total score
    const sortedByTotal = [...filteredResults].sort((a, b) =>
      (b.totalScore || 0) - (a.totalScore || 0)
    );

    // Calculate aggregates for each result
    const resultsWithAggregates = sortedByTotal.map(result => {
      const aggregates = calculateCaptionAggregates(result);
      return {
        ...result,
        ...aggregates,
        abbr: getCorpsAbbreviation(result.corpsName),
      };
    });

    // Yesterday's scores (top performers from yesterday)
    const yesterdayScores = resultsWithAggregates.slice(0, 12).map(result => ({
      name: result.abbr,
      fullName: result.corpsName,
      score: (result.totalScore || 0).toFixed(3),
      corpsClass: result.corpsClass,
      eventName: result.eventName,
    }));

    // Caption leaders from yesterday
    const sortedByGE = [...resultsWithAggregates].sort((a, b) => b.GE_Total - a.GE_Total);
    const sortedByVisual = [...resultsWithAggregates].sort((a, b) => b.VIS_Total - a.VIS_Total);
    const sortedByMusic = [...resultsWithAggregates].sort((a, b) => b.MUS_Total - a.MUS_Total);

    const captionLeaders = {
      ge: sortedByGE[0] ? {
        name: sortedByGE[0].abbr,
        fullName: sortedByGE[0].corpsName,
        score: sortedByGE[0].GE_Total.toFixed(3),
      } : null,
      visual: sortedByVisual[0] ? {
        name: sortedByVisual[0].abbr,
        fullName: sortedByVisual[0].corpsName,
        score: sortedByVisual[0].VIS_Total.toFixed(3),
      } : null,
      music: sortedByMusic[0] ? {
        name: sortedByMusic[0].abbr,
        fullName: sortedByMusic[0].corpsName,
        score: sortedByMusic[0].MUS_Total.toFixed(3),
      } : null,
    };

    // Calculate biggest movers (compare today's score to previous shows)
    const biggestMovers = [];
    const previousDayRecap = allRecaps.find(r => r.offSeasonDay === displayDay - 1);

    if (previousDayRecap) {
      const previousResults = new Map();
      previousDayRecap.shows?.forEach(show => {
        show.results?.forEach(result => {
          previousResults.set(result.corpsName, result.totalScore || 0);
        });
      });

      resultsWithAggregates.forEach(result => {
        const prevScore = previousResults.get(result.corpsName);
        if (prevScore) {
          const change = (result.totalScore || 0) - prevScore;
          if (Math.abs(change) > 0.1) {
            biggestMovers.push({
              name: result.abbr,
              fullName: result.corpsName,
              change: change.toFixed(3),
              direction: change > 0 ? 'up' : 'down',
            });
          }
        }
      });

      // Sort by absolute change
      biggestMovers.sort((a, b) => Math.abs(parseFloat(b.change)) - Math.abs(parseFloat(a.change)));
    }

    // Calculate season leaders (aggregate from all shows up to display day)
    const corpsSeasonScores = new Map();

    allRecaps
      .filter(r => r.offSeasonDay <= displayDay)
      .forEach(recap => {
        recap.shows?.forEach(show => {
          show.results?.forEach(result => {
            if (result.corpsClass === 'soundSport') return;

            const corps = result.corpsName;
            if (!corpsSeasonScores.has(corps)) {
              corpsSeasonScores.set(corps, {
                name: corps,
                abbr: getCorpsAbbreviation(corps),
                scores: [],
                corpsClass: result.corpsClass,
              });
            }

            const entry = corpsSeasonScores.get(corps);
            entry.scores.push({
              score: result.totalScore || 0,
              geScore: result.geScore || 0,
              visualScore: result.visualScore || 0,
              musicScore: result.musicScore || 0,
              day: recap.offSeasonDay,
            });
          });
        });
      });

    // Calculate season leaders with trends
    const seasonLeaders = Array.from(corpsSeasonScores.values())
      .map(entry => {
        // Sort scores by day (most recent first)
        entry.scores.sort((a, b) => b.day - a.day);
        const latestScore = entry.scores[0]?.score || 0;
        const trend = calculateTrend(entry.scores.map(s => ({ score: s.score })));

        return {
          name: entry.abbr,
          fullName: entry.name,
          score: latestScore.toFixed(3),
          trend: trend.trend,
          corpsClass: entry.corpsClass,
          showCount: entry.scores.length,
        };
      })
      .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
      .slice(0, 15);

    // Get show count for the day
    const showCount = dayRecap.shows?.length || 0;

    return {
      yesterdayScores,
      captionLeaders,
      biggestMovers: biggestMovers.slice(0, 5),
      seasonLeaders,
      dayLabel: `Day ${displayDay}`,
      showCount,
      date: dayRecap.date?.toDate?.() || new Date(dayRecap.date),
    };
  }, [displayDay, allRecaps]);

  // Caption stats across the season for the day
  const captionStats = useMemo(() => {
    if (!displayDay || allRecaps.length === 0) {
      return { topGE: [], topVisual: [], topMusic: [] };
    }

    // Get aggregate caption leaders across all shows up to display day
    const corpsStats = new Map();

    allRecaps
      .filter(r => r.offSeasonDay <= displayDay)
      .forEach(recap => {
        recap.shows?.forEach(show => {
          show.results?.forEach(result => {
            if (result.corpsClass === 'soundSport') return;

            const corps = result.corpsName;
            const aggregates = calculateCaptionAggregates(result);

            if (!corpsStats.has(corps)) {
              corpsStats.set(corps, {
                name: corps,
                abbr: getCorpsAbbreviation(corps),
                latestGE: 0,
                latestVisual: 0,
                latestMusic: 0,
                latestDay: 0,
              });
            }

            const entry = corpsStats.get(corps);
            if (recap.offSeasonDay >= entry.latestDay) {
              entry.latestGE = aggregates.GE_Total;
              entry.latestVisual = aggregates.VIS_Total;
              entry.latestMusic = aggregates.MUS_Total;
              entry.latestDay = recap.offSeasonDay;
            }
          });
        });
      });

    const allStats = Array.from(corpsStats.values());

    return {
      topGE: [...allStats].sort((a, b) => b.latestGE - a.latestGE).slice(0, 5),
      topVisual: [...allStats].sort((a, b) => b.latestVisual - a.latestVisual).slice(0, 5),
      topMusic: [...allStats].sort((a, b) => b.latestMusic - a.latestMusic).slice(0, 5),
    };
  }, [displayDay, allRecaps]);

  return {
    loading,
    error,
    tickerData,
    captionStats,
    displayDay,
    currentDay,
    seasonData,
    hasData: tickerData.yesterdayScores.length > 0,
  };
};

export default useTickerData;
