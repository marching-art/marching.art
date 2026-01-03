// StandingsTab - High-Density Data Table
// Design System: Compact table rows, tabular numbers, trend indicators

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Flame, TrendingUp, TrendingDown, Minus, Crown } from 'lucide-react';

const StandingsTab = ({
  standings,
  memberProfiles,
  userProfile,
  loading,
  league,
  playoffSize = 4
}) => {
  // Helper to get display name
  const getDisplayName = (uid) => {
    if (uid === userProfile?.uid) return 'You';
    const profile = memberProfiles[uid];
    return profile?.displayName || profile?.username || `Director ${uid?.slice(0, 6)}`;
  };

  // Enhance standings with calculated fields
  const enhancedStandings = useMemo(() => {
    return standings.map((stats, idx) => ({
      ...stats,
      rank: idx + 1,
      isPlayoffSpot: idx < playoffSize,
    }));
  }, [standings, playoffSize]);

  if (loading) {
    return (
      <div className="p-4">
        <div className="bg-[#1a1a1a] border border-[#333] p-8 text-center">
          <p className="text-gray-500 text-sm">Loading standings...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4"
    >
      <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
        {/* Section Header */}
        <div className="px-4 py-3 border-b border-[#333] bg-[#222]">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5 text-yellow-500" />
              Standings
            </h3>
            <span className="text-[10px] text-gray-500">
              Top {playoffSize} qualify
            </span>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#333] bg-[#111]">
                <th className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-10">
                  RK
                </th>
                <th className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Director
                </th>
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-16">
                  W-L
                </th>
                <th className="text-right py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-16">
                  PF
                </th>
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-14">
                  STRK
                </th>
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-10">
                  <TrendingUp className="w-3 h-3 mx-auto" />
                </th>
              </tr>
            </thead>
            <tbody>
              {enhancedStandings.map((stats, idx) => {
                const isUser = stats.uid === userProfile?.uid;
                const rank = idx + 1;
                const isPlayoffSpot = rank <= playoffSize;
                const isPlayoffLine = rank === playoffSize;
                const isCommissioner = stats.uid === league?.creatorId;

                return (
                  <React.Fragment key={stats.uid}>
                    <tr
                      className={`border-b transition-colors ${
                        isPlayoffLine ? 'border-b-2 border-green-500/50' : 'border-[#222]'
                      } ${
                        isUser
                          ? 'bg-purple-500/10'
                          : isPlayoffSpot
                            ? 'bg-green-500/5'
                            : 'hover:bg-[#222]'
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-2 px-3">
                        <RankBadge rank={rank} isPlayoffSpot={isPlayoffSpot} />
                      </td>

                      {/* Director */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 flex-shrink-0 flex items-center justify-center ${
                            isUser ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-[#333]'
                          }`}>
                            <span className={`text-xs font-bold ${
                              isUser ? 'text-purple-400' : 'text-gray-400'
                            }`}>
                              {getDisplayName(stats.uid).charAt(0)}
                            </span>
                          </div>
                          <div className="min-w-0 flex items-center gap-1.5">
                            <p className={`font-bold text-sm truncate ${
                              isUser ? 'text-purple-400' : 'text-white'
                            }`}>
                              {getDisplayName(stats.uid)}
                            </p>
                            {isCommissioner && (
                              <Crown className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Record W-L */}
                      <td className="text-center py-2 px-2">
                        <span className="font-bold font-data tabular-nums text-sm">
                          <span className="text-green-500">{stats.wins}</span>
                          <span className="text-gray-600">-</span>
                          <span className="text-red-500">{stats.losses}</span>
                        </span>
                      </td>

                      {/* Points For */}
                      <td className="text-right py-2 px-2">
                        <span className="font-bold text-yellow-500 font-data tabular-nums text-sm">
                          {stats.totalPoints.toFixed(1)}
                        </span>
                      </td>

                      {/* Streak */}
                      <td className="text-center py-2 px-2">
                        {stats.streak > 0 ? (
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-bold ${
                            stats.streakType === 'W'
                              ? 'bg-green-500/20 text-green-500'
                              : 'bg-red-500/20 text-red-500'
                          }`}>
                            {stats.streakType === 'W' && <Flame className="w-2.5 h-2.5" />}
                            {stats.streakType}{stats.streak}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Trend */}
                      <td className="text-center py-2 px-2">
                        <TrendIndicator trend={stats.trend} />
                      </td>
                    </tr>

                    {/* Playoff Line Indicator */}
                    {isPlayoffLine && idx < enhancedStandings.length - 1 && (
                      <tr>
                        <td colSpan={6} className="py-0">
                          <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border-y border-green-500/30">
                            <div className="flex-1 h-px bg-green-500/30" />
                            <span className="text-[9px] uppercase tracking-wider text-green-500 font-bold">
                              Playoff Line
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
          <div className="p-8 text-center text-gray-500 text-sm">
            No standings data yet. Play some shows to see rankings!
          </div>
        )}

        {/* Legend */}
        <div className="px-4 py-2.5 border-t border-[#333] bg-[#111]">
          <div className="flex flex-wrap items-center gap-4 text-[10px] text-gray-500">
            <span><strong>PF</strong> = Points For</span>
            <span><strong>STRK</strong> = Streak</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-green-500/30 border border-green-500/50" />
              <span>Playoff</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Rank badge - compact design
const RankBadge = React.memo(({ rank, isPlayoffSpot }) => {
  if (rank === 1) {
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 bg-yellow-500/20 text-yellow-500 text-xs font-bold">
        1
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 bg-gray-500/20 text-gray-400 text-xs font-bold">
        2
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 bg-orange-500/20 text-orange-500 text-xs font-bold">
        3
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold ${
      isPlayoffSpot
        ? 'bg-green-500/10 text-green-500 border border-green-500/30'
        : 'bg-[#222] text-gray-500'
    }`}>
      {rank}
    </div>
  );
});

// Trend indicator - compact
const TrendIndicator = React.memo(({ trend }) => {
  if (trend === 'up') {
    return <TrendingUp className="w-3.5 h-3.5 text-green-500 mx-auto" />;
  }
  if (trend === 'down') {
    return <TrendingDown className="w-3.5 h-3.5 text-red-500 mx-auto" />;
  }
  return <Minus className="w-3.5 h-3.5 text-gray-600 mx-auto" />;
});

export default StandingsTab;
