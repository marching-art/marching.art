/**
 * useLeagueStats - Hook for calculating league-wide battle stats
 *
 * Calculates SeasonMatchupStats for all league members from fantasy recap data.
 * Used to populate leaderboards and individual stat cards.
 */

import { useMemo } from 'react';
import {
  calculateMatchupBattles,
  calculateSeasonStats,
  createWeeklyPerformance,
  initializeCaptionWinRates,
} from '../utils/matchupScoring';
import type {
  SeasonMatchupStats,
  MatchupBattleBreakdown,
  WeeklyUserPerformance,
  CaptionGroupScores,
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
      captions?: CaptionGroupScores;
    }[] = [];

    recaps.forEach((dayRecap) => {
      const weekNum = Math.ceil(dayRecap.offSeasonDay / 7);
      if (weekNum !== week) return;

      dayRecap.shows?.forEach((show) => {
        show.results?.forEach((result) => {
          if (result.uid !== userId) return;

          shows.push({
            showId: show.showId || show.eventName,
            showName: show.eventName,
            score: result.totalScore || 0,
            placement: result.placement,
            // Always the group scores: a recap result's `captions` field, where
            // it exists at all, is the eight-caption shape this no longer uses.
            captions: captionGroupScores(result),
          });
        });
      });
    });

    if (shows.length > 0) {
      const prevWeekPerf = performances[week - 1];
      performances[week] = createWeeklyPerformance(userId, week, shows, prevWeekPerf?.totalScore);
    }
  }

  return performances;
}

/**
 * The three caption groups a show result actually carries.
 *
 * This used to manufacture all eight lineup captions by dividing each group
 * evenly — `GE1 = GE2 = geScore / 2` — and hand them to the battle system as if
 * they were judged numbers. Because both directors got the same even split,
 * GE1 and GE2 always had the identical winner, as did the three visual and the
 * three music captions: eight battles that were really three, weighted 2/3/3.
 * The season-long "best GE1 win rate" leaderboards were the same three answers
 * printed twice and thrice.
 *
 * Storing the real eight is not the fix. They are deliberately unrecorded per
 * show, because publishing them would let an opponent read a director's lineup
 * straight off the recap (docs/CAPTION_WARS_SPEC.md §7).
 */
function captionGroupScores(result: {
  geScore?: number;
  visualScore?: number;
  musicScore?: number;
}): CaptionGroupScores {
  return {
    ge: result.geScore || 0,
    visual: result.visualScore || 0,
    music: result.musicScore || 0,
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
    memberIds.forEach((userId) => {
      memberPerformances[userId] = calculateWeeklyPerformances(userId, recaps, currentWeek);
    });

    // Calculate battle breakdowns for all matchups
    const weeklyBreakdowns: Record<number, MatchupBattleBreakdown[]> = {};
    const allBreakdownsByUser: Record<string, MatchupBattleBreakdown[]> = {};

    memberIds.forEach((uid) => {
      allBreakdownsByUser[uid] = [];
    });

    for (let week = 1; week <= currentWeek; week++) {
      const matchups = weeklyMatchups[week] || [];
      weeklyBreakdowns[week] = [];

      matchups.forEach((matchup) => {
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

    memberIds.forEach((userId) => {
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
          bestCaption: 'ge',
          bestCaptionWinRate: 0,
          worstCaption: 'ge',
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
