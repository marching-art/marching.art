// src/hooks/useTickerData.ts
// Hook for fetching real-time ticker data from all corps' most recent scores across the season
// Displays data like a sports stats ticker, separated by class

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRecentSeasonRecaps, RECENT_RECAP_DAYS } from '../api/season';
import { queryKeys } from '../lib/queryClient';
import { useSeasonStore } from '../store/seasonStore';
import { getEffectiveDay } from '../utils/dashboardScoring';
import { toRecapDate } from '../utils/recap';
import { calculateCaptionAggregates, calculateTrend } from './useScoresData';
import type { CaptionAggregates, DayRecap, RecapResult } from '../types/recap';

// =============================================================================
// TYPES
// =============================================================================

type TickerClassKey = 'worldClass' | 'openClass' | 'aClass';

/** A corps' most recent result, annotated with display metadata. */
type MostRecentEntry = RecapResult &
  CaptionAggregates & {
    abbr: string;
    eventName: string;
    location: string;
    day: number;
  };

interface TickerScoreItem {
  name: string;
  fullName: string;
  score: string;
  eventName: string;
}

interface CaptionLeaderItem {
  name: string;
  fullName: string;
  score: string;
}

interface CombinedLeaderItem {
  name: string;
  fullName: string;
  corpsClass: string;
  score: string | number;
  _score: number;
}

interface MoverItem {
  name: string;
  fullName: string;
  change: string;
  direction: 'up' | 'down';
  currentScore: string;
  previousScore: string;
  daysSince: number;
  _absChange: number;
}

interface LeaderItem {
  name: string;
  fullName: string;
  score: string;
  trend: string;
  showCount: number;
  _score: number;
}

interface SoundSportMedal {
  name: string;
  fullName: string;
  medal: string | null;
  eventName: string;
  _order: number;
}

interface TickerClassData {
  scores: TickerScoreItem[];
  captionLeaders: {
    ge: CaptionLeaderItem | null;
    visual: CaptionLeaderItem | null;
    music: CaptionLeaderItem | null;
  };
  movers: MoverItem[];
  leaders: LeaderItem[];
  label?: string;
}

interface CombinedCaptionLeaders {
  ge: Array<Omit<CombinedLeaderItem, '_score'>>;
  visual: Array<Omit<CombinedLeaderItem, '_score'>>;
  music: Array<Omit<CombinedLeaderItem, '_score'>>;
}

interface TickerData {
  byClass: Record<string, TickerClassData>;
  combinedCaptionLeaders?: CombinedCaptionLeaders;
  soundSportMedals: SoundSportMedal[];
  dayLabel: string;
  showCount: number;
  date?: Date;
  availableClasses: TickerClassKey[];
  displayDay?: number | null;
}

interface CorpsCaptionStat {
  name: string;
  abbr: string;
  corpsClass: string;
  latestGE: number;
  latestVisual: number;
  latestMusic: number;
  latestDay: number;
}

// Class display names and order
const CLASS_CONFIG: Record<TickerClassKey, { label: string; order: number }> = {
  worldClass: { label: 'World Class', order: 1 },
  openClass: { label: 'Open Class', order: 2 },
  aClass: { label: 'A Class', order: 3 },
};

const TICKER_CLASS_KEYS = Object.keys(CLASS_CONFIG) as TickerClassKey[];

const isTickerClass = (corpsClass: string): corpsClass is TickerClassKey =>
  Object.prototype.hasOwnProperty.call(CLASS_CONFIG, corpsClass);

// Medal types for SoundSport
const getMedalFromPlacement = (placement: number): string | null => {
  if (placement === 1) return 'Gold';
  if (placement === 2) return 'Silver';
  if (placement === 3) return 'Bronze';
  return null;
};

/**
 * Get abbreviated corps name for ticker display
 */
const getCorpsAbbreviation = (name: string): string => {
  const abbreviations: Record<string, string> = {
    'Blue Devils': 'BD',
    'Carolina Crown': 'CC',
    'Boston Crusaders': 'BAC',
    'Santa Clara Vanguard': 'SCV',
    'The Cavaliers': 'CAV',
    'Phantom Regiment': 'PR',
    'Blue Knights': 'BK',
    'Blue Stars': 'BSTARS',
    Bluecoats: 'BLOO',
    'The Cadets': 'CAD',
    Colts: 'COLTS',
    Crossmen: 'CX',
    Genesis: 'GEN',
    'Jersey Surf': 'SURF',
    'Madison Scouts': 'MAD',
    Mandarins: 'MAN',
    'Music City': 'MC',
    'Pacific Crest': 'PC',
    Spartans: 'SPA',
    'Spirit of Atlanta': 'SOA',
    Troopers: 'TROOP',
  };

  // Try exact match first
  if (abbreviations[name]) return abbreviations[name];

  // Try partial match
  for (const [fullName, abbr] of Object.entries(abbreviations)) {
    if (
      name.toLowerCase().includes(fullName.toLowerCase()) ||
      fullName.toLowerCase().includes(name.toLowerCase())
    ) {
      return abbr;
    }
  }

  // Fallback: create abbreviation from first letters
  return name
    .split(' ')
    .filter((word) => !['The', 'of'].includes(word))
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
};

