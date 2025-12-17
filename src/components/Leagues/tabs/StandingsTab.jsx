// StandingsTab - Enhanced standings with podium display and trend arrows
import React from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Medal, Flame, TrendingUp, TrendingDown, Minus,
  Crown
} from 'lucide-react';

const StandingsTab = ({ standings, memberProfiles, userProfile, loading }) => {
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
  const topThree = standings.slice(0, 3);
  const restOfStandings = standings.slice(3);

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

            {/* 1st Place */}
            <PodiumSpot
              rank={1}
              stats={topThree[0]}
              displayName={getDisplayName(topThree[0]?.uid)}
              corpsName={getCorpsName(topThree[0]?.uid)}
              isUser={topThree[0]?.uid === userProfile?.uid}
              height="h-28"
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-cream-500/10 bg-charcoal-900/30">
                <th className="text-left py-3 px-4 text-xs font-display font-semibold text-cream-500/60">
                  Rank
                </th>
                <th className="text-left py-3 px-4 text-xs font-display font-semibold text-cream-500/60">
                  Director
                </th>
                <th className="text-center py-3 px-4 text-xs font-display font-semibold text-cream-500/60">
                  Record
                </th>
                <th className="text-center py-3 px-4 text-xs font-display font-semibold text-cream-500/60">
                  Streak
                </th>
                <th className="text-right py-3 px-4 text-xs font-display font-semibold text-cream-500/60">
                  Total Pts
                </th>
                <th className="text-center py-3 px-4 text-xs font-display font-semibold text-cream-500/60">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {standings.map((stats, idx) => {
                const isUser = stats.uid === userProfile?.uid;
                const rank = idx + 1;

                return (
                  <tr
                    key={stats.uid}
                    className={`border-b border-cream-500/5 transition-colors ${
                      isUser
                        ? 'bg-purple-500/10 hover:bg-purple-500/15'
                        : 'hover:bg-cream-500/5'
                    }`}
                  >
                    {/* Rank */}
                    <td className="py-3 px-4">
                      <RankBadge rank={rank} />
                    </td>

                    {/* Director */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isUser ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-charcoal-800'
                        }`}>
                          <span className={`text-sm font-bold ${
                            isUser ? 'text-purple-400' : 'text-cream-500/60'
                          }`}>
                            {getDisplayName(stats.uid).charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className={`font-display font-semibold text-sm ${
                            isUser ? 'text-purple-400' : 'text-cream-100'
                          }`}>
                            {getDisplayName(stats.uid)}
                          </p>
                          {getCorpsName(stats.uid) && (
                            <p className="text-xs text-cream-500/40">
                              {getCorpsName(stats.uid)}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Record */}
                    <td className="text-center py-3 px-4">
                      <span className="font-display font-bold">
                        <span className="text-green-400">{stats.wins}</span>
                        <span className="text-cream-500/40">-</span>
                        <span className="text-red-400">{stats.losses}</span>
                      </span>
                    </td>

                    {/* Streak */}
                    <td className="text-center py-3 px-4">
                      {stats.streak > 0 ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
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

                    {/* Total Points */}
                    <td className="text-right py-3 px-4">
                      <span className="font-display font-bold text-gold-500">
                        {stats.totalPoints.toFixed(1)}
                      </span>
                    </td>

                    {/* Trend */}
                    <td className="text-center py-3 px-4">
                      <TrendIndicator trend={stats.trend} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {standings.length === 0 && (
          <div className="p-8 text-center text-cream-500/40">
            No standings data yet. Play some shows to see rankings!
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Podium spot component
const PodiumSpot = ({ rank, stats, displayName, corpsName, isUser, height }) => {
  const colors = {
    1: { bg: 'bg-gradient-to-t from-yellow-500/30 to-yellow-500/10', border: 'border-yellow-500/50', text: 'text-yellow-400', medal: '🥇' },
    2: { bg: 'bg-gradient-to-t from-gray-400/30 to-gray-400/10', border: 'border-gray-400/50', text: 'text-gray-400', medal: '🥈' },
    3: { bg: 'bg-gradient-to-t from-orange-500/30 to-orange-500/10', border: 'border-orange-500/50', text: 'text-orange-400', medal: '🥉' }
  };

  const style = colors[rank];

  if (!stats) return null;

  return (
    <div className="flex flex-col items-center">
      {/* Avatar & Name */}
      <div className={`w-14 h-14 rounded-full ${style.bg} border-2 ${style.border} flex items-center justify-center mb-2 ${
        isUser ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-charcoal-900' : ''
      }`}>
        <span className="text-lg font-display font-bold text-cream-100">
          {displayName.charAt(0)}
        </span>
      </div>

      <p className={`font-display font-semibold text-sm text-center ${
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
const RankBadge = ({ rank }) => {
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
    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-cream-500/10 text-cream-500/60 font-display font-bold text-sm">
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
