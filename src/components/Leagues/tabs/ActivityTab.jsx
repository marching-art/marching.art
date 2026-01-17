// ActivityTab - League insights dashboard with stats, achievements, and activity feed
// Design System: Card-based dashboard with engaging visualizations

import React, { useMemo, useState, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  Bell, Flame, Trophy, TrendingUp, TrendingDown, Target,
  Award, Zap, Crown, Star, Medal, BarChart3, Users,
  Calendar, ChevronRight, Activity, Sparkles, MessageCircle,
  AlertTriangle, Swords
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import LeagueActivityFeed, { RivalryBadge } from '../LeagueActivityFeed';

// League Stats Overview Card
const LeagueStatsOverview = ({ standings, memberProfiles, leagueStats, currentWeek }) => {
  // Calculate league-wide stats
  const stats = useMemo(() => {
    if (!standings || standings.length === 0) return null;

    const totalGames = standings.reduce((sum, s) => sum + s.wins + s.losses, 0) / 2;
    const avgWins = standings.length > 0
      ? (standings.reduce((sum, s) => sum + s.wins, 0) / standings.length).toFixed(1)
      : 0;
    const avgPoints = standings.length > 0
      ? (standings.reduce((sum, s) => sum + (s.totalPoints || 0), 0) / standings.length).toFixed(1)
      : 0;

    // Find highest scorer
    const highestScorer = standings.reduce((prev, curr) =>
      (curr.totalPoints || 0) > (prev.totalPoints || 0) ? curr : prev
    , standings[0]);

    // Find longest streak
    let longestStreak = { player: null, count: 0, type: null };
    standings.forEach(s => {
      if (s.streak > longestStreak.count) {
        longestStreak = { player: s.uid, count: s.streak, type: s.streakType };
      }
    });

    // Calculate competitiveness (how close are standings)
    const winRates = standings.map(s =>
      s.wins + s.losses > 0 ? s.wins / (s.wins + s.losses) : 0
    );
    const avgWinRate = winRates.reduce((a, b) => a + b, 0) / winRates.length;
    const variance = winRates.reduce((sum, r) => sum + Math.pow(r - avgWinRate, 2), 0) / winRates.length;
    const competitiveness = Math.max(0, Math.min(100, (1 - Math.sqrt(variance) * 2) * 100));

    return {
      totalGames,
      avgWins,
      avgPoints,
      highestScorer,
      longestStreak,
      competitiveness,
      memberCount: standings.length,
    };
  }, [standings]);

  if (!stats) {
    return (
      <div className="bg-[#1a1a1a] border border-[#333] p-6 text-center">
        <BarChart3 className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No stats available yet</p>
      </div>
    );
  }

  const getDisplayName = (uid) => {
    const profile = memberProfiles[uid];
    return profile?.displayName || profile?.username || `User ${uid?.slice(0, 6)}`;
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#333]">
      <div className="px-4 py-3 border-b border-[#333] bg-[#222]">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            League Statistics
          </span>
        </div>
      </div>

      <div className="p-4">
        {/* Key Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-[#222] p-3 text-center">
            <p className="text-[10px] uppercase text-gray-500 mb-1">Members</p>
            <p className="text-xl font-bold text-white font-data tabular-nums">
              {stats.memberCount}
            </p>
          </div>
          <div className="bg-[#222] p-3 text-center">
            <p className="text-[10px] uppercase text-gray-500 mb-1">Matchups</p>
            <p className="text-xl font-bold text-yellow-500 font-data tabular-nums">
              {stats.totalGames}
            </p>
          </div>
          <div className="bg-[#222] p-3 text-center">
            <p className="text-[10px] uppercase text-gray-500 mb-1">Week</p>
            <p className="text-xl font-bold text-purple-500 font-data tabular-nums">
              {currentWeek}
            </p>
          </div>
        </div>

        {/* Highlights */}
        <div className="space-y-2">
          {/* Top Scorer */}
          {stats.highestScorer && (
            <div className="flex items-center justify-between p-3 bg-[#222]">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-gray-400">Top Scorer</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {getDisplayName(stats.highestScorer.uid)}
                </span>
                <span className="text-sm font-bold text-yellow-500 font-data tabular-nums">
                  {stats.highestScorer.totalPoints?.toFixed(1)}
                </span>
              </div>
            </div>
          )}

          {/* Longest Streak */}
          {stats.longestStreak.count > 0 && (
            <div className="flex items-center justify-between p-3 bg-[#222]">
              <div className="flex items-center gap-2">
                <Flame className={`w-4 h-4 ${
                  stats.longestStreak.type === 'W' ? 'text-green-500' : 'text-red-500'
                }`} />
                <span className="text-xs text-gray-400">
                  {stats.longestStreak.type === 'W' ? 'Hot Streak' : 'Cold Streak'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {getDisplayName(stats.longestStreak.player)}
                </span>
                <span className={`text-sm font-bold font-data tabular-nums ${
                  stats.longestStreak.type === 'W' ? 'text-green-500' : 'text-red-500'
                }`}>
                  {stats.longestStreak.type}{stats.longestStreak.count}
                </span>
              </div>
            </div>
          )}

          {/* Competitiveness Meter */}
          <div className="p-3 bg-[#222]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-500" />
                <span className="text-xs text-gray-400">League Competitiveness</span>
              </div>
              <span className="text-sm font-bold text-purple-500">
                {stats.competitiveness.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-[#333] overflow-hidden">
              <m.div
                initial={{ width: 0 }}
                animate={{ width: `${stats.competitiveness}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              />
            </div>
            <p className="text-[9px] text-gray-500 mt-1">
              {stats.competitiveness > 70 ? 'Very competitive league!' :
               stats.competitiveness > 40 ? 'Balanced competition' :
               'Some dominant players'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Achievements Card - Shows league milestones and badges
const AchievementsCard = ({ standings, leagueStats, userProfile }) => {
  // Calculate achievements
  const achievements = useMemo(() => {
    const list = [];

    if (!standings || standings.length === 0) return list;

    const userStanding = standings.find(s => s.uid === userProfile?.uid);
    const userLeagueStats = leagueStats?.[userProfile?.uid];

    if (userStanding) {
      // Perfect Record
      if (userStanding.wins > 0 && userStanding.losses === 0) {
        list.push({
          id: 'undefeated',
          title: 'Undefeated',
          description: 'No losses this season',
          icon: Crown,
          color: 'yellow',
          earned: true,
        });
      }

      // Win Streak achievements
      if (userStanding.streak >= 3 && userStanding.streakType === 'W') {
        list.push({
          id: 'hot_streak',
          title: 'Hot Streak',
          description: `${userStanding.streak} wins in a row!`,
          icon: Flame,
          color: 'orange',
          earned: true,
        });
      }

      // Top 3
      const rank = standings.findIndex(s => s.uid === userProfile?.uid) + 1;
      if (rank === 1) {
        list.push({
          id: 'first_place',
          title: 'League Leader',
          description: 'Currently in 1st place',
          icon: Trophy,
          color: 'yellow',
          earned: true,
        });
      } else if (rank <= 3) {
        list.push({
          id: 'podium',
          title: 'Podium Position',
          description: `Currently in ${rank}${rank === 2 ? 'nd' : 'rd'} place`,
          icon: Medal,
          color: rank === 2 ? 'gray' : 'orange',
          earned: true,
        });
      }
    }

    if (userLeagueStats) {
      // Clutch performer
      if (userLeagueStats.clutchWins >= 2) {
        list.push({
          id: 'clutch',
          title: 'Clutch Performer',
          description: `${userLeagueStats.clutchWins} close wins`,
          icon: Zap,
          color: 'purple',
          earned: true,
        });
      }

      // Blowout artist
      if (userLeagueStats.blowoutWins >= 2) {
        list.push({
          id: 'dominator',
          title: 'Dominator',
          description: `${userLeagueStats.blowoutWins} blowout wins`,
          icon: Star,
          color: 'red',
          earned: true,
        });
      }
    }

    // Add locked achievements if few earned
    if (list.length < 3) {
      const locked = [
        { id: 'locked_1', title: 'Season Champion', description: 'Win the league', icon: Crown, color: 'gray', earned: false },
        { id: 'locked_2', title: 'Perfect Week', description: 'Win all matchups in a week', icon: Star, color: 'gray', earned: false },
        { id: 'locked_3', title: 'Rivalry Master', description: 'Win 5 rivalry matchups', icon: Flame, color: 'gray', earned: false },
      ];
      list.push(...locked.slice(0, 3 - list.length));
    }

    return list;
  }, [standings, leagueStats, userProfile?.uid]);

  const colorClasses = {
    yellow: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
    orange: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
    purple: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    red: 'text-red-500 bg-red-500/10 border-red-500/30',
    gray: 'text-gray-500 bg-gray-500/10 border-gray-500/30',
    green: 'text-green-500 bg-green-500/10 border-green-500/30',
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#333]">
      <div className="px-4 py-3 border-b border-[#333] bg-[#222]">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-yellow-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Achievements
          </span>
        </div>
      </div>

      <div className="p-3 grid grid-cols-3 gap-2">
        {achievements.slice(0, 6).map(achievement => {
          const Icon = achievement.icon;
          const colors = colorClasses[achievement.color];

          return (
            <div
              key={achievement.id}
              className={`p-3 text-center border ${
                achievement.earned
                  ? colors
                  : 'border-[#333] bg-[#222] opacity-50'
              }`}
            >
              <div className={`w-8 h-8 mx-auto mb-2 flex items-center justify-center ${
                achievement.earned ? colors.split(' ')[1] : 'bg-[#333]'
              }`}>
                <Icon className={`w-4 h-4 ${
                  achievement.earned ? colors.split(' ')[0] : 'text-gray-600'
                }`} />
              </div>
              <p className={`text-xs font-bold truncate ${
                achievement.earned ? 'text-white' : 'text-gray-600'
              }`}>
                {achievement.title}
              </p>
              <p className="text-[9px] text-gray-500 mt-0.5 truncate">
                {achievement.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Power Rankings - Predictive standings based on trends
const PowerRankingsCard = ({ standings, memberProfiles, userProfile }) => {
  // Calculate power rankings based on recent performance
  const powerRankings = useMemo(() => {
    if (!standings || standings.length === 0) return [];

    return standings.map((s, idx) => {
      let powerScore = 0;

      // Base score from wins
      powerScore += s.wins * 10;

      // Bonus for streak
      if (s.streakType === 'W') {
        powerScore += s.streak * 5;
      } else if (s.streakType === 'L') {
        powerScore -= s.streak * 3;
      }

      // Points bonus
      powerScore += (s.totalPoints || 0) * 0.1;

      // Momentum bonus
      if (s.trend === 'up') powerScore += 5;
      if (s.trend === 'down') powerScore -= 5;

      return {
        ...s,
        powerScore,
        currentRank: idx + 1,
      };
    })
    .sort((a, b) => b.powerScore - a.powerScore)
    .map((s, idx) => ({
      ...s,
      powerRank: idx + 1,
      movement: s.currentRank - (idx + 1), // Positive = moving up
    }));
  }, [standings]);

  const getDisplayName = (uid) => {
    if (uid === userProfile?.uid) return 'You';
    const profile = memberProfiles[uid];
    return profile?.displayName || profile?.username || `User ${uid?.slice(0, 6)}`;
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#333]">
      <div className="px-4 py-3 border-b border-[#333] bg-[#222]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pink-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Power Rankings
            </span>
          </div>
          <span className="text-[9px] text-gray-500">Based on performance trends</span>
        </div>
      </div>

      <div className="divide-y divide-[#222]">
        {powerRankings.slice(0, 5).map((player, idx) => {
          const isUser = player.uid === userProfile?.uid;
          const isMovingUp = player.movement > 0;
          const isMovingDown = player.movement < 0;

          return (
            <div
              key={player.uid}
              className={`px-4 py-3 flex items-center justify-between ${
                isUser ? 'bg-purple-500/10' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 flex items-center justify-center text-xs font-bold ${
                  idx === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                  idx === 1 ? 'bg-gray-500/20 text-gray-400' :
                  idx === 2 ? 'bg-orange-500/20 text-orange-500' :
                  'bg-[#333] text-gray-500'
                }`}>
                  {idx + 1}
                </div>
                <span className={`text-sm font-bold ${isUser ? 'text-purple-400' : 'text-white'}`}>
                  {getDisplayName(player.uid)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {player.movement !== 0 && (
                  <div className={`flex items-center gap-0.5 text-xs ${
                    isMovingUp ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {isMovingUp ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    <span className="font-bold">{Math.abs(player.movement)}</span>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-xs text-gray-500">Power</p>
                  <p className="text-sm font-bold text-pink-500 font-data tabular-nums">
                    {player.powerScore.toFixed(0)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Weekly Recap Card - Displays auto-generated weekly highlights
const WeeklyRecapCard = ({ leagueId, currentWeek, memberProfiles }) => {
  const [recap, setRecap] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecap = async () => {
      if (!leagueId || currentWeek < 1) {
        setLoading(false);
        return;
      }

      try {
        // Try to fetch the most recent recap
        const recapRef = doc(db, `artifacts/marching-art/leagues/${leagueId}/recaps/week-${currentWeek}`);
        const recapDoc = await getDoc(recapRef);

        if (recapDoc.exists()) {
          setRecap(recapDoc.data());
        } else if (currentWeek > 1) {
          // Try previous week
          const prevRecapRef = doc(db, `artifacts/marching-art/leagues/${leagueId}/recaps/week-${currentWeek - 1}`);
          const prevRecapDoc = await getDoc(prevRecapRef);
          if (prevRecapDoc.exists()) {
            setRecap(prevRecapDoc.data());
          }
        }
      } catch (error) {
        console.error('Error fetching recap:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecap();
  }, [leagueId, currentWeek]);

  if (loading) {
    return (
      <div className="bg-[#1a1a1a] border border-[#333] p-6">
        <div className="animate-pulse flex flex-col gap-3">
          <div className="h-4 bg-[#333] rounded w-1/3" />
          <div className="h-12 bg-[#333] rounded" />
          <div className="h-12 bg-[#333] rounded" />
        </div>
      </div>
    );
  }

  if (!recap || !recap.highlights || recap.highlights.length === 0) {
    return null; // Don't show anything if no recap
  }

  const getHighlightIcon = (type) => {
    switch (type) {
      case 'upset': return AlertTriangle;
      case 'close_game': return Swords;
      case 'top_scorer': return Trophy;
      default: return Star;
    }
  };

  const getHighlightColor = (type) => {
    switch (type) {
      case 'upset': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'close_game': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'top_scorer': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      default: return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#333]">
      <div className="px-4 py-3 border-b border-[#333] bg-gradient-to-r from-[#222] to-purple-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-purple-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
              Week {recap.week} Recap
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Swords className="w-3 h-3" />
            <span>{recap.stats?.totalMatchups || 0} matchups</span>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {recap.highlights.slice(0, 3).map((highlight, idx) => {
          const Icon = getHighlightIcon(highlight.type);
          const colorClasses = getHighlightColor(highlight.type);

          return (
            <m.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`p-3 border ${colorClasses}`}
            >
              <div className="flex items-start gap-2">
                <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${colorClasses.split(' ')[0]}`} />
                <p className="text-sm text-white">{highlight.text}</p>
              </div>
            </m.div>
          );
        })}

        {/* Recap Stats Summary */}
        {recap.stats && (
          <div className="grid grid-cols-3 gap-2 pt-2">
            {recap.stats.biggestUpset && (
              <div className="bg-[#222] p-2 text-center">
                <AlertTriangle className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                <p className="text-[9px] text-gray-500 uppercase">Upset</p>
                <p className="text-xs font-bold text-white truncate">
                  {recap.stats.biggestUpset.magnitude} ranks
                </p>
              </div>
            )}
            {recap.stats.closestMatch && (
              <div className="bg-[#222] p-2 text-center">
                <Swords className="w-4 h-4 text-red-500 mx-auto mb-1" />
                <p className="text-[9px] text-gray-500 uppercase">Closest</p>
                <p className="text-xs font-bold text-white truncate">
                  {recap.stats.closestMatch.margin?.toFixed(1)} pts
                </p>
              </div>
            )}
            {recap.stats.highestScorer && (
              <div className="bg-[#222] p-2 text-center">
                <Trophy className="w-4 h-4 text-yellow-500 mx-auto mb-1" />
                <p className="text-[9px] text-gray-500 uppercase">Top Score</p>
                <p className="text-xs font-bold text-white truncate">
                  {recap.stats.highestScorer.score?.toFixed(1)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Enhanced Rivalries Card - Shows rivalries with intensity levels
const EnhancedRivalriesCard = ({ leagueId, userProfile, memberProfiles }) => {
  const [rivalries, setRivalries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchRivalries = async () => {
      if (!leagueId) {
        setLoading(false);
        return;
      }

      try {
        const rivalriesRef = doc(db, `artifacts/marching-art/leagues/${leagueId}/meta/rivalries`);
        const rivalriesDoc = await getDoc(rivalriesRef);

        if (rivalriesDoc.exists()) {
          const data = rivalriesDoc.data();
          // Filter to show rivalries involving the current user
          const userRivalries = (data.rivalries || []).filter(r =>
            r.player1 === userProfile?.uid || r.player2 === userProfile?.uid
          );
          setRivalries(userRivalries);
        }
      } catch (error) {
        console.error('Error fetching rivalries:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRivalries();
  }, [leagueId, userProfile?.uid]);

  if (loading || rivalries.length === 0) {
    return null;
  }

  const getIntensityStyles = (intensity) => {
    switch (intensity) {
      case 'intense':
        return {
          bg: 'bg-gradient-to-r from-red-500/20 to-orange-500/20',
          border: 'border-red-500/50',
          badge: 'bg-red-500',
          badgeText: 'INTENSE'
        };
      case 'established':
        return {
          bg: 'bg-gradient-to-r from-purple-500/20 to-pink-500/20',
          border: 'border-purple-500/50',
          badge: 'bg-purple-500',
          badgeText: 'ESTABLISHED'
        };
      default:
        return {
          bg: 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20',
          border: 'border-blue-500/50',
          badge: 'bg-blue-500',
          badgeText: 'EMERGING'
        };
    }
  };

  const getDisplayName = (uid) => {
    if (uid === userProfile?.uid) return 'You';
    const profile = memberProfiles[uid];
    return profile?.displayName || profile?.username || `User ${uid?.slice(0, 6)}`;
  };

  const getRivalName = (rivalry) => {
    const rivalId = rivalry.player1 === userProfile?.uid ? rivalry.player2 : rivalry.player1;
    return getDisplayName(rivalId);
  };

  const getUserWins = (rivalry) => {
    return rivalry.player1 === userProfile?.uid ? rivalry.p1Wins : rivalry.p2Wins;
  };

  const getRivalWins = (rivalry) => {
    return rivalry.player1 === userProfile?.uid ? rivalry.p2Wins : rivalry.p1Wins;
  };

  const displayRivalries = expanded ? rivalries : rivalries.slice(0, 2);

  return (
    <div className="bg-[#1a1a1a] border border-[#333]">
      <div className="px-4 py-3 border-b border-[#333] bg-gradient-to-r from-[#222] to-red-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-red-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
              Your Rivalries ({rivalries.length})
            </span>
          </div>
          {rivalries.length > 2 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-500 hover:text-white flex items-center gap-1"
            >
              {expanded ? 'Show less' : 'Show all'}
              <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2">
        <AnimatePresence>
          {displayRivalries.map((rivalry, idx) => {
            const styles = getIntensityStyles(rivalry.intensity);
            const userWins = getUserWins(rivalry);
            const rivalWins = getRivalWins(rivalry);

            return (
              <m.div
                key={`${rivalry.player1}_${rivalry.player2}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-3 border ${styles.bg} ${styles.border}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-bold text-white">
                      vs {getRivalName(rivalry)}
                    </span>
                  </div>
                  <span className={`px-1.5 py-0.5 text-[8px] font-bold text-white ${styles.badge}`}>
                    {styles.badgeText}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#222]/50 p-2">
                    <p className="text-xs text-gray-500">Your Wins</p>
                    <p className="text-lg font-bold text-green-500 font-data tabular-nums">{userWins}</p>
                  </div>
                  <div className="bg-[#222]/50 p-2">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-lg font-bold text-white font-data tabular-nums">{rivalry.totalMatches}</p>
                  </div>
                  <div className="bg-[#222]/50 p-2">
                    <p className="text-xs text-gray-500">Their Wins</p>
                    <p className="text-lg font-bold text-red-500 font-data tabular-nums">{rivalWins}</p>
                  </div>
                </div>

                {rivalry.closeMatches > 0 && (
                  <p className="text-[10px] text-gray-500 mt-2 text-center">
                    {rivalry.closeMatches} close game{rivalry.closeMatches !== 1 ? 's' : ''} between you
                  </p>
                )}
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Main Activity Tab Component
const ActivityTab = ({
  league,
  userProfile,
  standings,
  memberProfiles,
  leagueStats,
  rivalries,
  weeklyMatchups,
  weeklyResults,
  currentWeek,
  onMatchupClick,
  onChatOpen,
}) => {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 space-y-4"
    >
      {/* Weekly Recap - Shows latest week's highlights */}
      <WeeklyRecapCard
        leagueId={league?.id}
        currentWeek={currentWeek}
        memberProfiles={memberProfiles}
      />

      {/* League Stats Overview */}
      <LeagueStatsOverview
        standings={standings}
        memberProfiles={memberProfiles}
        leagueStats={leagueStats}
        currentWeek={currentWeek}
      />

      {/* Power Rankings */}
      <PowerRankingsCard
        standings={standings}
        memberProfiles={memberProfiles}
        userProfile={userProfile}
      />

      {/* Enhanced Rivalries - Fetched from auto-generated data */}
      <EnhancedRivalriesCard
        leagueId={league?.id}
        userProfile={userProfile}
        memberProfiles={memberProfiles}
      />

      {/* Achievements */}
      <AchievementsCard
        standings={standings}
        leagueStats={leagueStats}
        userProfile={userProfile}
      />

      {/* Activity Feed */}
      <div className="bg-[#1a1a1a] border border-[#333]">
        <div className="px-4 py-3 border-b border-[#333] bg-[#222]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Recent Activity
            </span>
          </div>
        </div>
        <div className="p-3">
          <LeagueActivityFeed
            leagueId={league?.id}
            userId={userProfile?.uid}
            league={league}
            showFilters={true}
            maxItems={10}
            compact={true}
            onActivityTap={(activity) => {
              if (activity.type === 'matchup_result' && activity.metadata?.week) {
                onMatchupClick?.(activity);
              } else if (activity.type === 'new_message') {
                onChatOpen?.();
              }
            }}
          />
        </div>
      </div>
    </m.div>
  );
};

export default ActivityTab;
