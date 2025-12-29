// src/hooks/useTickerData.js
// Hook for fetching real-time ticker data from previous day's scores
// Displays data like a sports stats ticker, separated by class

import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useSeasonStore } from '../store/seasonStore';
import { calculateCaptionAggregates, calculateTrend } from './useScoresData';

// Class display names and order
const CLASS_CONFIG = {
  worldClass: { label: 'World Class', order: 1 },
  openClass: { label: 'Open Class', order: 2 },
  aClass: { label: 'A Class', order: 3 },
};

// Medal types for SoundSport
const getMedalFromPlacement = (placement) => {
  if (placement === 1) return 'Gold';
  if (placement === 2) return 'Silver';
  if (placement === 3) return 'Bronze';
  return null;
};

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

  // Process the previous day's data - separated by class
  const tickerData = useMemo(() => {
    const emptyClassData = {
      scores: [],
      captionLeaders: { ge: null, visual: null, music: null },
      movers: [],
      leaders: [],
    };

    const emptyData = {
      byClass: {
        worldClass: { ...emptyClassData },
        openClass: { ...emptyClassData },
        aClass: { ...emptyClassData },
      },
      soundSportMedals: [],
      dayLabel: 'No Data',
      showCount: 0,
      availableClasses: [],
    };

    if (!displayDay || allRecaps.length === 0) {
      return emptyData;
    }

    // Get the recap for the display day
    const dayRecap = allRecaps.find(r => r.offSeasonDay === displayDay);
    if (!dayRecap) {
      return { ...emptyData, dayLabel: `Day ${displayDay}` };
    }

    // Get all results from the day's shows
    const allResults = dayRecap.shows?.flatMap(show =>
      show.results?.map(result => ({
        ...result,
        eventName: show.eventName,
        location: show.location,
      })) || []
    ) || [];

    // Separate SoundSport and scored classes
    const soundSportResults = allResults.filter(r => r.corpsClass === 'soundSport');
    const scoredResults = allResults.filter(r => r.corpsClass !== 'soundSport');

    // Process SoundSport medals
    const soundSportMedals = soundSportResults
      .filter(r => r.placement && r.placement <= 3)
      .map(result => ({
        name: getCorpsAbbreviation(result.corpsName),
        fullName: result.corpsName,
        medal: result.medal || getMedalFromPlacement(result.placement),
        eventName: result.eventName,
      }))
      .sort((a, b) => {
        const medalOrder = { Gold: 1, Silver: 2, Bronze: 3 };
        return (medalOrder[a.medal] || 99) - (medalOrder[b.medal] || 99);
      });

    // Calculate aggregates for each scored result
    const resultsWithAggregates = scoredResults.map(result => {
      const aggregates = calculateCaptionAggregates(result);
      return {
        ...result,
        ...aggregates,
        abbr: getCorpsAbbreviation(result.corpsName),
      };
    });

    // Group results by class
    const resultsByClass = {};
    for (const classKey of Object.keys(CLASS_CONFIG)) {
      resultsByClass[classKey] = resultsWithAggregates
        .filter(r => r.corpsClass === classKey)
        .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    }

    // Get previous day results for movers calculation
    const previousDayRecap = allRecaps.find(r => r.offSeasonDay === displayDay - 1);
    const previousResults = new Map();
    if (previousDayRecap) {
      previousDayRecap.shows?.forEach(show => {
        show.results?.forEach(result => {
          previousResults.set(result.corpsName, {
            score: result.totalScore || 0,
            corpsClass: result.corpsClass,
          });
        });
      });
    }

    // Calculate season data for leaders
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
              day: recap.offSeasonDay,
            });
          });
        });
      });

    // Build class-separated data
    const byClass = {};
    const availableClasses = [];

    for (const classKey of Object.keys(CLASS_CONFIG)) {
      const classResults = resultsByClass[classKey] || [];

      // Scores for this class
      const scores = classResults.slice(0, 10).map(result => ({
        name: result.abbr,
        fullName: result.corpsName,
        score: (result.totalScore || 0).toFixed(3),
        eventName: result.eventName,
      }));

      // Caption leaders for this class
      const sortedByGE = [...classResults].sort((a, b) => (b.GE_Total || 0) - (a.GE_Total || 0));
      const sortedByVisual = [...classResults].sort((a, b) => (b.VIS_Total || 0) - (a.VIS_Total || 0));
      const sortedByMusic = [...classResults].sort((a, b) => (b.MUS_Total || 0) - (a.MUS_Total || 0));

      const captionLeaders = {
        ge: sortedByGE[0] ? {
          name: sortedByGE[0].abbr,
          fullName: sortedByGE[0].corpsName,
          score: (sortedByGE[0].GE_Total || 0).toFixed(3),
        } : null,
        visual: sortedByVisual[0] ? {
          name: sortedByVisual[0].abbr,
          fullName: sortedByVisual[0].corpsName,
          score: (sortedByVisual[0].VIS_Total || 0).toFixed(3),
        } : null,
        music: sortedByMusic[0] ? {
          name: sortedByMusic[0].abbr,
          fullName: sortedByMusic[0].corpsName,
          score: (sortedByMusic[0].MUS_Total || 0).toFixed(3),
        } : null,
      };

      // Movers for this class
      const movers = [];
      classResults.forEach(result => {
        const prev = previousResults.get(result.corpsName);
        if (prev && prev.corpsClass === classKey) {
          const change = (result.totalScore || 0) - prev.score;
          if (Math.abs(change) > 0.1) {
            movers.push({
              name: result.abbr,
              fullName: result.corpsName,
              change: change.toFixed(3),
              direction: change > 0 ? 'up' : 'down',
            });
          }
        }
      });
      movers.sort((a, b) => Math.abs(parseFloat(b.change)) - Math.abs(parseFloat(a.change)));

      // Season leaders for this class
      const classSeasonData = Array.from(corpsSeasonScores.values())
        .filter(entry => entry.corpsClass === classKey)
        .map(entry => {
          entry.scores.sort((a, b) => b.day - a.day);
          const latestScore = entry.scores[0]?.score || 0;
          const trend = calculateTrend(entry.scores.map(s => ({ score: s.score })));

          return {
            name: entry.abbr,
            fullName: entry.name,
            score: latestScore.toFixed(3),
            trend: trend.trend,
            showCount: entry.scores.length,
          };
        })
        .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
        .slice(0, 10);

      byClass[classKey] = {
        scores,
        captionLeaders,
        movers: movers.slice(0, 5),
        leaders: classSeasonData,
        label: CLASS_CONFIG[classKey].label,
      };

      // Track which classes have data
      if (scores.length > 0) {
        availableClasses.push(classKey);
      }
    }

    // Sort available classes by config order
    availableClasses.sort((a, b) => CLASS_CONFIG[a].order - CLASS_CONFIG[b].order);

    // Build combined caption leaders across all classes
    const allSortedByGE = [...resultsWithAggregates].sort((a, b) => (b.GE_Total || 0) - (a.GE_Total || 0));
    const allSortedByVisual = [...resultsWithAggregates].sort((a, b) => (b.VIS_Total || 0) - (a.VIS_Total || 0));
    const allSortedByMusic = [...resultsWithAggregates].sort((a, b) => (b.MUS_Total || 0) - (a.MUS_Total || 0));

    const combinedCaptionLeaders = {
      ge: allSortedByGE.slice(0, 8).map(r => ({
        name: r.abbr,
        fullName: r.corpsName,
        score: (r.GE_Total || 0).toFixed(3),
        corpsClass: r.corpsClass,
      })),
      visual: allSortedByVisual.slice(0, 8).map(r => ({
        name: r.abbr,
        fullName: r.corpsName,
        score: (r.VIS_Total || 0).toFixed(3),
        corpsClass: r.corpsClass,
      })),
      music: allSortedByMusic.slice(0, 8).map(r => ({
        name: r.abbr,
        fullName: r.corpsName,
        score: (r.MUS_Total || 0).toFixed(3),
        corpsClass: r.corpsClass,
      })),
    };

    // Get show count for the day
    const showCount = dayRecap.shows?.length || 0;

    return {
      byClass,
      combinedCaptionLeaders,
      soundSportMedals,
      dayLabel: `Day ${displayDay}`,
      showCount,
      date: dayRecap.date?.toDate?.() || new Date(dayRecap.date),
      availableClasses,
    };
  }, [displayDay, allRecaps]);

  // Caption stats across the season for the day - separated by class
  const captionStats = useMemo(() => {
    const emptyStats = { topGE: [], topVisual: [], topMusic: [] };

    if (!displayDay || allRecaps.length === 0) {
      return {
        byClass: {
          worldClass: { ...emptyStats },
          openClass: { ...emptyStats },
          aClass: { ...emptyStats },
        },
      };
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
                corpsClass: result.corpsClass,
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

    // Build class-separated caption stats
    const byClass = {};
    for (const classKey of Object.keys(CLASS_CONFIG)) {
      const classStats = allStats.filter(s => s.corpsClass === classKey);
      byClass[classKey] = {
        topGE: [...classStats].sort((a, b) => b.latestGE - a.latestGE).slice(0, 5),
        topVisual: [...classStats].sort((a, b) => b.latestVisual - a.latestVisual).slice(0, 5),
        topMusic: [...classStats].sort((a, b) => b.latestMusic - a.latestMusic).slice(0, 5),
      };
    }

    return { byClass };
  }, [displayDay, allRecaps]);

  // Check if we have any data to display
  const hasData = useMemo(() => {
    return tickerData.availableClasses.length > 0 || tickerData.soundSportMedals.length > 0;
  }, [tickerData]);

  return {
    loading,
    error,
    tickerData,
    captionStats,
    displayDay,
    currentDay,
    seasonData,
    hasData,
  };
};

export default useTickerData;
