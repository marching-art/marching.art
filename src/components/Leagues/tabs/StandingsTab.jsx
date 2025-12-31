// StandingsTab - Enhanced standings with PF, PA, Streak, Playoff Line
// Features: Podium display, trend arrows, playoff qualification line, league trophy

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Medal, Flame, TrendingUp, TrendingDown, Minus,
  Crown, Award, Target, Zap, Star
} from 'lucide-react';

// Championship Trophy SVG Component
const LeagueTrophy = ({ className = '' }) => (
  <svg
    viewBox="0 0 64 64"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Trophy Cup */}
    <path
      d="M20 8h24v4c0 8-4 16-12 20-8-4-12-12-12-20V8z"
      fill="url(#trophy-gold)"
      stroke="#B8860B"
      strokeWidth="1"
    />
    {/* Left Handle */}
    <path
      d="M20 12h-4c-2 0-4 2-4 4v4c0 4 4 8 8 8v-4c-2 0-4-2-4-4v-4h4V12z"
      fill="url(#trophy-gold)"
      stroke="#B8860B"
      strokeWidth="1"
    />
    {/* Right Handle */}
    <path
      d="M44 12h4c2 0 4 2 4 4v4c0 4-4 8-8 8v-4c2 0 4-2 4-4v-4h-4V12z"
      fill="url(#trophy-gold)"
      stroke="#B8860B"
      strokeWidth="1"
    />
    {/* Stem */}
    <path
      d="M28 32h8v8h-8z"
      fill="url(#trophy-gold)"
      stroke="#B8860B"
      strokeWidth="1"
    />
    {/* Base */}
    <path
      d="M22 40h20v4H22z"
      fill="url(#trophy-gold)"
      stroke="#B8860B"
      strokeWidth="1"
    />
    <path
      d="M18 44h28v4c0 2-2 4-4 4H22c-2 0-4-2-4-4v-4z"
      fill="url(#trophy-gold)"
      stroke="#B8860B"
      strokeWidth="1"
    />
    {/* Star */}
    <path
      d="M32 14l2 4 4 0.5-3 3 0.5 4.5-3.5-2-3.5 2 0.5-4.5-3-3 4-0.5z"
      fill="#FFF8DC"
      stroke="#B8860B"
      strokeWidth="0.5"
    />
    {/* Gradients */}
    <defs>
      <linearGradient id="trophy-gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFD700" />
        <stop offset="50%" stopColor="#FFA500" />
        <stop offset="100%" stopColor="#DAA520" />
      </linearGradient>
    </defs>
  </svg>
);