/**
 * Hook to fetch ticker data showing each corps' most recent score across the season
 */
export const useTickerData = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const seasonUid = useSeasonStore((state) => state.seasonUid);
  const currentDay = useSeasonStore((state) => state.currentDay);
  const seasonData = useSeasonStore((state) => state.seasonData);

  // The ticker is mounted on every authenticated page, so it uses the bounded
  // recent-days recap query (shared cache entry with the Dashboard
  // recent-results hook) instead of re-downloading the whole season's recap
  // archive on every 5-minute stale refetch. Every ticker stat is a
  // "most recent"/short-window figure, so the RECENT_RECAP_DAYS tail is all
  // it needs.
  const {
    data: allRecapsData,
    isPending: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.fantasyRecapsRecent(seasonUid ?? '', RECENT_RECAP_DAYS),
    queryFn: () => getRecentSeasonRecaps(seasonUid ?? '', RECENT_RECAP_DAYS),
    enabled: !!seasonUid && enabled,
    staleTime: 5 * 60 * 1000,
  });
  const allRecaps = useMemo<DayRecap[]>(() => allRecapsData || [], [allRecapsData]);
  const error = queryError?.message || null;

  // The day to show is the most recent day with processed scores
  // At 2 AM ET, scores for the current day are processed, so we can show them
  const displayDay = useMemo<number | null>(() => {
    if (allRecaps.length === 0) return null;

    // Guard: null on Day 1 (or Day 2 before 2 AM ET) — no processed scores yet
    const effectiveDay = getEffectiveDay(currentDay);
    if (!effectiveDay || effectiveDay < 1) return null;

    // Find the most recent day that has scores up to and including effective day
    const availableDays = allRecaps
      .map((r) => r.offSeasonDay)
      .filter((day) => day <= effectiveDay)
      .sort((a, b) => b - a);

    return availableDays[0] || null;
  }, [allRecaps, currentDay]);

  // Process the previous day's data - separated by class
  // OPTIMIZED: Single-pass processing to reduce array iterations from O(5n) to O(n)
  const tickerData = useMemo<TickerData>(() => {
    const emptyClassData: TickerClassData = {
      scores: [],
      captionLeaders: { ge: null, visual: null, music: null },
      movers: [],
      leaders: [],
    };

    const emptyData: TickerData = {
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
      .filter((r) => r.offSeasonDay <= displayDay)
      .sort((a, b) => b.offSeasonDay - a.offSeasonDay);

    if (relevantRecaps.length === 0) {
      return { ...emptyData, dayLabel: `Season` };
    }

    // Track the most recent score for each corps across all days
    // Key: corpsName, Value: { result, show, day } with most recent data
    // (SoundSport corps get a `true` marker under a prefixed key instead)
    const mostRecentByCorps = new Map<string, MostRecentEntry | true>();
    const soundSportMedals: SoundSportMedal[] = [];
    let totalShowCount = 0;

    // Process all recaps to find most recent score per corps
    for (const recap of relevantRecaps) {
      totalShowCount += recap.shows?.length || 0;

      recap.shows?.forEach((show) => {
        show.results?.forEach((result) => {
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
          } else if (isTickerClass(result.corpsClass)) {
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
    const resultsByClass: Record<TickerClassKey, MostRecentEntry[]> = {
      worldClass: [],
      openClass: [],
      aClass: [],
    };
    const allScoredResults: MostRecentEntry[] = [];

    for (const [corpsName, result] of mostRecentByCorps.entries()) {
      // Skip soundsport tracking entries
      if (corpsName.startsWith('soundsport_') || result === true) continue;

      if (isTickerClass(result.corpsClass)) {
        resultsByClass[result.corpsClass].push(result);
        allScoredResults.push(result);
      }
    }

    // Sort medals by placement order
    soundSportMedals.sort((a, b) => a._order - b._order);

    // Sort each class by score (needed for rankings)
    for (const classKey of TICKER_CLASS_KEYS) {
      resultsByClass[classKey].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    }

    // SINGLE PASS over historical recaps: Build both previous scores AND season scores
    // Previously: Two separate loops over allRecaps
    const corpsPreviousScores = new Map<
      string,
      { score: number; corpsClass: string; day: number }
    >();
    const corpsSeasonScores = new Map<
      string,
      {
        name: string;
        abbr: string;
        scores: Array<{ score: number; day: number }>;
        corpsClass: string;
      }
    >();

    // Sort recaps once, then process
    const sortedRecaps = [...allRecaps].sort((a, b) => b.offSeasonDay - a.offSeasonDay);

    for (const recap of sortedRecaps) {
      const isBeforeDisplayDay = recap.offSeasonDay < displayDay;
      const isUpToDisplayDay = recap.offSeasonDay <= displayDay;

      // Skip if not relevant for either calculation
      if (!isUpToDisplayDay) continue;

      recap.shows?.forEach((show) => {
        show.results?.forEach((result) => {
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
          let seasonEntry = corpsSeasonScores.get(corps);
          if (!seasonEntry) {
            seasonEntry = {
              name: corps,
              abbr: getCorpsAbbreviation(corps),
              scores: [],
              corpsClass: result.corpsClass,
            };
            corpsSeasonScores.set(corps, seasonEntry);
          }
          seasonEntry.scores.push({
            score,
            day: recap.offSeasonDay,
          });
        });
      });
    }

    // OPTIMIZED: Build class-separated data with single-pass caption leader tracking
    // Previously: 3 sorts per class (9 total) + 3 sorts for combined = 12 sort operations
    // Now: Track leaders during iteration, only sort when needed
    const byClass: Record<string, TickerClassData> = {};
    const availableClasses: TickerClassKey[] = [];

    // Track combined caption leaders across all classes during iteration
    const combinedLeaders: Record<'ge' | 'visual' | 'music', CombinedLeaderItem[]> = {
      ge: [], // Will hold top 8
      visual: [],
      music: [],
    };

    for (const classKey of TICKER_CLASS_KEYS) {
      const classResults = resultsByClass[classKey] || [];

      // Scores for this class (already sorted by total score)
      const scores: TickerScoreItem[] = classResults.slice(0, 10).map((result) => ({
        name: result.abbr,
        fullName: result.corpsName,
        score: (result.totalScore || 0).toFixed(3),
        eventName: result.eventName,
      }));

      // SINGLE PASS: Find caption leaders and calculate movers simultaneously
      let geLeader: { result: MostRecentEntry; score: number } | null = null;
      let visualLeader: { result: MostRecentEntry; score: number } | null = null;
      let musicLeader: { result: MostRecentEntry; score: number } | null = null;
      const movers: MoverItem[] = [];

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

      const captionLeaders: TickerClassData['captionLeaders'] = {
        ge: geLeader
          ? {
              name: geLeader.result.abbr,
              fullName: geLeader.result.corpsName,
              score: geLeader.score.toFixed(3),
            }
          : null,
        visual: visualLeader
          ? {
              name: visualLeader.result.abbr,
              fullName: visualLeader.result.corpsName,
              score: visualLeader.score.toFixed(3),
            }
          : null,
        music: musicLeader
          ? {
              name: musicLeader.result.abbr,
              fullName: musicLeader.result.corpsName,
              score: musicLeader.score.toFixed(3),
            }
          : null,
      };

      // Season leaders for this class - optimized with pre-grouped data
      const classSeasonData: LeaderItem[] = [];
      for (const entry of corpsSeasonScores.values()) {
        if (entry.corpsClass !== classKey) continue;

        // Scores are already sorted by day (most recent first from our earlier loop)
        const latestScore = entry.scores[0]?.score || 0;
        const trend = calculateTrend(entry.scores.map((s) => ({ score: s.score })));

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

    const combinedCaptionLeaders: CombinedCaptionLeaders = {
      ge: combinedLeaders.ge.slice(0, 8).map((r) => ({
        name: r.name,
        fullName: r.fullName,
        score: r._score.toFixed(3),
        corpsClass: r.corpsClass,
      })),
      visual: combinedLeaders.visual.slice(0, 8).map((r) => ({
        name: r.name,
        fullName: r.fullName,
        score: r._score.toFixed(3),
        corpsClass: r.corpsClass,
      })),
      music: combinedLeaders.music.slice(0, 8).map((r) => ({
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
      date: toRecapDate(mostRecentRecap?.date) || new Date(),
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
    const corpsStats = new Map<string, CorpsCaptionStat>();

    allRecaps
      .filter((r) => r.offSeasonDay <= displayDay)
      .forEach((recap) => {
        recap.shows?.forEach((show) => {
          show.results?.forEach((result) => {
            if (result.corpsClass === 'soundSport') return;

            const corps = result.corpsName;
            const aggregates = calculateCaptionAggregates(result);

            let entry = corpsStats.get(corps);
            if (!entry) {
              entry = {
                name: corps,
                abbr: getCorpsAbbreviation(corps),
                corpsClass: result.corpsClass,
                latestGE: 0,
                latestVisual: 0,
                latestMusic: 0,
                latestDay: 0,
              };
              corpsStats.set(corps, entry);
            }

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
    const byClass: Record<
      string,
      { topGE: CorpsCaptionStat[]; topVisual: CorpsCaptionStat[]; topMusic: CorpsCaptionStat[] }
    > = {};
    for (const classKey of TICKER_CLASS_KEYS) {
      const classStats = allStats.filter((s) => s.corpsClass === classKey);
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
