/**
 * useLeagueStats - Hook for calculating league-wide battle stats
 *
 * Calculates SeasonMatchupStats for all league members from fantasy recap data.
 * Used to populate leaderboards and individual stat cards.
 */

import { useMemo } from 'react';
import { GAME_CONFIG } from '../config';
import {
  calculateMatchupBattles,
  calculateSeasonStats,
  createWeeklyPerformance,
  initializeCaptionWinRates,
  CAPTIONS,
} from '../utils/matchupScoring';
import type {
  SeasonMatchupStats,
  MatchupBattleBreakdown,
  WeeklyUserPerformance,
  CaptionScores,
} from '../types';

interface DayRecap {
  offSeasonDay: number;
  shows?: {
    showId?: string;
    eventName: string;
    results?: {
      uid: string;
      totalScore?: number;
      geScore?: number;
      visualScore?: number;
      musicScore?: number;
      captions?: CaptionScores;
      placement?: number;
    }[];
  }[];
}

interface WeeklyMatchup {
  user1: string;
  user2: string;
}

interface UseLeagueStatsOptions {
  recaps: DayRecap[];
  weeklyMatchups: Record<number, WeeklyMatchup[]>;
  memberIds: string[];
  currentWeek: number;
  seasonId?: string;
}

interface LeagueStatsResult {
  memberStats: Record<string, SeasonMatchupStats>;
  weeklyBreakdowns: Record<number, MatchupBattleBreakdown[]>;
  loading: boolean;
}

/**
 * Calculate weekly performance for a user from recaps
 */
function calculateWeeklyPerformances(
  userId: string,
  recaps: DayRecap[],
  maxWeek: number
): Record<number, WeeklyUserPerformance> {
  const performances: Record<number, WeeklyUserPerformance> = {};

  for (let week = 1; week <= maxWeek; week++) {
    const shows: {
      showId: string;
      showName: string;
      score: number;
      placement?: number;
      captions?: CaptionScores;
    }[] = [];

    recaps.forEach(dayRecap => {
      const weekNum = Math.ceil(dayRecap.offSeasonDay / 7);
      if (weekNum !== week) return;

      dayRecap.shows?.forEach(show => {
        show.results?.forEach(result => {
          if (result.uid !== userId) return;

          shows.push({
            showId: show.showId || show.eventName,
            showName: show.eventName,
            score: result.totalScore || 0,
            placement: result.placement,
            captions: result.captions || deriveCaptionScores(result),
          });
        });
      });
    });

    if (shows.length > 0) {
      const prevWeekPerf = performances[week - 1];
      performances[week] = createWeeklyPerformance(
        userId,
        week,
        shows,
        prevWeekPerf?.totalScore
      );
    }
  }

  return performances;
}

/**
 * Derive caption scores from aggregate scores when not available
 */
function deriveCaptionScores(result: {
  geScore?: number;
  visualScore?: number;
  musicScore?: number;
}): CaptionScores {
  const ge = result.geScore || 0;
  const visual = result.visualScore || 0;
  const music = result.musicScore || 0;

  return {
    GE1: ge / 2,
    GE2: ge / 2,
    VP: visual / 3,
    VA: visual / 3,
    CG: visual / 3,
    B: music / 3,
    MA: music / 3,
    P: music / 3,
  };
}

/**
 * Main hook for calculating league stats
 */
export function useLeagueStats({
  recaps,
  weeklyMatchups,
  memberIds,
  currentWeek,
  seasonId = 'current',
}: UseLeagueStatsOptions): LeagueStatsResult {
  return useMemo(() => {
    if (!recaps?.length || !memberIds?.length || !weeklyMatchups) {
      return {
        memberStats: {},
        weeklyBreakdowns: {},
        loading: false,
      };
    }

    // Calculate weekly performances for all members
    const memberPerformances: Record<string, Record<number, WeeklyUserPerformance>> = {};
    memberIds.forEach(userId => {
      memberPerformances[userId] = calculateWeeklyPerformances(userId, recaps, currentWeek);
    });

    // Calculate battle breakdowns for all matchups
    const weeklyBreakdowns: Record<number, MatchupBattleBreakdown[]> = {};
    const allBreakdownsByUser: Record<string, MatchupBattleBreakdown[]> = {};

    memberIds.forEach(uid => {
      allBreakdownsByUser[uid] = [];
    });

    for (let week = 1; week <= currentWeek; week++) {
      const matchups = weeklyMatchups[week] || [];
      weeklyBreakdowns[week] = [];

      matchups.forEach(matchup => {
        const homePerf = memberPerformances[matchup.user1]?.[week];
        const awayPerf = memberPerformances[matchup.user2]?.[week];

        // Skip if neither user has data
        if (!homePerf && !awayPerf) return;

        // Create empty performance if one user has no data
        const emptyPerf = (userId: string): WeeklyUserPerformance => ({
          userId,
          week,
          totalScore: 0,
          showCount: 0,
          captions: {},
          shows: [],
          highSingleScore: 0,
        });

        const breakdown = calculateMatchupBattles(
          `matchup-w${week}-${matchup.user1}-${matchup.user2}`,
          week,
          matchup.user1,
          matchup.user2,
          homePerf || emptyPerf(matchup.user1),
          awayPerf || emptyPerf(matchup.user2)
        );

        weeklyBreakdowns[week].push(breakdown);

        // Add to user's breakdown list
        if (allBreakdownsByUser[matchup.user1]) {
          allBreakdownsByUser[matchup.user1].push(breakdown);
        }
        if (allBreakdownsByUser[matchup.user2]) {
          allBreakdownsByUser[matchup.user2].push(breakdown);
        }
      });
    }

    // Calculate season stats for each member
    const memberStats: Record<string, SeasonMatchupStats> = {};

    memberIds.forEach(userId => {
      const breakdowns = allBreakdownsByUser[userId] || [];
      if (breakdowns.length > 0) {
        memberStats[userId] = calculateSeasonStats(userId, seasonId, breakdowns);
      } else {
        // Create empty stats
        memberStats[userId] = {
          userId,
          seasonId,
          wins: 0,
          losses: 0,
          ties: 0,
          winPercentage: 0,
          totalBattlePointsFor: 0,
          totalBattlePointsAgainst: 0,
          avgBattlePointsFor: 0,
          avgBattlePointsAgainst: 0,
          captionWinRates: initializeCaptionWinRates(),
          bestCaption: 'GE1',
          bestCaptionWinRate: 0,
          worstCaption: 'GE1',
          worstCaptionWinRate: 0,
          totalScoreBattlesWon: 0,
          highSingleBattlesWon: 0,
          momentumBattlesWon: 0,
          clutchWins: 0,
          blowoutWins: 0,
          comebackWins: 0,
          currentStreak: 0,
          currentStreakType: null,
          longestWinStreak: 0,
          longestLossStreak: 0,
          bestWeek: { week: 0, battlePoints: 0, opponent: '' },
          worstWeek: { week: 0, battlePoints: 11, opponent: '' },
          highestSingleScore: 0,
          highestSingleScoreWeek: 0,
        };
      }
    });

    return {
      memberStats,
      weeklyBreakdowns,
      loading: false,
    };
  }, [recaps, weeklyMatchups, memberIds, currentWeek, seasonId]);
}

export default useLeagueStats;