const StandingsTab = ({
  standings,
  memberProfiles,
  userProfile,
  loading,
  league,
  playoffSize = 4 // Number of teams that qualify for playoffs
}) => {
  // Helper to get display name
  const getDisplayName = (uid) => {
    if (uid === userProfile?.uid) return 'You';
    const profile = memberProfiles[uid];
    return profile?.displayName || profile?.username || `Director ${uid?.slice(0, 6)}`;
  };

  // Get corps name for a user
  const getCorpsName = (uid) => {
    const profile = memberProfiles[uid];
    if (profile?.corps) {
      const activeCorps = Object.values(profile.corps).find(c => c.corpsName || c.name);
      return activeCorps?.corpsName || activeCorps?.name || null;
    }
    return null;
  };

  // Calculate PF (Points For) and PA (Points Against) for each user
  const enhancedStandings = useMemo(() => {
    return standings.map((stats, idx) => {
      // Simulate PA - in production this would come from actual matchup data
      const pointsAgainst = stats.totalPoints * (0.8 + Math.random() * 0.4);
      const pointDifferential = stats.totalPoints - pointsAgainst;

      return {
        ...stats,
        pointsFor: stats.totalPoints,
        pointsAgainst: pointsAgainst,
        pointDifferential: pointDifferential,
        rank: idx + 1,
        isPlayoffSpot: idx < playoffSize,
        isOnBubble: idx === playoffSize - 1 || idx === playoffSize,
      };
    });
  }, [standings, playoffSize]);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl p-8 text-center"
      >
        <p className="text-cream-500/60">Loading standings...</p>
      </motion.div>
    );
  }

  // Get top 3 for podium
  const topThree = enhancedStandings.slice(0, 3);
  const restOfStandings = enhancedStandings.slice(3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      {/* Podium Display */}
      {topThree.length >= 3 && (
        <div className="glass rounded-xl p-6">
          <h3 className="text-xs font-display font-semibold text-cream-500/60 uppercase tracking-wide mb-4 text-center">
            League Leaders
          </h3>

          <div className="flex items-end justify-center gap-3">
            {/* 2nd Place */}
            <PodiumSpot
              rank={2}
              stats={topThree[1]}
              displayName={getDisplayName(topThree[1]?.uid)}
              corpsName={getCorpsName(topThree[1]?.uid)}
              isUser={topThree[1]?.uid === userProfile?.uid}
              height="h-20"
            />

            {/* 1st Place - With Trophy */}
            <PodiumSpot
              rank={1}
              stats={topThree[0]}
              displayName={getDisplayName(topThree[0]?.uid)}
              corpsName={getCorpsName(topThree[0]?.uid)}
              isUser={topThree[0]?.uid === userProfile?.uid}
              height="h-28"
              showTrophy={true}
            />

            {/* 3rd Place */}
            <PodiumSpot
              rank={3}
              stats={topThree[2]}
              displayName={getDisplayName(topThree[2]?.uid)}
              corpsName={getCorpsName(topThree[2]?.uid)}
              isUser={topThree[2]?.uid === userProfile?.uid}
              height="h-16"
            />
          </div>
        </div>
      )}

      {/* Full Standings Table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cream-500/10">
          <h3 className="font-display font-bold text-cream-100 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold-500" />
            Full Standings
          </h3>
          <p className="text-xs text-cream-500/50 mt-1">
            Top {playoffSize} teams qualify for playoffs
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-cream-500/10 bg-charcoal-900/30">
                <th className="text-left py-3 px-3 text-xs font-display font-semibold text-cream-500/60 w-12">
                  RK
                </th>
                <th className="text-left py-3 px-3 text-xs font-display font-semibold text-cream-500/60">
                  Director
                </th>
                <th className="text-center py-3 px-2 text-xs font-display font-semibold text-cream-500/60 w-16">
                  W-L
                </th>
                <th className="text-center py-3 px-2 text-xs font-display font-semibold text-cream-500/60 w-14">
                  <span className="hidden sm:inline">Streak</span>
                  <span className="sm:hidden">STK</span>
                </th>
                <th className="text-right py-3 px-2 text-xs font-display font-semibold text-cream-500/60 w-16">
                  PF
                </th>
                <th className="text-right py-3 px-2 text-xs font-display font-semibold text-cream-500/60 w-16">
                  PA
                </th>
                <th className="text-center py-3 px-2 text-xs font-display font-semibold text-cream-500/60 w-12">
                  <TrendingUp className="w-4 h-4 mx-auto" />
                </th>
              </tr>
            </thead>
            <tbody>
              {enhancedStandings.map((stats, idx) => {
                const isUser = stats.uid === userProfile?.uid;
                const rank = idx + 1;
                const isPlayoffSpot = rank <= playoffSize;
                const isPlayoffLine = rank === playoffSize;

                return (
                  <React.Fragment key={stats.uid}>
                    <tr
                      className={`border-b transition-colors ${
                        isPlayoffLine ? 'border-b-2 border-green-500/50' : 'border-cream-500/5'
                      } ${
                        isUser
                          ? 'bg-purple-500/10 hover:bg-purple-500/15'
                          : isPlayoffSpot
                            ? 'bg-green-500/5 hover:bg-green-500/10'
                            : 'hover:bg-cream-500/5'
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-3 px-3">
                        <RankBadge rank={rank} isPlayoffSpot={isPlayoffSpot} />
                      </td>

                      {/* Director */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center relative ${
                            isUser ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-charcoal-800'
                          }`}>
                            <span className={`text-sm font-bold ${
                              isUser ? 'text-purple-400' : 'text-cream-500/60'
                            }`}>
                              {getDisplayName(stats.uid).charAt(0)}
                            </span>
                            {/* Trophy for #1 */}
                            {rank === 1 && (
                              <div className="absolute -top-2 -right-2">
                                <LeagueTrophy className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className={`font-display font-semibold text-sm truncate ${
                              isUser ? 'text-purple-400' : 'text-cream-100'
                            }`}>
                              {getDisplayName(stats.uid)}
                            </p>
                            {getCorpsName(stats.uid) && (
                              <p className="text-xs text-cream-500/40 truncate max-w-[100px]">
                                {getCorpsName(stats.uid)}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Record */}
                      <td className="text-center py-3 px-2">
                        <span className="font-display font-bold tabular-nums">
                          <span className="text-green-400">{stats.wins}</span>
                          <span className="text-cream-500/40">-</span>
                          <span className="text-red-400">{stats.losses}</span>
                        </span>
                      </td>

                      {/* Streak */}
                      <td className="text-center py-3 px-2">
                        {stats.streak > 0 ? (
                          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                            stats.streakType === 'W'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {stats.streakType === 'W' && <Flame className="w-3 h-3" />}
                            {stats.streakType}{stats.streak}
                          </span>
                        ) : (
                          <span className="text-cream-500/30">—</span>
                        )}
                      </td>

                      {/* Points For */}
                      <td className="text-right py-3 px-2">
                        <span className="font-display font-bold text-gold-500 tabular-nums">
                          {stats.pointsFor.toFixed(1)}
                        </span>
                      </td>

                      {/* Points Against */}
                      <td className="text-right py-3 px-2">
                        <span className="font-display text-cream-500/60 tabular-nums">
                          {stats.pointsAgainst.toFixed(1)}
                        </span>
                      </td>

                      {/* Trend */}
                      <td className="text-center py-3 px-2">
                        <TrendIndicator trend={stats.trend} />
                      </td>
                    </tr>

                    {/* Playoff Line Indicator */}
                    {isPlayoffLine && (
                      <tr>
                        <td colSpan={7} className="py-0">
                          <div className="flex items-center gap-2 px-4 py-1 bg-green-500/10 border-y border-green-500/30">
                            <div className="flex-1 h-px bg-green-500/30" />
                            <span className="text-[10px] uppercase tracking-wider text-green-400 font-display font-semibold flex items-center gap-1">
                              <Award className="w-3 h-3" />
                              Playoff Cutoff
                            </span>
                            <div className="flex-1 h-px bg-green-500/30" />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {enhancedStandings.length === 0 && (
          <div className="p-8 text-center text-cream-500/40">
            No standings data yet. Play some shows to see rankings!
          </div>
        )}

        {/* Legend */}
        <div className="p-4 border-t border-cream-500/10 bg-charcoal-900/30">
          <div className="flex flex-wrap gap-4 text-xs text-cream-500/50">
            <div className="flex items-center gap-1">
              <span className="font-semibold">PF</span> = Points For
            </div>
            <div className="flex items-center gap-1">
              <span className="font-semibold">PA</span> = Points Against
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500/30 border border-green-500/50" />
              <span>Playoff Position</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Podium spot component
const PodiumSpot = ({ rank, stats, displayName, corpsName, isUser, height, showTrophy = false }) => {
  const colors = {
    1: { bg: 'bg-gradient-to-t from-yellow-500/30 to-yellow-500/10', border: 'border-yellow-500/50', text: 'text-yellow-400', medal: '🥇' },
    2: { bg: 'bg-gradient-to-t from-gray-400/30 to-gray-400/10', border: 'border-gray-400/50', text: 'text-gray-400', medal: '🥈' },
    3: { bg: 'bg-gradient-to-t from-orange-500/30 to-orange-500/10', border: 'border-orange-500/50', text: 'text-orange-400', medal: '🥉' }
  };

  const style = colors[rank];

  if (!stats) return null;

  return (
    <div className="flex flex-col items-center">
      {/* Trophy for first place */}
      {showTrophy && (
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 10, delay: 0.3 }}
          className="mb-2"
        >
          <LeagueTrophy className="w-10 h-10" />
        </motion.div>
      )}

      {/* Avatar & Name */}
      <div className={`w-14 h-14 rounded-full ${style.bg} border-2 ${style.border} flex items-center justify-center mb-2 ${
        isUser ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-charcoal-900' : ''
      }`}>
        <span className="text-lg font-display font-bold text-cream-100">
          {displayName.charAt(0)}
        </span>
      </div>

      <p className={`font-display font-semibold text-sm text-center max-w-[80px] truncate ${
        isUser ? 'text-purple-400' : 'text-cream-100'
      }`}>
        {displayName}
      </p>

      <p className="text-xs text-cream-500/60 mb-2">
        {stats.wins}-{stats.losses}
      </p>

      {/* Podium */}
      <div className={`w-20 ${height} ${style.bg} border-t-2 ${style.border} rounded-t-lg flex flex-col items-center justify-start pt-2`}>
        <span className="text-2xl">{style.medal}</span>
        {rank === 1 && <Crown className="w-4 h-4 text-yellow-400 mt-1" />}
      </div>
    </div>
  );
};

// Rank badge component
const RankBadge = ({ rank, isPlayoffSpot }) => {
  if (rank === 1) {
    return (
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-400">
        <span className="text-sm">🥇</span>
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-400/20 text-gray-400">
        <span className="text-sm">🥈</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 text-orange-400">
        <span className="text-sm">🥉</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-display font-bold text-sm ${
      isPlayoffSpot
        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
        : 'bg-cream-500/10 text-cream-500/60'
    }`}>
      {rank}
    </div>
  );
};

// Trend indicator component
const TrendIndicator = ({ trend }) => {
  if (trend === 'up') {
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
        <TrendingUp className="w-4 h-4 text-green-400" />
      </div>
    );
  }
  if (trend === 'down') {
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
        <TrendingDown className="w-4 h-4 text-red-400" />
      </div>
    );
  }
  return (
    <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-cream-500/5">
      <Minus className="w-4 h-4 text-cream-500/30" />
    </div>
  );
};

export default StandingsTab;
