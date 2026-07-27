// MatchupDetailView - Enhanced head-to-head matchup comparison with battle point system
// Features: Battle points, caption battles, rivalry history, detailed breakdown

import React, { useState, useEffect, useMemo, memo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Swords, Trophy, Flame, Calendar, BarChart3 } from 'lucide-react';
import { getSeasonData, getSeasonRecaps } from '../../api/season';
import { queryClient, queryKeys } from '../../lib/queryClient';
import { RivalryBadge } from './LeagueActivityFeed';
import BattleBreakdown, { BattleScoreHeader, BattleSummaryBar } from './BattleBreakdown';
import RivalryHistoryCard from './RivalryHistoryCard';
import CaptionWarsScoreboard from './CaptionWarsScoreboard';
import { Heading } from '../ui';
import type { CaptionsBlock } from '../../utils/captionWars';
import type {
  CaptionGroupScores,
  ExtendedHeadToHead,
  MatchupBattleBreakdown,
  RivalryData,
} from '../../types';
import { MatchupOverviewPanel, MatchupShowsPanel, type SideBreakdown } from './MatchupDetailParts';
import {
  calculateMatchupBattles,
  calculateHeadToHead,
  createWeeklyPerformance,
} from '../../utils/matchupScoring';

/**
 * The three caption groups a show result actually carries.
 *
 * This file used to manufacture all eight lineup captions here by dividing each
 * group evenly — `GE1 = GE2 = geScore / 2` — and render them as judged numbers.
 * They were never real: both directors got the same even split, so GE1 and GE2
 * always had the identical winner, as did the three visual and the three music
 * captions. The eight are deliberately unrecorded per show, because publishing
 * them would let an opponent read a director's lineup straight off the recap
 * (docs/CAPTION_WARS_SPEC.md §7), so the fix is to show the three that exist.
 */
/** One scored day, as fantasy_recaps writes it. */
interface DayRecap {
  offSeasonDay: number;
  shows?: Array<{
    showId?: string;
    eventName?: string;
    results?: Array<{
      uid: string;
      totalScore?: number;
      geScore?: number;
      visualScore?: number;
      musicScore?: number;
      placement?: number;
    }>;
  }>;
}

/** One show as the battle system consumes it. */
/** One show as createWeeklyPerformance consumes it. */
interface ShowEntry {
  showId: string;
  showName: string;
  score: number;
  placement?: number;
  captions?: CaptionGroupScores;
}

interface DetailMatchup {
  user1: string;
  user2: string;
  week?: number;
  status?: string;
  corpsClass?: string;
  captions?: CaptionsBlock;
}

interface MatchupDetailViewProps {
  matchup: DetailMatchup;
  league?: { id?: string } | null;
  userProfile?: { uid?: string } | null;
  memberProfiles?: Record<
    string,
    | {
        displayName?: string;
        username?: string;
        corps?: Record<string, { corpsName?: string; name?: string } | undefined>;
      }
    | undefined
  >;
  standings?: Array<{ uid: string; wins: number; losses: number; totalPoints?: number }>;
  currentWeek?: number;
  onBack?: () => void;
  rivalry?: RivalryData | null;
  recaps?: DayRecap[] | null;
}

const captionGroupScores = (result: {
  geScore?: number;
  visualScore?: number;
  musicScore?: number;
}) => ({
  ge: result.geScore || 0,
  visual: result.visualScore || 0,
  music: result.musicScore || 0,
});

