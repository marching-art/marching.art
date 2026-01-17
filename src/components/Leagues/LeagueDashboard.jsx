// LeagueDashboard - Visual stat cards and league overview
// Design System: Card-based dashboard with engaging visualizations

import React, { useMemo } from 'react';
import { m } from 'framer-motion';
import {
  Trophy, Crown, Flame, TrendingUp, TrendingDown, Minus,
  Swords, Target, Zap, Calendar, Users, Award, Star,
  ChevronRight, BarChart3, Medal, Radio
} from 'lucide-react';

// Stat Card - Main building block
const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'yellow',
  size = 'md',
  trend,
  onClick,
  children
}) => {
  const colorClasses = {
    yellow: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
    purple: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    green: 'text-green-500 bg-green-500/10 border-green-500/30',
    red: 'text-red-500 bg-red-500/10 border-red-500/30',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    orange: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
  };

  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
  };

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`bg-[#1a1a1a] border border-[#333] ${sizeClasses[size]} ${
        onClick ? 'hover:border-[#444] cursor-pointer transition-colors' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`p-2 border ${colorClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-xs font-bold ${
            trend === 'up' ? 'text-green-500' :
            trend === 'down' ? 'text-red-500' : 'text-gray-500'
          }`}>
            {trend === 'up' && <TrendingUp className="w-3 h-3" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3" />}
            {trend === 'same' && <Minus className="w-3 h-3" />}
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">{title}</p>
        <p className="text-xl font-bold text-white font-data tabular-nums">{value}</p>
        {subtitle && (
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </Component>
  );
};

// Your Position Card - Prominent display of user's current standing
const YourPositionCard = ({ userStats, totalMembers, onViewStandings }) => {
  if (!userStats) return null;

  const rank = userStats.currentRank || userStats.rank || 1;
  const ordinalSuffix = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const winPct = userStats.wins + userStats.losses > 0
    ? ((userStats.wins / (userStats.wins + userStats.losses)) * 100).toFixed(0)
    : 0;

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-[#1a1a1a] border border-purple-500/30 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-500/20 border border-purple-500/30">
            <Crown className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-[10px] uppercase tracking-wider text-purple-400 font-bold">Your Position</span>
        </div>
        <button
          onClick={onViewStandings}
          className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
        >
          View All <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white font-data tabular-nums">
              {ordinalSuffix(rank)}
            </span>
            <span className="text-sm text-gray-500">of {totalMembers}</span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-green-500 font-data tabular-nums">{userStats.wins}</span>
              <span className="text-gray-600">-</span>
              <span className="text-lg font-bold text-red-500 font-data tabular-nums">{userStats.losses}</span>
            </div>
            <span className="text-sm text-gray-500">({winPct}%)</span>
          </div>
        </div>

        {/* Visual rank indicator */}
        <div className="flex flex-col items-center">
          {userStats.streak > 0 && (
            <div className={`flex items-center gap-1 px-2 py-1 text-sm font-bold ${
              userStats.streakType === 'W'
                ? 'bg-green-500/20 text-green-500'
                : 'bg-red-500/20 text-red-500'
            }`}>
              {userStats.streakType === 'W' && <Flame className="w-4 h-4" />}
              {userStats.streakType}{userStats.streak}
            </div>
          )}
          {rank <= 4 && (
            <div className="mt-1 px-2 py-0.5 bg-green-500/20 text-green-500 text-[10px] font-bold uppercase">
              Playoff Spot
            </div>
          )}
        </div>
      </div>
    </m.div>
  );
};

// Next Matchup Preview Card
const NextMatchupCard = ({ matchup, opponent, opponentStats, currentWeek, isLive, onClick }) => {
  if (!matchup) return null;

  return (
    <m.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="w-full bg-[#1a1a1a] border border-[#333] p-4 hover:border-[#444] transition-colors text-left"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-red-500/20 border border-red-500/30">
            <Swords className="w-4 h-4 text-red-400" />
          </div>
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
            {isLive ? 'Live Matchup' : 'Next Matchup'}
          </span>
        </div>
        {isLive && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-500 text-[10px] font-bold uppercase">
            <Radio className="w-2.5 h-2.5 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#333] flex items-center justify-center">
            <span className="text-sm font-bold text-gray-400">
              {opponent?.charAt(0) || '?'}
            </span>
          </div>
          <div>
            <p className="font-bold text-white text-sm">vs {opponent || 'TBD'}</p>
            {opponentStats && (
              <p className="text-xs text-gray-500">
                {opponentStats.wins}-{opponentStats.losses} record
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-500 uppercase">Week {currentWeek}</p>
          <ChevronRight className="w-4 h-4 text-gray-500 ml-auto" />
        </div>
      </div>
    </m.button>
  );
};

// Quick Stats Row
const QuickStatsRow = ({ stats, leagueStats, userId }) => {
  const userLeagueStats = leagueStats?.[userId];

  return (
    <div className="grid grid-cols-4 gap-2">
      <div className="bg-[#1a1a1a] border border-[#333] p-3 text-center">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Points</p>
        <p className="text-lg font-bold text-yellow-500 font-data tabular-nums">
          {stats?.totalPoints?.toFixed(0) || 0}
        </p>
      </div>
      <div className="bg-[#1a1a1a] border border-[#333] p-3 text-center">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Battle Pts</p>
        <p className="text-lg font-bold text-purple-500 font-data tabular-nums">
          {userLeagueStats?.totalBattlePointsFor || 0}
        </p>
      </div>
      <div className="bg-[#1a1a1a] border border-[#333] p-3 text-center">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Clutch</p>
        <p className="text-lg font-bold text-orange-500 font-data tabular-nums">
          {userLeagueStats?.clutchWins || 0}
        </p>
      </div>
      <div className="bg-[#1a1a1a] border border-[#333] p-3 text-center">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Best Wk</p>
        <p className="text-lg font-bold text-green-500 font-data tabular-nums">
          {userLeagueStats?.bestWeek?.battlePoints || 0}
        </p>
      </div>
    </div>
  );
};

// League Leaders Mini Display
const LeagueLeadersMini = ({ standings, memberProfiles, userId, leagueStats, onViewLeaderboards }) => {
  const topThree = standings.slice(0, 3);

  return (
    <div className="bg-[#1a1a1a] border border-[#333]">
      <div className="px-4 py-3 border-b border-[#333] bg-[#222] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">League Leaders</span>
        </div>
        <button
          onClick={onViewLeaderboards}
          className="text-xs text-gray-500 hover:text-white flex items-center gap-1"
        >
          All Stats <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-3 gap-2">
          {topThree.map((player, idx) => {
            const profile = memberProfiles[player.uid];
            const isUser = player.uid === userId;
            const displayName = isUser ? 'You' : profile?.displayName || `User ${player.uid?.slice(0, 6)}`;
            const medals = ['text-yellow-500', 'text-gray-400', 'text-orange-500'];

            return (
              <div
                key={player.uid}
                className={`p-2 text-center ${
                  isUser ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-[#222]'
                }`}
              >
                <div className="flex items-center justify-center mb-1">
                  <Medal className={`w-5 h-5 ${medals[idx]}`} />
                </div>
                <p className={`text-xs font-bold truncate ${isUser ? 'text-purple-400' : 'text-white'}`}>
                  {displayName}
                </p>
                <p className="text-[10px] text-gray-500">
                  {player.wins}-{player.losses}
                </p>
              </div>
            );
          })}
        </div>

        {/* Quick stat leaders */}
        {leagueStats && Object.keys(leagueStats).length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#333] grid grid-cols-2 gap-2">
            {/* Most Battle Points */}
            {(() => {
              const sorted = Object.values(leagueStats).sort((a, b) =>
                (b.totalBattlePointsFor || 0) - (a.totalBattlePointsFor || 0)
              );
              const leader = sorted[0];
              if (!leader) return null;
              const profile = memberProfiles[leader.userId];
              const isUser = leader.userId === userId;
              return (
                <div className="flex items-center gap-2 p-2 bg-[#222]">
                  <Target className="w-4 h-4 text-purple-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase text-gray-500">Most BP</p>
                    <p className={`text-xs font-bold truncate ${isUser ? 'text-purple-400' : 'text-white'}`}>
                      {isUser ? 'You' : profile?.displayName || 'Unknown'}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Best Win Rate */}
            {(() => {
              const sorted = Object.values(leagueStats).sort((a, b) =>
                (b.winPercentage || 0) - (a.winPercentage || 0)
              );
              const leader = sorted[0];
              if (!leader) return null;
              const profile = memberProfiles[leader.userId];
              const isUser = leader.userId === userId;
              return (
                <div className="flex items-center gap-2 p-2 bg-[#222]">
                  <Award className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase text-gray-500">Best Win%</p>
                    <p className={`text-xs font-bold truncate ${isUser ? 'text-purple-400' : 'text-white'}`}>
                      {isUser ? 'You' : profile?.displayName || 'Unknown'}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

// Season Progress Bar
const SeasonProgressBar = ({ currentWeek, totalWeeks = 12 }) => {
  const progress = (currentWeek / totalWeeks) * 100;

  return (
    <div className="bg-[#1a1a1a] border border-[#333] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" />
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Season Progress</span>
        </div>
        <span className="text-xs text-gray-500">Week {currentWeek} of {totalWeeks}</span>
      </div>
      <div className="h-2 bg-[#222] overflow-hidden">
        <m.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-gray-600">Start</span>
        <span className="text-[9px] text-gray-600">Playoffs</span>
        <span className="text-[9px] text-gray-600">Finals</span>
      </div>
    </div>
  );
};

// Main Dashboard Component
const LeagueDashboard = ({
  userStats,
  standings,
  memberProfiles,
  userProfile,
  currentWeek,
  weeklyMatchups,
  leagueStats,
  onViewStandings,
  onViewMatchup,
  onViewLeaderboards,
}) => {
  // Find user's current week matchup
  const currentMatchup = useMemo(() => {
    const weekMatchups = weeklyMatchups?.[currentWeek] || [];
    return weekMatchups.find(m =>
      m.user1 === userProfile?.uid || m.user2 === userProfile?.uid
    );
  }, [weeklyMatchups, currentWeek, userProfile?.uid]);

  // Get opponent info
  const opponentInfo = useMemo(() => {
    if (!currentMatchup) return null;
    const opponentId = currentMatchup.user1 === userProfile?.uid
      ? currentMatchup.user2
      : currentMatchup.user1;
    const profile = memberProfiles[opponentId];
    const stats = standings.find(s => s.uid === opponentId);
    return {
      id: opponentId,
      name: profile?.displayName || profile?.username || `User ${opponentId?.slice(0, 6)}`,
      stats,
    };
  }, [currentMatchup, userProfile?.uid, memberProfiles, standings]);

  // Determine if matchup is live (current week and not completed)
  const isMatchupLive = useMemo(() => {
    if (!currentMatchup) return false;
    // Matchup is live if it's for the current week and not marked as completed
    return !currentMatchup.completed;
  }, [currentMatchup]);

  return (
    <div className="space-y-4">
      {/* Your Position - Hero Card */}
      <YourPositionCard
        userStats={userStats}
        totalMembers={standings.length}
        onViewStandings={onViewStandings}
      />

      {/* Season Progress */}
      <SeasonProgressBar currentWeek={currentWeek} />

      {/* Quick Stats */}
      <QuickStatsRow
        stats={userStats}
        leagueStats={leagueStats}
        userId={userProfile?.uid}
      />

      {/* Next Matchup */}
      <NextMatchupCard
        matchup={currentMatchup}
        opponent={opponentInfo?.name}
        opponentStats={opponentInfo?.stats}
        currentWeek={currentWeek}
        isLive={isMatchupLive}
        onClick={() => onViewMatchup?.(currentMatchup)}
      />

      {/* League Leaders Mini */}
      <LeagueLeadersMini
        standings={standings}
        memberProfiles={memberProfiles}
        userId={userProfile?.uid}
        leagueStats={leagueStats}
        onViewLeaderboards={onViewLeaderboards}
      />
    </div>
  );
};

export default LeagueDashboard;
export { StatCard, YourPositionCard, QuickStatsRow, SeasonProgressBar, LeagueLeadersMini };
