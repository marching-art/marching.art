// MatchupDetailView - Enhanced head-to-head matchup comparison with battle point system
// Features: Battle points, caption battles, lineup comparison, detailed breakdown

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Swords, Trophy, TrendingUp, TrendingDown,
  Flame, Medal, Target, Calendar, Zap, Users, Star, Award,
  BarChart3, User
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { GAME_CONFIG } from '../../config';
import { RivalryBadge } from './LeagueActivityFeed';
import BattleBreakdown, { BattleScoreHeader, BattleSummaryBar } from './BattleBreakdown';
import RivalryHistoryCard from './RivalryHistoryCard';
import {
  calculateMatchupBattles,
  calculateHeadToHead,
  createWeeklyPerformance,
  CAPTIONS,
} from '../../utils/matchupScoring';

// Staff position labels for lineup display
const LINEUP_POSITIONS = [
  { key: 'brass', label: 'Brass Caption Head', abbrev: 'B' },
  { key: 'percussion', label: 'Percussion Caption Head', abbrev: 'P' },
  { key: 'colorGuard', label: 'Color Guard Caption Head', abbrev: 'CG' },
  { key: 'visualEnsemble', label: 'Visual Ensemble', abbrev: 'VE' },
  { key: 'visualAnalysis', label: 'Visual Analysis', abbrev: 'VA' },
  { key: 'musicAnalysis', label: 'Music Analysis', abbrev: 'MA' },
  { key: 'generalEffect1', label: 'General Effect 1', abbrev: 'GE1' },
  { key: 'generalEffect2', label: 'General Effect 2', abbrev: 'GE2' },
];

// Mock staff data generator (would be replaced with real data)
const generateMockLineup = (userId, seed = 0) => {
  const staffNames = [
    'John Smith', 'Jane Doe', 'Michael Johnson', 'Emily Brown',
    'David Wilson', 'Sarah Davis', 'Chris Martinez', 'Amanda Taylor',
    'Ryan Anderson', 'Lauren Thomas', 'Kevin Jackson', 'Ashley White',
    'Brandon Harris', 'Rachel Clark', 'Justin Lewis', 'Megan Robinson'
  ];

  const lineup = {};
  LINEUP_POSITIONS.forEach((pos, idx) => {
    const nameIdx = ((userId?.charCodeAt(0) || 65) + idx + seed) % staffNames.length;
    lineup[pos.key] = {
      name: staffNames[nameIdx],
      rating: 70 + Math.floor((((userId?.charCodeAt(1) || 65) + idx * 7) % 30)),
      trend: ['up', 'down', 'stable'][((userId?.charCodeAt(2) || 65) + idx) % 3],
      weekScore: 15 + Math.random() * 5
    };
  });

  return lineup;
};

