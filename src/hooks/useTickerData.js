// src/hooks/useTickerData.js
// Hook for fetching real-time ticker data from all corps' most recent scores across the season
// Displays data like a sports stats ticker, separated by class

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
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
 * Hook to fetch ticker data showing each corps' most recent score across the season
 */
export const useTickerData = ({ enabled = true } = {}) => {
  const seasonUid = useSeasonStore((state) => state.seasonUid);
  const currentDay = useSeasonStore((state) => state.currentDay);
  const seasonData = useSeasonStore((state) => state.seasonData);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allRecaps, setAllRecaps] = useState([]);

  // The day to show is the most recent day with processed scores
  // At 2 AM ET, scores for the current day are processed, so we can show them
  const displayDay = useMemo(() => {
    if (allRecaps.length === 0) return null;

    // Calculate effective day (same logic as Dashboard and useLandingScores)
    // Scores for day N are processed at 2 AM ET and become available after that.
    // After 2 AM ET: previous day's scores were just processed (currentDay - 1)
    // Before 2 AM ET: scores only available up to currentDay - 2 (yesterday's processing hasn't run)
    const hour = parseInt(new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false
    }), 10);
    const calculatedDay = hour < 2 ? currentDay - 2 : currentDay - 1;
    const effectiveDay = calculatedDay >= 1 ? calculatedDay : null;

    // Guard: If effectiveDay is null (Day 1 or Day 2 before 2 AM), no scores should be visible
    if (!effectiveDay || effectiveDay < 1) return null;

    // Find the most recent day that has scores up to and including effective day
    const availableDays = allRecaps
      .map(r => r.offSeasonDay)
      .filter(day => day <= effectiveDay)
      .sort((a, b) => b - a);

    return availableDays[0] || null;
  }, [allRecaps, currentDay]);

  // Fetch all recaps for the season from subcollection
  useEffect(() => {
    const fetchRecaps = async () => {
      if (!seasonUid || !enabled) return;

      try {
        setLoading(true);
        // Try new subcollection format first, fallback to legacy single-document format
        const recapsCollectionRef = collection(db, 'fantasy_recaps', seasonUid, 'days');
        const recapsSnapshot = await getDocs(recapsCollectionRef);

        let recaps = [];
        if (!recapsSnapshot.empty) {
          // New subcollection format
          recaps = recapsSnapshot.docs.map(d => d.data());
        } else {
          // Fallback to legacy single-document format
          const legacyDocRef = doc(db, 'fantasy_recaps', seasonUid);
          const legacyDoc = await getDoc(legacyDocRef);
          if (legacyDoc.exists()) {
            recaps = legacyDoc.data().recaps || [];
          }
        }
        setAllRecaps(recaps);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching ticker data:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchRecaps();
  }, [seasonUid, enabled]);

  // Process the previous day's data - separated by class
  // OPTIMIZED: Single-pass processing to reduce array iterations from O(5n) to O(n)
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

    // Get all recaps up to and including the display day, sorted by day descending
    const relevantRecaps = allRecaps
      .filter(r => r.offSeasonDay <= displayDay)
      .sort((a, b) => b.offSeasonDay - a.offSeasonDay);

    if (relevantRecaps.length === 0) {
      return { ...emptyData, dayLabel: `Season` };
    }

    // Track the most recent score for each corps across all days
    // Key: corpsName, Value: { result, show, day } with most recent data
    const mostRecentByCorps = new Map();
    const soundSportMedals = [];
    let totalShowCount = 0;

    // Process all recaps to find most recent score per corps
    for (const recap of relevantRecaps) {
      totalShowCount += recap.shows?.length || 0;

      recap.shows?.forEach(show => {
        show.results?.forEach(result => {
          if (result.corpsClass === 'soundSport') {
            // Process SoundSport medals - only from the most recent day they performed
            if (!mostRecentByCorps.has(`soundsport_${result.corpsName}`)) {
              mostRecentByCorps.set(`soundsport_${result.corpsName}`, true);
              if (result.placement && result.placement <= 3) {
                soundSportMedals.push({
                  name: getCorpsAbbreviation(result.corpsName),
                  fullName: result.corpsName,
                  medal: result.medal || getMedalFromPlacement(result.placement),
                  eventName: show.eventName,
                  _order: result.placement, // For sorting
                });
              }
            }
          } else if (CLASS_CONFIG[result.corpsClass]) {
            // For regular corps, keep only the most recent score
            if (!mostRecentByCorps.has(result.corpsName)) {
              const aggregates = calculateCaptionAggregates(result);
              mostRecentByCorps.set(result.corpsName, {
                ...result,
                ...aggregates,
                abbr: getCorpsAbbreviation(result.corpsName),
                eventName: show.eventName,
                location: show.location,
                day: recap.offSeasonDay,
              });
            }
          }
        });
      });
    }

    // Group the most recent scores by class
    const resultsByClass = {
      worldClass: [],
      openClass: [],
      aClass: [],
    };
    const allScoredResults = [];

    for (const [corpsName, result] of mostRecentByCorps.entries()) {
      // Skip soundsport tracking entries
      if (corpsName.startsWith('soundsport_')) continue;

      if (CLASS_CONFIG[result.corpsClass]) {
        resultsByClass[result.corpsClass].push(result);
        allScoredResults.push(result);
      }
    }

    // Sort medals by placement order
    soundSportMedals.sort((a, b) => a._order - b._order);

    // Sort each class by score (needed for rankings)
    for (const classKey of Object.keys(resultsByClass)) {
      resultsByClass[classKey].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    }

    // SINGLE PASS over historical recaps: Build both previous scores AND season scores
    // Previously: Two separate loops over allRecaps
    const corpsPreviousScores = new Map();
    const corpsSeasonScores = new Map();

    // Sort recaps once, then process
    const sortedRecaps = [...allRecaps].sort((a, b) => b.offSeasonDay - a.offSeasonDay);

    for (const recap of sortedRecaps) {
      const isBeforeDisplayDay = recap.offSeasonDay < displayDay;
      const isUpToDisplayDay = recap.offSeasonDay <= displayDay;

      // Skip if not relevant for either calculation
      if (!isUpToDisplayDay) continue;

      recap.shows?.forEach(show => {
        show.results?.forEach(result => {
          if (result.corpsClass === 'soundSport') return;

          const corps = result.corpsName;
          const score = result.totalScore || 0;

          // Build previous scores (for movers) - only before display day
          if (isBeforeDisplayDay && !corpsPreviousScores.has(corps)) {
            corpsPreviousScores.set(corps, {
              score,
              corpsClass: result.corpsClass,
              day: recap.offSeasonDay,
            });
          }

          // Build season scores (for leaders) - up to and including display day
          if (!corpsSeasonScores.has(corps)) {
            corpsSeasonScores.set(corps, {
              name: corps,
              abbr: getCorpsAbbreviation(corps),
              scores: [],
              corpsClass: result.corpsClass,
            });
          }
          corpsSeasonScores.get(corps).scores.push({
            score,
            day: recap.offSeasonDay,
          });
        });
      });
    }

    // OPTIMIZED: Build class-separated data with single-pass caption leader tracking
    // Previously: 3 sorts per class (9 total) + 3 sorts for combined = 12 sort operations
    // Now: Track leaders during iteration, only sort when needed
    const byClass = {};
    const availableClasses = [];

    // Track combined caption leaders across all classes during iteration
    const combinedLeaders = {
      ge: [], // Will hold top 8
      visual: [],
      music: [],
    };

    for (const classKey of Object.keys(CLASS_CONFIG)) {
      const classResults = resultsByClass[classKey] || [];

      // Scores for this class (already sorted by total score)
      const scores = classResults.slice(0, 10).map(result => ({
        name: result.abbr,
        fullName: result.corpsName,
        score: (result.totalScore || 0).toFixed(3),
        eventName: result.eventName,
      }));

      // SINGLE PASS: Find caption leaders and calculate movers simultaneously
      let geLeader = null;
      let visualLeader = null;
      let musicLeader = null;
      const movers = [];

      for (const result of classResults) {
        const geScore = result.GE_Total || 0;
        const visScore = result.VIS_Total || 0;
        const musScore = result.MUS_Total || 0;

        // Track class caption leaders
        if (!geLeader || geScore > geLeader.score) {
          geLeader = { result, score: geScore };
        }
        if (!visualLeader || visScore > visualLeader.score) {
          visualLeader = { result, score: visScore };
        }
        if (!musicLeader || musScore > musicLeader.score) {
          musicLeader = { result, score: musScore };
        }

        // Track combined leaders (maintain top 8 for each category)
        const resultEntry = {
          name: result.abbr,
          fullName: result.corpsName,
          corpsClass: result.corpsClass,
        };
        combinedLeaders.ge.push({ ...resultEntry, score: geScore, _score: geScore });
        combinedLeaders.visual.push({ ...resultEntry, score: visScore, _score: visScore });
        combinedLeaders.music.push({ ...resultEntry, score: musScore, _score: musScore });

        // Calculate movers inline
        const prev = corpsPreviousScores.get(result.corpsName);
        if (prev && prev.corpsClass === classKey) {
          const change = (result.totalScore || 0) - prev.score;
          if (Math.abs(change) > 0.1) {
            movers.push({
              name: result.abbr,
              fullName: result.corpsName,
              change: change.toFixed(3),
              direction: change > 0 ? 'up' : 'down',
              currentScore: (result.totalScore || 0).toFixed(3),
              previousScore: prev.score.toFixed(3),
              daysSince: displayDay - prev.day,
              _absChange: Math.abs(change), // For sorting
            });
          }
        }
      }

      // Sort movers by absolute change
      movers.sort((a, b) => b._absChange - a._absChange);

      const captionLeaders = {
        ge: geLeader ? {
          name: geLeader.result.abbr,
          fullName: geLeader.result.corpsName,
          score: geLeader.score.toFixed(3),
        } : null,
        visual: visualLeader ? {
          name: visualLeader.result.abbr,
          fullName: visualLeader.result.corpsName,
          score: visualLeader.score.toFixed(3),
        } : null,
        music: musicLeader ? {
          name: musicLeader.result.abbr,
          fullName: musicLeader.result.corpsName,
          score: musicLeader.score.toFixed(3),
        } : null,
      };

      // Season leaders for this class - optimized with pre-grouped data
      const classSeasonData = [];
      for (const entry of corpsSeasonScores.values()) {
        if (entry.corpsClass !== classKey) continue;

        // Scores are already sorted by day (most recent first from our earlier loop)
        const latestScore = entry.scores[0]?.score || 0;
        const trend = calculateTrend(entry.scores.map(s => ({ score: s.score })));

        classSeasonData.push({
          name: entry.abbr,
          fullName: entry.name,
          score: latestScore.toFixed(3),
          trend: trend.trend,
          showCount: entry.scores.length,
          _score: latestScore, // For sorting
        });
      }
      classSeasonData.sort((a, b) => b._score - a._score);

      byClass[classKey] = {
        scores,
        captionLeaders,
        movers: movers.slice(0, 5),
        leaders: classSeasonData.slice(0, 10),
        label: CLASS_CONFIG[classKey].label,
      };

      // Track which classes have data
      if (scores.length > 0) {
        availableClasses.push(classKey);
      }
    }

    // Sort available classes by config order
    availableClasses.sort((a, b) => CLASS_CONFIG[a].order - CLASS_CONFIG[b].order);

    // Finalize combined caption leaders (sort once, take top 8)
    combinedLeaders.ge.sort((a, b) => b._score - a._score);
    combinedLeaders.visual.sort((a, b) => b._score - a._score);
    combinedLeaders.music.sort((a, b) => b._score - a._score);

    const combinedCaptionLeaders = {
      ge: combinedLeaders.ge.slice(0, 8).map(r => ({
        name: r.name,
        fullName: r.fullName,
        score: r._score.toFixed(3),
        corpsClass: r.corpsClass,
      })),
      visual: combinedLeaders.visual.slice(0, 8).map(r => ({
        name: r.name,
        fullName: r.fullName,
        score: r._score.toFixed(3),
        corpsClass: r.corpsClass,
      })),
      music: combinedLeaders.music.slice(0, 8).map(r => ({
        name: r.name,
        fullName: r.fullName,
        score: r._score.toFixed(3),
        corpsClass: r.corpsClass,
      })),
    };

    // Get the most recent recap for date display
    const mostRecentRecap = relevantRecaps[0];

    return {
      byClass,
      combinedCaptionLeaders,
      soundSportMedals,
      dayLabel: `Season`,
      showCount: totalShowCount,
      date: mostRecentRecap?.date?.toDate?.() || (mostRecentRecap?.date ? new Date(mostRecentRecap.date) : new Date()),
      availableClasses,
      displayDay, // Include for reference if needed
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