const MatchupDetailView = ({
  matchup,
  league,
  userProfile,
  memberProfiles,
  standings = [],
  currentWeek: _currentWeek,
  onBack,
  rivalry = null,
  recaps: recapsProp = null, // OPTIMIZATION: Accept pre-fetched recaps to avoid duplicate query
}: MatchupDetailViewProps) => {
  const [weeklyScores, setWeeklyScores] = useState({ user1: 0, user2: 0 });
  const [loading, setLoading] = useState(true);
  const [scoreBreakdown, setScoreBreakdown] = useState<{
    user1: SideBreakdown | null;
    user2: SideBreakdown | null;
  }>({ user1: null, user2: null });
  const [battleBreakdown, setBattleBreakdown] = useState<MatchupBattleBreakdown | null>(null);
  const [headToHead, setHeadToHead] = useState<ExtendedHeadToHead | null>(null);
  const [activeView, setActiveView] = useState<'battles' | 'overview' | 'captions' | 'rivalry'>(
    'battles'
  );

  // Get user stats from standings
  const user1Stats = standings.find((s) => s.uid === matchup.user1);
  const user2Stats = standings.find((s) => s.uid === matchup.user2);

  // Helper to get display name
  const getDisplayName = (uid?: string) => {
    if (uid === userProfile?.uid) return 'You';
    const profile = uid ? memberProfiles?.[uid] : undefined;
    const name = profile?.displayName;
    if (name && name !== 'Director') return name;
    return profile?.username || name || `Director ${uid?.slice(0, 6)}`;
  };

  // Get corps name for a user
  const getCorpsName = (uid?: string) => {
    const profile = uid ? memberProfiles?.[uid] : undefined;
    if (profile?.corps) {
      const activeCorps = Object.values(profile.corps).find((c) => c?.corpsName || c?.name);
      return activeCorps?.corpsName || activeCorps?.name || null;
    }
    return null;
  };

  // Fetch weekly scores, lineups, and calculate battle breakdown
  useEffect(() => {
    const processRecaps = async () => {
      setLoading(true);
      try {
        // OPTIMIZATION: Use pre-fetched recaps if available (passed from LeagueDetailView)
        // This eliminates a duplicate Firestore query
        let recaps = recapsProp;

        if (!recaps || recaps.length === 0) {
          // Fallback: fetch recaps if not provided (backwards compatibility).
          // Read through the shared react-query cache entries so this reuses
          // the Scores/Dashboard/League archive instead of re-downloading it.
          const sData = await queryClient.fetchQuery({
            queryKey: queryKeys.season(),
            queryFn: () => getSeasonData(),
            staleTime: 5 * 60 * 1000,
          });
          if (sData) {
            recaps = await queryClient.fetchQuery({
              queryKey: queryKeys.fantasyRecaps(sData.seasonUid),
              queryFn: () => getSeasonRecaps(sData.seasonUid),
              // sData.seasonUid is always the *current* season here, so the
              // 5-minute freshness window applies (archived-season reads pin
              // staleTime: Infinity in useScoresData — past days are immutable).
              staleTime: 5 * 60 * 1000,
            });
          }
        }

        if (recaps && recaps.length > 0) {
          // The matchup always carries a week in practice; this is the one
          // place that has to say so for the arithmetic below.
          const week = matchup.week ?? 0;
          let score1 = 0,
            score2 = 0;
          let prevWeekScore1 = 0,
            prevWeekScore2 = 0;
          const breakdown1: SideBreakdown = {
            shows: [],
            geTotal: 0,
            visualTotal: 0,
            musicTotal: 0,
          };
          const breakdown2: SideBreakdown = {
            shows: [],
            geTotal: 0,
            visualTotal: 0,
            musicTotal: 0,
          };
          const user1Shows: ShowEntry[] = [];
          const user2Shows: ShowEntry[] = [];

          (recaps as DayRecap[]).forEach((dayRecap) => {
            const weekNum = Math.ceil(dayRecap.offSeasonDay / 7);

            // Current week data
            if (weekNum === matchup.week) {
              dayRecap.shows?.forEach((show) => {
                show.results?.forEach((result) => {
                  if (result.uid === matchup.user1) {
                    score1 += result.totalScore || 0;
                    const showData = {
                      showId: show.showId || show.eventName || '',
                      showName: show.eventName || '',
                      score: result.totalScore || 0,
                      placement: result.placement,
                      captions: captionGroupScores(result),
                    };
                    user1Shows.push(showData);
                    breakdown1.shows.push({
                      eventName: show.eventName,
                      score: result.totalScore || 0,
                      geScore: result.geScore || 0,
                      visualScore: result.visualScore || 0,
                      musicScore: result.musicScore || 0,
                    });
                    breakdown1.geTotal += result.geScore || 0;
                    breakdown1.visualTotal += result.visualScore || 0;
                    breakdown1.musicTotal += result.musicScore || 0;
                  }
                  if (result.uid === matchup.user2) {
                    score2 += result.totalScore || 0;
                    const showData = {
                      showId: show.showId || show.eventName || '',
                      showName: show.eventName || '',
                      score: result.totalScore || 0,
                      placement: result.placement,
                      captions: captionGroupScores(result),
                    };
                    user2Shows.push(showData);
                    breakdown2.shows.push({
                      eventName: show.eventName,
                      score: result.totalScore || 0,
                      geScore: result.geScore || 0,
                      visualScore: result.visualScore || 0,
                      musicScore: result.musicScore || 0,
                    });
                    breakdown2.geTotal += result.geScore || 0;
                    breakdown2.visualTotal += result.visualScore || 0;
                    breakdown2.musicTotal += result.musicScore || 0;
                  }
                });
              });
            }

            // Previous week data (for momentum calculation)
            if (weekNum === (matchup.week ?? 0) - 1) {
              dayRecap.shows?.forEach((show) => {
                show.results?.forEach((result) => {
                  if (result.uid === matchup.user1) {
                    prevWeekScore1 += result.totalScore || 0;
                  }
                  if (result.uid === matchup.user2) {
                    prevWeekScore2 += result.totalScore || 0;
                  }
                });
              });
            }
          });

          setWeeklyScores({ user1: score1, user2: score2 });
          setScoreBreakdown({ user1: breakdown1, user2: breakdown2 });

          // Calculate battle breakdown if we have data
          if (user1Shows.length > 0 || user2Shows.length > 0) {
            const user1Performance = createWeeklyPerformance(
              matchup.user1,
              week,
              user1Shows,
              prevWeekScore1 > 0 ? prevWeekScore1 : undefined
            );
            const user2Performance = createWeeklyPerformance(
              matchup.user2,
              week,
              user2Shows,
              prevWeekScore2 > 0 ? prevWeekScore2 : undefined
            );

            const battles = calculateMatchupBattles(
              `${league?.id || 'league'}-w${week}`,
              week,
              matchup.user1,
              matchup.user2,
              user1Performance,
              user2Performance
            );

            setBattleBreakdown(battles);
          }

          // Calculate head-to-head history from all past matchups
          const allBreakdowns: MatchupBattleBreakdown[] = [];
          for (let pastWeek = 1; pastWeek < week; pastWeek++) {
            const weekUser1Shows: ShowEntry[] = [];
            const weekUser2Shows: ShowEntry[] = [];
            let weekPrevScore1 = 0;
            let weekPrevScore2 = 0;

            recaps.forEach((dayRecap) => {
              const weekNum = Math.ceil(dayRecap.offSeasonDay / 7);
              if (weekNum === week) {
                dayRecap.shows?.forEach((show) => {
                  show.results?.forEach((result) => {
                    if (result.uid === matchup.user1) {
                      weekUser1Shows.push({
                        showId: show.showId || show.eventName || '',
                        showName: show.eventName || '',
                        score: result.totalScore || 0,
                        placement: result.placement,
                        captions: captionGroupScores(result),
                      });
                    }
                    if (result.uid === matchup.user2) {
                      weekUser2Shows.push({
                        showId: show.showId || show.eventName || '',
                        showName: show.eventName || '',
                        score: result.totalScore || 0,
                        placement: result.placement,
                        captions: captionGroupScores(result),
                      });
                    }
                  });
                });
              }
              if (weekNum === week - 1) {
                dayRecap.shows?.forEach((show) => {
                  show.results?.forEach((result) => {
                    if (result.uid === matchup.user1) weekPrevScore1 += result.totalScore || 0;
                    if (result.uid === matchup.user2) weekPrevScore2 += result.totalScore || 0;
                  });
                });
              }
            });

            if (weekUser1Shows.length > 0 || weekUser2Shows.length > 0) {
              const perf1 = createWeeklyPerformance(
                matchup.user1,
                week,
                weekUser1Shows,
                weekPrevScore1 > 0 ? weekPrevScore1 : undefined
              );
              const perf2 = createWeeklyPerformance(
                matchup.user2,
                week,
                weekUser2Shows,
                weekPrevScore2 > 0 ? weekPrevScore2 : undefined
              );
              const weekBreakdown = calculateMatchupBattles(
                `${league?.id || 'league'}-w${week}`,
                week,
                matchup.user1,
                matchup.user2,
                perf1,
                perf2
              );
              allBreakdowns.push(weekBreakdown);
            }
          }

          if (allBreakdowns.length > 0) {
            const h2h = calculateHeadToHead(matchup.user1, matchup.user2, allBreakdowns);
            setHeadToHead(h2h);
          }
        }
      } catch (error) {
        console.error('Error processing recaps:', error);
      } finally {
        setLoading(false);
      }
    };

    processRecaps();
  }, [matchup, league?.id, recapsProp]);

  const user1Leading = weeklyScores.user1 > weeklyScores.user2;
  const user2Leading = weeklyScores.user2 > weeklyScores.user1;
  const tied = weeklyScores.user1 === weeklyScores.user2 && weeklyScores.user1 > 0;
  const scoreDiff = Math.abs(weeklyScores.user1 - weeklyScores.user2);

  // Calculate win probability
  const winProbability = useMemo(() => {
    const total = weeklyScores.user1 + weeklyScores.user2;
    if (total === 0) return 50;
    return (weeklyScores.user1 / total) * 100;
  }, [weeklyScores]);

  const tabs: Array<{
    id: 'battles' | 'rivalry' | 'overview' | 'captions';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: boolean;
  }> = [
    { id: 'battles', label: 'Battles', icon: Swords },
    { id: 'rivalry', label: 'Rivalry', icon: Flame, badge: (headToHead?.totalMatchups ?? 0) > 0 },
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'captions', label: 'Shows', icon: Trophy },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <m.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-none p-4"
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-secondary hover:text-white transition-colors mb-4"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Back to Matchups</span>
        </button>

        <div className="flex items-center justify-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-muted/60" />
          <span className="text-sm text-muted/60">Week {matchup.week} Matchup</span>
          {rivalry && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-red-500/20 text-red-400 text-xs font-semibold">
              <Flame className="w-3 h-3" /> Rivalry
            </span>
          )}
        </div>

        <Heading level="title" as="h1" className="text-center">
          Head-to-Head Matchup
        </Heading>
      </m.div>

      {/* Rivalry Card */}
      {rivalry && (
        <m.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
        >
          <RivalryBadge rivalry={rivalry} compact={false} />
        </m.div>
      )}

      {/* Main Score Card */}
      <m.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-none p-6"
      >
        {/* Battle Points Display (when available) */}
        {battleBreakdown && (
          <div className="mb-4 pb-4 border-b border-white/10">
            <BattleScoreHeader
              homeBattlePoints={battleBreakdown.homeBattlePoints}
              awayBattlePoints={battleBreakdown.awayBattlePoints}
              homeUserId={matchup.user1}
              awayUserId={matchup.user2}
              currentUserId={userProfile?.uid}
              homeDisplayName={getDisplayName(matchup.user1)}
              awayDisplayName={getDisplayName(matchup.user2)}
              isClutch={battleBreakdown.isClutch}
              isBlowout={battleBreakdown.isBlowout}
              winnerId={battleBreakdown.winnerId}
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          {/* User 1 */}
          <div className="flex-1 text-center">
            <div
              className={`w-16 h-16 mx-auto rounded-none flex items-center justify-center mb-2 ${
                battleBreakdown
                  ? battleBreakdown.winnerId === matchup.user1
                    ? 'bg-success/20 border-2 border-green-500/50'
                    : 'bg-charcoal-800 border-2 border-white/20'
                  : user1Leading
                    ? 'bg-success/20 border-2 border-green-500/50'
                    : 'bg-charcoal-800 border-2 border-white/20'
              }`}
            >
              <span className="text-2xl font-bold text-white">
                {getDisplayName(matchup.user1).charAt(0)}
              </span>
            </div>
            <p
              className={`font-bold ${
                matchup.user1 === userProfile?.uid ? 'text-purple-400' : 'text-white'
              }`}
            >
              {getDisplayName(matchup.user1)}
            </p>
            <p className="text-xs text-muted/40 mb-3">
              {getCorpsName(matchup.user1) || 'Unknown Corps'}
            </p>

            <div
              className={`text-2xl font-bold tabular-nums ${
                battleBreakdown
                  ? battleBreakdown.winnerId === matchup.user1
                    ? 'text-green-400'
                    : battleBreakdown.isTie
                      ? 'text-secondary'
                      : 'text-white'
                  : user1Leading
                    ? 'text-green-400'
                    : tied
                      ? 'text-secondary'
                      : 'text-white'
              }`}
            >
              {loading ? '—' : weeklyScores.user1.toFixed(1)}
            </div>
            <p className="text-[10px] text-muted/40 mt-1">Total Score</p>

            {user1Stats && (
              <p className="text-sm text-muted/60 mt-2">
                {user1Stats.wins}-{user1Stats.losses} Record
              </p>
            )}
          </div>

          {/* VS Divider */}
          <div className="px-4 py-2 flex flex-col items-center">
            <div className="w-14 h-14 rounded-none bg-charcoal-900/50 border border-white/20 flex items-center justify-center">
              <Swords className="w-6 h-6 text-purple-400" />
            </div>
            {!loading && scoreDiff > 0 && (
              <div className="mt-2 text-center">
                <span
                  className={`text-xs font-bold ${
                    user1Leading ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {user1Leading ? '+' : '-'}
                  {scoreDiff.toFixed(1)}
                </span>
              </div>
            )}
            {tied && !loading && <span className="mt-2 text-xs font-bold text-secondary">TIE</span>}
          </div>

          {/* User 2 */}
          <div className="flex-1 text-center">
            <div
              className={`w-16 h-16 mx-auto rounded-none flex items-center justify-center mb-2 ${
                battleBreakdown
                  ? battleBreakdown.winnerId === matchup.user2
                    ? 'bg-success/20 border-2 border-green-500/50'
                    : 'bg-charcoal-800 border-2 border-white/20'
                  : user2Leading
                    ? 'bg-success/20 border-2 border-green-500/50'
                    : 'bg-charcoal-800 border-2 border-white/20'
              }`}
            >
              <span className="text-2xl font-bold text-white">
                {getDisplayName(matchup.user2).charAt(0)}
              </span>
            </div>
            <p
              className={`font-bold ${
                matchup.user2 === userProfile?.uid ? 'text-purple-400' : 'text-white'
              }`}
            >
              {getDisplayName(matchup.user2)}
            </p>
            <p className="text-xs text-muted/40 mb-3">
              {getCorpsName(matchup.user2) || 'Unknown Corps'}
            </p>

            <div
              className={`text-2xl font-bold tabular-nums ${
                battleBreakdown
                  ? battleBreakdown.winnerId === matchup.user2
                    ? 'text-green-400'
                    : battleBreakdown.isTie
                      ? 'text-secondary'
                      : 'text-white'
                  : user2Leading
                    ? 'text-green-400'
                    : tied
                      ? 'text-secondary'
                      : 'text-white'
              }`}
            >
              {loading ? '—' : weeklyScores.user2.toFixed(1)}
            </div>
            <p className="text-[10px] text-muted/40 mt-1">Total Score</p>

            {user2Stats && (
              <p className="text-sm text-muted/60 mt-2">
                {user2Stats.wins}-{user2Stats.losses} Record
              </p>
            )}
          </div>
        </div>

        {/* Battle Summary Bar (when available) */}
        {battleBreakdown && (
          <div className="mt-4 pt-3 border-t border-white/10">
            <BattleSummaryBar
              homeBattlePoints={battleBreakdown.homeBattlePoints}
              awayBattlePoints={battleBreakdown.awayBattlePoints}
              homeColor={matchup.user1 === userProfile?.uid ? 'purple' : 'green'}
            />
          </div>
        )}

        {/* Win Probability Bar (fallback when no battle data) */}
        {!battleBreakdown && !loading && (weeklyScores.user1 > 0 || weeklyScores.user2 > 0) && (
          <div className="mt-4 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-xs mb-2">
              <span
                className={`font-semibold ${
                  winProbability >= 50 ? 'text-green-400' : 'text-muted/60'
                }`}
              >
                {winProbability.toFixed(0)}%
              </span>
              <span className="text-muted/40 uppercase tracking-wide text-[10px]">
                Win Probability
              </span>
              <span
                className={`font-semibold ${
                  winProbability < 50 ? 'text-green-400' : 'text-muted/60'
                }`}
              >
                {(100 - winProbability).toFixed(0)}%
              </span>
            </div>
            <div className="h-2 rounded-none overflow-hidden flex bg-charcoal-800">
              <m.div
                initial={{ width: '50%' }}
                animate={{ width: `${winProbability}%` }}
                transition={{ type: 'spring', damping: 20 }}
                className={`h-full rounded-l-full ${
                  matchup.user1 === userProfile?.uid
                    ? 'bg-purple-500'
                    : winProbability >= 50
                      ? 'bg-green-500'
                      : 'bg-white/30'
                }`}
              />
              <m.div
                initial={{ width: '50%' }}
                animate={{ width: `${100 - winProbability}%` }}
                transition={{ type: 'spring', damping: 20 }}
                className={`h-full rounded-r-full ${
                  matchup.user2 === userProfile?.uid
                    ? 'bg-purple-500'
                    : winProbability < 50
                      ? 'bg-green-500'
                      : 'bg-white/30'
                }`}
              />
            </div>
          </div>
        )}
      </m.div>

      {/* View Tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-none font-semibold transition-all relative ${
                activeView === tab.id
                  ? 'bg-interactive text-white'
                  : 'glass text-secondary hover:text-white'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${tab.id === 'rivalry' && tab.badge ? 'text-red-400' : ''}`}
              />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge && activeView !== tab.id && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* How the week was actually decided, when this league runs Caption
          Wars. Above the tabs because it IS the result, not a detail of it. */}
      {matchup.captions && (
        <div className="px-4 pb-4">
          <CaptionWarsScoreboard
            captions={matchup.captions}
            homeUid={matchup.user1}
            awayUid={matchup.user2}
            homeDisplayName={getDisplayName(matchup.user1)}
            awayDisplayName={getDisplayName(matchup.user2)}
            hideScores={matchup.corpsClass === 'soundSport'}
          />
        </div>
      )}

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeView === 'battles' && (
          <m.div
            key="battles"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <BattleBreakdown
              battleBreakdown={battleBreakdown}
              homeDisplayName={getDisplayName(matchup.user1)}
              awayDisplayName={getDisplayName(matchup.user2)}
              currentUserId={userProfile?.uid}
            />
          </m.div>
        )}

        {activeView === 'rivalry' && (
          <m.div
            key="rivalry"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <RivalryHistoryCard
              headToHead={headToHead}
              user1DisplayName={getDisplayName(matchup.user1)}
              user2DisplayName={getDisplayName(matchup.user2)}
              currentUserId={userProfile?.uid}
            />
          </m.div>
        )}

        {activeView === 'overview' && (
          <MatchupOverviewPanel
            scoreBreakdown={scoreBreakdown}
            user1Stats={user1Stats}
            user2Stats={user2Stats}
            loading={loading}
          />
        )}

        {activeView === 'captions' && (
          <MatchupShowsPanel
            matchup={matchup}
            scoreBreakdown={scoreBreakdown}
            getDisplayName={getDisplayName}
            loading={loading}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(MatchupDetailView);