const MatchupDetailView = ({
  matchup,
  league,
  userProfile,
  memberProfiles,
  standings,
  currentWeek,
  onBack,
  rivalry = null,
}) => {
  const [weeklyScores, setWeeklyScores] = useState({ user1: 0, user2: 0 });
  const [loading, setLoading] = useState(true);
  const [scoreBreakdown, setScoreBreakdown] = useState({ user1: null, user2: null });
  const [battleBreakdown, setBattleBreakdown] = useState(null);
  const [headToHead, setHeadToHead] = useState(null);
  const [activeView, setActiveView] = useState('battles'); // 'battles' | 'overview' | 'lineup' | 'captions' | 'rivalry'
  const [user1Lineup, setUser1Lineup] = useState({});
  const [user2Lineup, setUser2Lineup] = useState({});

  // Get user stats from standings
  const user1Stats = standings.find(s => s.uid === matchup.user1);
  const user2Stats = standings.find(s => s.uid === matchup.user2);

  // Helper to get display name
  const getDisplayName = (uid) => {
    if (uid === userProfile?.uid) return 'You';
    const profile = memberProfiles?.[uid];
    return profile?.displayName || profile?.username || `Director ${uid?.slice(0, 6)}`;
  };

  // Get corps name for a user
  const getCorpsName = (uid) => {
    const profile = memberProfiles?.[uid];
    if (profile?.corps) {
      const activeCorps = Object.values(profile.corps).find(c => c.corpsName || c.name);
      return activeCorps?.corpsName || activeCorps?.name || null;
    }
    return null;
  };

  // Fetch weekly scores, lineups, and calculate battle breakdown
  useEffect(() => {
    const fetchWeeklyScores = async () => {
      setLoading(true);
      try {
        const seasonRef = doc(db, 'game-settings/season');
        const seasonDoc = await getDoc(seasonRef);

        if (seasonDoc.exists()) {
          const sData = seasonDoc.data();
          const recapsRef = doc(db, `fantasy_recaps/${sData.seasonUid}`);
          const recapsDoc = await getDoc(recapsRef);

          if (recapsDoc.exists()) {
            const recaps = recapsDoc.data().recaps || [];
            let score1 = 0, score2 = 0;
            let prevWeekScore1 = 0, prevWeekScore2 = 0;
            const breakdown1 = { shows: [], geTotal: 0, visualTotal: 0, musicTotal: 0 };
            const breakdown2 = { shows: [], geTotal: 0, visualTotal: 0, musicTotal: 0 };
            const user1Shows = [];
            const user2Shows = [];

            recaps.forEach(dayRecap => {
              const weekNum = Math.ceil(dayRecap.offSeasonDay / 7);

              // Current week data
              if (weekNum === matchup.week) {
                dayRecap.shows?.forEach(show => {
                  show.results?.forEach(result => {
                    if (result.uid === matchup.user1) {
                      score1 += result.totalScore || 0;
                      const showData = {
                        showId: show.showId || show.eventName,
                        showName: show.eventName,
                        score: result.totalScore || 0,
                        placement: result.placement,
                        captions: result.captions || {
                          GE1: (result.geScore || 0) / 2,
                          GE2: (result.geScore || 0) / 2,
                          VP: (result.visualScore || 0) / 3,
                          VA: (result.visualScore || 0) / 3,
                          CG: (result.visualScore || 0) / 3,
                          B: (result.musicScore || 0) / 3,
                          MA: (result.musicScore || 0) / 3,
                          P: (result.musicScore || 0) / 3,
                        },
                      };
                      user1Shows.push(showData);
                      breakdown1.shows.push({
                        eventName: show.eventName,
                        score: result.totalScore || 0,
                        geScore: result.geScore || 0,
                        visualScore: result.visualScore || 0,
                        musicScore: result.musicScore || 0
                      });
                      breakdown1.geTotal += result.geScore || 0;
                      breakdown1.visualTotal += result.visualScore || 0;
                      breakdown1.musicTotal += result.musicScore || 0;
                    }
                    if (result.uid === matchup.user2) {
                      score2 += result.totalScore || 0;
                      const showData = {
                        showId: show.showId || show.eventName,
                        showName: show.eventName,
                        score: result.totalScore || 0,
                        placement: result.placement,
                        captions: result.captions || {
                          GE1: (result.geScore || 0) / 2,
                          GE2: (result.geScore || 0) / 2,
                          VP: (result.visualScore || 0) / 3,
                          VA: (result.visualScore || 0) / 3,
                          CG: (result.visualScore || 0) / 3,
                          B: (result.musicScore || 0) / 3,
                          MA: (result.musicScore || 0) / 3,
                          P: (result.musicScore || 0) / 3,
                        },
                      };
                      user2Shows.push(showData);
                      breakdown2.shows.push({
                        eventName: show.eventName,
                        score: result.totalScore || 0,
                        geScore: result.geScore || 0,
                        visualScore: result.visualScore || 0,
                        musicScore: result.musicScore || 0
                      });
                      breakdown2.geTotal += result.geScore || 0;
                      breakdown2.visualTotal += result.visualScore || 0;
                      breakdown2.musicTotal += result.musicScore || 0;
                    }
                  });
                });
              }

              // Previous week data (for momentum calculation)
              if (weekNum === matchup.week - 1) {
                dayRecap.shows?.forEach(show => {
                  show.results?.forEach(result => {
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
                matchup.week,
                user1Shows,
                prevWeekScore1 > 0 ? prevWeekScore1 : undefined
              );
              const user2Performance = createWeeklyPerformance(
                matchup.user2,
                matchup.week,
                user2Shows,
                prevWeekScore2 > 0 ? prevWeekScore2 : undefined
              );

              const battles = calculateMatchupBattles(
                `${league?.id || 'league'}-w${matchup.week}`,
                matchup.week,
                matchup.user1,
                matchup.user2,
                user1Performance,
                user2Performance
              );

              setBattleBreakdown(battles);
            }

            // Calculate head-to-head history from all past matchups
            const allBreakdowns = [];
            for (let week = 1; week < matchup.week; week++) {
              const weekUser1Shows = [];
              const weekUser2Shows = [];
              let weekPrevScore1 = 0;
              let weekPrevScore2 = 0;

              recaps.forEach(dayRecap => {
                const weekNum = Math.ceil(dayRecap.offSeasonDay / 7);
                if (weekNum === week) {
                  dayRecap.shows?.forEach(show => {
                    show.results?.forEach(result => {
                      if (result.uid === matchup.user1) {
                        weekUser1Shows.push({
                          showId: show.showId || show.eventName,
                          showName: show.eventName,
                          score: result.totalScore || 0,
                          placement: result.placement,
                          captions: result.captions || {
                            GE1: (result.geScore || 0) / 2,
                            GE2: (result.geScore || 0) / 2,
                            VP: (result.visualScore || 0) / 3,
                            VA: (result.visualScore || 0) / 3,
                            CG: (result.visualScore || 0) / 3,
                            B: (result.musicScore || 0) / 3,
                            MA: (result.musicScore || 0) / 3,
                            P: (result.musicScore || 0) / 3,
                          },
                        });
                      }
                      if (result.uid === matchup.user2) {
                        weekUser2Shows.push({
                          showId: show.showId || show.eventName,
                          showName: show.eventName,
                          score: result.totalScore || 0,
                          placement: result.placement,
                          captions: result.captions || {
                            GE1: (result.geScore || 0) / 2,
                            GE2: (result.geScore || 0) / 2,
                            VP: (result.visualScore || 0) / 3,
                            VA: (result.visualScore || 0) / 3,
                            CG: (result.visualScore || 0) / 3,
                            B: (result.musicScore || 0) / 3,
                            MA: (result.musicScore || 0) / 3,
                            P: (result.musicScore || 0) / 3,
                          },
                        });
                      }
                    });
                  });
                }
                if (weekNum === week - 1) {
                  dayRecap.shows?.forEach(show => {
                    show.results?.forEach(result => {
                      if (result.uid === matchup.user1) weekPrevScore1 += result.totalScore || 0;
                      if (result.uid === matchup.user2) weekPrevScore2 += result.totalScore || 0;
                    });
                  });
                }
              });

              if (weekUser1Shows.length > 0 || weekUser2Shows.length > 0) {
                const perf1 = createWeeklyPerformance(matchup.user1, week, weekUser1Shows, weekPrevScore1 > 0 ? weekPrevScore1 : undefined);
                const perf2 = createWeeklyPerformance(matchup.user2, week, weekUser2Shows, weekPrevScore2 > 0 ? weekPrevScore2 : undefined);
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
        }

        // Generate mock lineups (would be replaced with real data)
        setUser1Lineup(generateMockLineup(matchup.user1, matchup.week));
        setUser2Lineup(generateMockLineup(matchup.user2, matchup.week));

      } catch (error) {
        console.error('Error fetching weekly scores:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeeklyScores();
  }, [matchup, league?.id]);

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

  const tabs = [
    { id: 'battles', label: 'Battles', icon: Swords },
    { id: 'rivalry', label: 'Rivalry', icon: Flame, badge: headToHead?.totalMatchups > 0 },
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'lineup', label: 'Lineups', icon: Users },
    { id: 'captions', label: 'Shows', icon: Trophy },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-sm p-4"
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-cream-300 hover:text-cream-100 transition-colors mb-4"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Back to Matchups</span>
        </button>

        <div className="flex items-center justify-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-cream-500/60" />
          <span className="text-sm text-cream-500/60">Week {matchup.week} Matchup</span>
          {rivalry && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-sm bg-red-500/20 text-red-400 text-xs font-semibold">
              <Flame className="w-3 h-3" /> Rivalry
            </span>
          )}
        </div>

        <h1 className="text-xl font-display font-bold text-cream-100 text-center">
          Head-to-Head Matchup
        </h1>
      </motion.div>

      {/* Rivalry Card */}
      {rivalry && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
        >
          <RivalryBadge rivalry={rivalry} compact={false} />
        </motion.div>
      )}

      {/* Main Score Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-sm p-6"
      >
        {/* Battle Points Display (when available) */}
        {battleBreakdown && (
          <div className="mb-4 pb-4 border-b border-cream-500/10">
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
            <div className={`w-16 h-16 mx-auto rounded-sm flex items-center justify-center mb-2 ${
              battleBreakdown
                ? battleBreakdown.winnerId === matchup.user1
                  ? 'bg-gradient-to-br from-green-500/30 to-green-600/20 border-2 border-green-500/50'
                  : 'bg-charcoal-800 border-2 border-cream-500/20'
                : user1Leading
                  ? 'bg-gradient-to-br from-green-500/30 to-green-600/20 border-2 border-green-500/50'
                  : 'bg-charcoal-800 border-2 border-cream-500/20'
            }`}>
              <span className="text-2xl font-display font-bold text-cream-100">
                {getDisplayName(matchup.user1).charAt(0)}
              </span>
            </div>
            <p className={`font-display font-bold ${
              matchup.user1 === userProfile?.uid ? 'text-purple-400' : 'text-cream-100'
            }`}>
              {getDisplayName(matchup.user1)}
            </p>
            <p className="text-xs text-cream-500/40 mb-3">
              {getCorpsName(matchup.user1) || 'Unknown Corps'}
            </p>

            <div className={`text-2xl font-display font-bold tabular-nums ${
              battleBreakdown
                ? battleBreakdown.winnerId === matchup.user1
                  ? 'text-green-400'
                  : battleBreakdown.isTie ? 'text-yellow-400' : 'text-cream-100'
                : user1Leading ? 'text-green-400' : tied ? 'text-yellow-400' : 'text-cream-100'
            }`}>
              {loading ? '—' : weeklyScores.user1.toFixed(1)}
            </div>
            <p className="text-[10px] text-cream-500/40 mt-1">Total Score</p>

            {user1Stats && (
              <p className="text-sm text-cream-500/60 mt-2">
                {user1Stats.wins}-{user1Stats.losses} Record
              </p>
            )}
          </div>

          {/* VS Divider */}
          <div className="px-4 py-2 flex flex-col items-center">
            <div className="w-14 h-14 rounded-sm bg-charcoal-900/50 border border-cream-500/20 flex items-center justify-center">
              <Swords className="w-6 h-6 text-purple-400" />
            </div>
            {!loading && scoreDiff > 0 && (
              <div className="mt-2 text-center">
                <span className={`text-xs font-display font-bold ${
                  user1Leading ? 'text-green-400' : 'text-red-400'
                }`}>
                  {user1Leading ? '+' : '-'}{scoreDiff.toFixed(1)}
                </span>
              </div>
            )}
            {tied && !loading && (
              <span className="mt-2 text-xs font-display font-bold text-yellow-400">
                TIE
              </span>
            )}
          </div>

          {/* User 2 */}
          <div className="flex-1 text-center">
            <div className={`w-16 h-16 mx-auto rounded-sm flex items-center justify-center mb-2 ${
              battleBreakdown
                ? battleBreakdown.winnerId === matchup.user2
                  ? 'bg-gradient-to-br from-green-500/30 to-green-600/20 border-2 border-green-500/50'
                  : 'bg-charcoal-800 border-2 border-cream-500/20'
                : user2Leading
                  ? 'bg-gradient-to-br from-green-500/30 to-green-600/20 border-2 border-green-500/50'
                  : 'bg-charcoal-800 border-2 border-cream-500/20'
            }`}>
              <span className="text-2xl font-display font-bold text-cream-100">
                {getDisplayName(matchup.user2).charAt(0)}
              </span>
            </div>
            <p className={`font-display font-bold ${
              matchup.user2 === userProfile?.uid ? 'text-purple-400' : 'text-cream-100'
            }`}>
              {getDisplayName(matchup.user2)}
            </p>
            <p className="text-xs text-cream-500/40 mb-3">
              {getCorpsName(matchup.user2) || 'Unknown Corps'}
            </p>

            <div className={`text-2xl font-display font-bold tabular-nums ${
              battleBreakdown
                ? battleBreakdown.winnerId === matchup.user2
                  ? 'text-green-400'
                  : battleBreakdown.isTie ? 'text-yellow-400' : 'text-cream-100'
                : user2Leading ? 'text-green-400' : tied ? 'text-yellow-400' : 'text-cream-100'
            }`}>
              {loading ? '—' : weeklyScores.user2.toFixed(1)}
            </div>
            <p className="text-[10px] text-cream-500/40 mt-1">Total Score</p>

            {user2Stats && (
              <p className="text-sm text-cream-500/60 mt-2">
                {user2Stats.wins}-{user2Stats.losses} Record
              </p>
            )}
          </div>
        </div>

        {/* Battle Summary Bar (when available) */}
        {battleBreakdown && (
          <div className="mt-4 pt-3 border-t border-cream-500/10">
            <BattleSummaryBar
              homeBattlePoints={battleBreakdown.homeBattlePoints}
              awayBattlePoints={battleBreakdown.awayBattlePoints}
              homeColor={matchup.user1 === userProfile?.uid ? 'purple' : 'green'}
            />
          </div>
        )}

        {/* Win Probability Bar (fallback when no battle data) */}
        {!battleBreakdown && !loading && (weeklyScores.user1 > 0 || weeklyScores.user2 > 0) && (
          <div className="mt-4 pt-3 border-t border-cream-500/10">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className={`font-display font-semibold ${
                winProbability >= 50 ? 'text-green-400' : 'text-cream-500/60'
              }`}>
                {winProbability.toFixed(0)}%
              </span>
              <span className="text-cream-500/40 uppercase tracking-wide text-[10px]">
                Win Probability
              </span>
              <span className={`font-display font-semibold ${
                winProbability < 50 ? 'text-green-400' : 'text-cream-500/60'
              }`}>
                {(100 - winProbability).toFixed(0)}%
              </span>
            </div>
            <div className="h-2 rounded-sm overflow-hidden flex bg-charcoal-800">
              <motion.div
                initial={{ width: '50%' }}
                animate={{ width: `${winProbability}%` }}
                transition={{ type: 'spring', damping: 20 }}
                className={`h-full rounded-l-full ${
                  matchup.user1 === userProfile?.uid ? 'bg-purple-500' :
                  winProbability >= 50 ? 'bg-green-500' : 'bg-cream-500/30'
                }`}
              />
              <motion.div
                initial={{ width: '50%' }}
                animate={{ width: `${100 - winProbability}%` }}
                transition={{ type: 'spring', damping: 20 }}
                className={`h-full rounded-r-full ${
                  matchup.user2 === userProfile?.uid ? 'bg-purple-500' :
                  winProbability < 50 ? 'bg-green-500' : 'bg-cream-500/30'
                }`}
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* View Tabs */}
      <div className="flex gap-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-sm font-display font-semibold transition-all relative ${
                activeView === tab.id
                  ? 'bg-gold-500 text-charcoal-900'
                  : 'glass text-cream-300 hover:text-cream-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${tab.id === 'rivalry' && tab.badge ? 'text-red-400' : ''}`} />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge && activeView !== tab.id && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeView === 'battles' && (
          <motion.div
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
          </motion.div>
        )}

        {activeView === 'rivalry' && (
          <motion.div
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
          </motion.div>
        )}

        {activeView === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Season Stats Comparison */}
            {user1Stats && user2Stats && (
              <div className="glass rounded-sm p-4">
                <h3 className="text-sm font-display font-bold text-cream-100 mb-4 flex items-center gap-2">
                  <Award className="w-4 h-4 text-gold-400" />
                  Season Stats
                </h3>

                <div className="grid grid-cols-3 gap-4">
                  {/* Wins */}
                  <div className="text-center">
                    <p className="text-xs text-cream-500/60 mb-1">Wins</p>
                    <div className="flex items-center justify-center gap-4">
                      <span className={`font-display font-bold text-lg ${
                        user1Stats.wins > user2Stats.wins ? 'text-green-400' : 'text-cream-100'
                      }`}>
                        {user1Stats.wins}
                      </span>
                      <span className="text-cream-500/20">|</span>
                      <span className={`font-display font-bold text-lg ${
                        user2Stats.wins > user1Stats.wins ? 'text-green-400' : 'text-cream-100'
                      }`}>
                        {user2Stats.wins}
                      </span>
                    </div>
                  </div>

                  {/* Total Points */}
                  <div className="text-center">
                    <p className="text-xs text-cream-500/60 mb-1">Total Pts</p>
                    <div className="flex items-center justify-center gap-4">
                      <span className={`font-display font-bold text-lg ${
                        user1Stats.totalPoints > user2Stats.totalPoints ? 'text-gold-400' : 'text-cream-100'
                      }`}>
                        {user1Stats.totalPoints.toFixed(0)}
                      </span>
                      <span className="text-cream-500/20">|</span>
                      <span className={`font-display font-bold text-lg ${
                        user2Stats.totalPoints > user1Stats.totalPoints ? 'text-gold-400' : 'text-cream-100'
                      }`}>
                        {user2Stats.totalPoints.toFixed(0)}
                      </span>
                    </div>
                  </div>

                  {/* Streak */}
                  <div className="text-center">
                    <p className="text-xs text-cream-500/60 mb-1">Streak</p>
                    <div className="flex items-center justify-center gap-4">
                      <span className={`font-display font-bold text-lg flex items-center gap-0.5 ${
                        user1Stats.streakType === 'W' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {user1Stats.streakType === 'W' && <Flame className="w-3 h-3" />}
                        {user1Stats.streakType || '—'}{user1Stats.streak || ''}
                      </span>
                      <span className="text-cream-500/20">|</span>
                      <span className={`font-display font-bold text-lg flex items-center gap-0.5 ${
                        user2Stats.streakType === 'W' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {user2Stats.streakType === 'W' && <Flame className="w-3 h-3" />}
                        {user2Stats.streakType || '—'}{user2Stats.streak || ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Caption Comparison */}
            {!loading && (scoreBreakdown.user1?.shows.length > 0 || scoreBreakdown.user2?.shows.length > 0) && (
              <div className="glass rounded-sm p-4">
                <h3 className="text-sm font-display font-bold text-cream-100 mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-gold-500" />
                  Caption Summary
                </h3>

                <CaptionCompare
                  label="General Effect"
                  score1={scoreBreakdown.user1?.geTotal || 0}
                  score2={scoreBreakdown.user2?.geTotal || 0}
                  color="purple"
                />
                <CaptionCompare
                  label="Visual"
                  score1={scoreBreakdown.user1?.visualTotal || 0}
                  score2={scoreBreakdown.user2?.visualTotal || 0}
                  color="blue"
                />
                <CaptionCompare
                  label="Music"
                  score1={scoreBreakdown.user1?.musicTotal || 0}
                  score2={scoreBreakdown.user2?.musicTotal || 0}
                  color="green"
                />
              </div>
            )}
          </motion.div>
        )}

        {activeView === 'lineup' && (
          <motion.div
            key="lineup"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass rounded-sm overflow-hidden"
          >
            <div className="p-4 border-b border-cream-500/10">
              <h3 className="text-sm font-display font-bold text-cream-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-gold-400" />
                8-Slot Lineup Comparison
              </h3>
              <p className="text-xs text-cream-500/50 mt-1">
                Compare staff positions head-to-head
              </p>
            </div>

            {/* Lineup Header */}
            <div className="flex items-center border-b border-cream-500/10 bg-charcoal-900/50">
              <div className="flex-1 p-3 text-center">
                <p className="font-display font-semibold text-sm text-cream-100">
                  {getDisplayName(matchup.user1)}
                </p>
              </div>
              <div className="w-24 p-3 text-center text-xs text-cream-500/60 font-display uppercase">
                Position
              </div>
              <div className="flex-1 p-3 text-center">
                <p className="font-display font-semibold text-sm text-cream-100">
                  {getDisplayName(matchup.user2)}
                </p>
              </div>
            </div>

            {/* Lineup Slots */}
            <div className="divide-y divide-cream-500/5">
              {LINEUP_POSITIONS.map((position, idx) => {
                const staff1 = user1Lineup[position.key];
                const staff2 = user2Lineup[position.key];
                const user1Wins = (staff1?.weekScore || 0) > (staff2?.weekScore || 0);
                const user2Wins = (staff2?.weekScore || 0) > (staff1?.weekScore || 0);

                return (
                  <motion.div
                    key={position.key}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center hover:bg-cream-500/5 transition-colors"
                  >
                    {/* User 1 Staff */}
                    <div className={`flex-1 p-3 ${
                      user1Wins ? 'bg-green-500/10' : ''
                    }`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${
                          user1Wins ? 'bg-green-500/20' : 'bg-charcoal-800'
                        }`}>
                          <User className={`w-4 h-4 ${
                            user1Wins ? 'text-green-400' : 'text-cream-500/50'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-display text-cream-100 truncate">
                            {staff1?.name || 'Empty'}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${
                              user1Wins ? 'text-green-400 font-bold' : 'text-cream-500/60'
                            }`}>
                              {staff1?.weekScore?.toFixed(1) || '0.0'} pts
                            </span>
                            <span className="text-[10px] text-cream-500/40">
                              OVR {staff1?.rating || 0}
                            </span>
                          </div>
                        </div>
                        {user1Wins && (
                          <div className="w-5 h-5 rounded-sm bg-green-500/20 flex items-center justify-center">
                            <Star className="w-3 h-3 text-green-400" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Position Badge */}
                    <div className="w-24 p-2 flex flex-col items-center justify-center">
                      <div className="px-2 py-1 rounded-sm bg-charcoal-800/80 border border-cream-500/10">
                        <span className="text-xs font-display font-bold text-gold-400">
                          {position.abbrev}
                        </span>
                      </div>
                    </div>

                    {/* User 2 Staff */}
                    <div className={`flex-1 p-3 ${
                      user2Wins ? 'bg-green-500/10' : ''
                    }`}>
                      <div className="flex items-center gap-2 justify-end">
                        {user2Wins && (
                          <div className="w-5 h-5 rounded-sm bg-green-500/20 flex items-center justify-center">
                            <Star className="w-3 h-3 text-green-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 text-right">
                          <p className="text-sm font-display text-cream-100 truncate">
                            {staff2?.name || 'Empty'}
                          </p>
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-[10px] text-cream-500/40">
                              OVR {staff2?.rating || 0}
                            </span>
                            <span className={`text-xs ${
                              user2Wins ? 'text-green-400 font-bold' : 'text-cream-500/60'
                            }`}>
                              {staff2?.weekScore?.toFixed(1) || '0.0'} pts
                            </span>
                          </div>
                        </div>
                        <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${
                          user2Wins ? 'bg-green-500/20' : 'bg-charcoal-800'
                        }`}>
                          <User className={`w-4 h-4 ${
                            user2Wins ? 'text-green-400' : 'text-cream-500/50'
                          }`} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Lineup Summary */}
            <div className="p-4 border-t border-cream-500/10 bg-charcoal-900/50">
              <div className="flex items-center justify-between text-sm">
                <div className="text-center flex-1">
                  <p className="text-cream-500/60 text-xs">Positions Won</p>
                  <p className="font-display font-bold text-green-400">
                    {LINEUP_POSITIONS.filter(p =>
                      (user1Lineup[p.key]?.weekScore || 0) > (user2Lineup[p.key]?.weekScore || 0)
                    ).length}
                  </p>
                </div>
                <div className="w-px h-8 bg-cream-500/20" />
                <div className="text-center flex-1">
                  <p className="text-cream-500/60 text-xs">Positions Won</p>
                  <p className="font-display font-bold text-green-400">
                    {LINEUP_POSITIONS.filter(p =>
                      (user2Lineup[p.key]?.weekScore || 0) > (user1Lineup[p.key]?.weekScore || 0)
                    ).length}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeView === 'captions' && (
          <motion.div
            key="captions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Detailed Caption Breakdown */}
            {!loading && (scoreBreakdown.user1?.shows.length > 0 || scoreBreakdown.user2?.shows.length > 0) && (
              <div className="glass rounded-sm p-4">
                <h3 className="text-sm font-display font-bold text-cream-100 mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-gold-500" />
                  Caption Breakdown
                </h3>

                <CaptionCompare
                  label="General Effect"
                  score1={scoreBreakdown.user1?.geTotal || 0}
                  score2={scoreBreakdown.user2?.geTotal || 0}
                  color="purple"
                />
                <CaptionCompare
                  label="Visual"
                  score1={scoreBreakdown.user1?.visualTotal || 0}
                  score2={scoreBreakdown.user2?.visualTotal || 0}
                  color="blue"
                />
                <CaptionCompare
                  label="Music"
                  score1={scoreBreakdown.user1?.musicTotal || 0}
                  score2={scoreBreakdown.user2?.musicTotal || 0}
                  color="green"
                />
              </div>
            )}

            {/* Shows This Week */}
            <div className="glass rounded-sm overflow-hidden">
              <div className="p-4 border-b border-cream-500/10">
                <h3 className="text-sm font-display font-bold text-cream-100 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-gold-500" />
                  Shows This Week
                </h3>
              </div>

              <div className="divide-y divide-cream-500/5">
                {/* User 1 Shows */}
                {scoreBreakdown.user1?.shows.map((show, idx) => (
                  <div key={`u1-${idx}`} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-sm bg-charcoal-800 flex items-center justify-center">
                        <span className="text-xs font-bold text-cream-500/60">
                          {getDisplayName(matchup.user1).charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-display text-cream-100">{show.eventName}</p>
                        <p className="text-xs text-cream-500/40">
                          {getDisplayName(matchup.user1)}
                        </p>
                      </div>
                    </div>
                    <span className="font-display font-bold text-gold-500">
                      {show.score.toFixed(1)}
                    </span>
                  </div>
                ))}

                {/* User 2 Shows */}
                {scoreBreakdown.user2?.shows.map((show, idx) => (
                  <div key={`u2-${idx}`} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-sm bg-charcoal-800 flex items-center justify-center">
                        <span className="text-xs font-bold text-cream-500/60">
                          {getDisplayName(matchup.user2).charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-display text-cream-100">{show.eventName}</p>
                        <p className="text-xs text-cream-500/40">
                          {getDisplayName(matchup.user2)}
                        </p>
                      </div>
                    </div>
                    <span className="font-display font-bold text-gold-500">
                      {show.score.toFixed(1)}
                    </span>
                  </div>
                ))}

                {scoreBreakdown.user1?.shows.length === 0 && scoreBreakdown.user2?.shows.length === 0 && (
                  <div className="p-8 text-center text-cream-500/40">
                    No shows scored yet this week
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Caption comparison bar component
const CaptionCompare = ({ label, score1, score2, color }) => {
  const total = score1 + score2;
  const percent1 = total > 0 ? (score1 / total) * 100 : 50;
  const percent2 = total > 0 ? (score2 / total) * 100 : 50;

  const colorClasses = {
    purple: { bg1: 'bg-purple-500', bg2: 'bg-purple-400/50' },
    blue: { bg1: 'bg-blue-500', bg2: 'bg-blue-400/50' },
    green: { bg1: 'bg-green-500', bg2: 'bg-green-400/50' }
  };

  const colors = colorClasses[color];

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className={`text-cream-500/60 font-display font-semibold ${
          score1 > score2 ? 'text-green-400' : ''
        }`}>
          {score1.toFixed(1)}
        </span>
        <span className="font-display font-semibold text-cream-300">{label}</span>
        <span className={`text-cream-500/60 font-display font-semibold ${
          score2 > score1 ? 'text-green-400' : ''
        }`}>
          {score2.toFixed(1)}
        </span>
      </div>
      <div className="flex h-2 rounded-sm overflow-hidden bg-charcoal-800">
        <motion.div
          initial={{ width: '50%' }}
          animate={{ width: `${percent1}%` }}
          transition={{ type: 'spring', damping: 20 }}
          className={`${colors.bg1} rounded-l-full`}
        />
        <motion.div
          initial={{ width: '50%' }}
          animate={{ width: `${percent2}%` }}
          transition={{ type: 'spring', damping: 20 }}
          className={`${colors.bg2} rounded-r-full`}
        />
      </div>
    </div>
  );
};

export default MatchupDetailView;
