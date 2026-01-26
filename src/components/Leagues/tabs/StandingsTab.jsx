// StandingsTab - Dashboard-first design with standings table
// Design System: Visual dashboard cards at top, data table below

import React, { useMemo, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  Trophy, Flame, TrendingUp, TrendingDown, Minus, Crown,
  ChevronDown, ChevronUp, BarChart3, LayoutDashboard, Table2
} from 'lucide-react';
import SeasonStatsCard from '../SeasonStatsCard';
import LeagueLeaderboards from '../LeagueLeaderboards';
import LeagueDashboard from '../LeagueDashboard';

const StandingsTab = ({
  standings,
  memberProfiles,
  userProfile,
  loading,
  league,
  playoffSize = 4,
  leagueStats = {},
  showLeaderboards = true,
  currentWeek = 1,
  weeklyMatchups = {},
  onMatchupClick,
  lastUpdated,
}) => {
  const [expandedUser, setExpandedUser] = useState(null);
  const [showLeaderboardSection, setShowLeaderboardSection] = useState(false);
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' | 'table'

  // Helper to get display name
  const getDisplayName = (uid) => {
    if (uid === userProfile?.uid) return 'You';
    const profile = memberProfiles[uid];
    return profile?.displayName || profile?.username || `Director ${uid?.slice(0, 6)}`;
  };

  // Get user's stats
  const userStats = useMemo(() => {
    return standings.find(s => s.uid === userProfile?.uid);
  }, [standings, userProfile?.uid]);

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
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4"
    >
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          {viewMode === 'dashboard' ? 'League Overview' : 'Full Standings'}
        </h2>
        <div className="flex items-center gap-1 p-1 bg-[#1a1a1a] border border-[#333]">
          <button
            onClick={() => setViewMode('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors ${
              viewMode === 'dashboard'
                ? 'bg-yellow-500 text-black'
                : 'text-gray-500 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors ${
              viewMode === 'table'
                ? 'bg-yellow-500 text-black'
                : 'text-gray-500 hover:text-white'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            Table
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'dashboard' ? (
          <m.div
            key="dashboard"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            {/* Dashboard View */}
            <LeagueDashboard
              userStats={userStats}
              standings={standings}
              memberProfiles={memberProfiles}
              userProfile={userProfile}
              currentWeek={currentWeek}
              weeklyMatchups={weeklyMatchups}
              leagueStats={leagueStats}
              onViewStandings={() => setViewMode('table')}
              onViewMatchup={onMatchupClick}
              onViewLeaderboards={() => setShowLeaderboardSection(true)}
            />

            {/* Quick Standings Preview */}
            <div className="mt-4 bg-[#1a1a1a] border border-[#333] overflow-hidden">
              <button
                onClick={() => setViewMode('table')}
                className="w-full px-4 py-3 border-b border-[#333] bg-[#222] flex items-center justify-between hover:bg-[#2a2a2a] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Standings Preview
                  </span>
                </div>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  View Full <ChevronDown className="w-3 h-3" />
                </span>
              </button>

              {/* Top 5 Quick View */}
              <div className="divide-y divide-[#222]">
                {enhancedStandings.length > 0 ? (
                  enhancedStandings.slice(0, 5).map((stats, idx) => {
                    const isUser = stats.uid === userProfile?.uid;
                    const rank = idx + 1;

                    return (
                      <div
                        key={stats.uid}
                        className={`flex items-center justify-between px-4 py-2 ${
                          isUser ? 'bg-purple-500/10' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <RankBadge rank={rank} isPlayoffSpot={rank <= playoffSize} />
                          <span className={`text-sm font-bold ${isUser ? 'text-purple-400' : 'text-white'}`}>
                            {getDisplayName(stats.uid)}
                          </span>
                          {stats.uid === league?.creatorId && (
                            <Crown className="w-3 h-3 text-yellow-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold font-data tabular-nums text-sm">
                            <span className="text-green-500">{stats.wins}</span>
                            <span className="text-gray-600">-</span>
                            <span className="text-red-500">{stats.losses}</span>
                          </span>
                          {stats.streak > 0 && (
                            <span className={`text-xs font-bold ${
                              stats.streakType === 'W' ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {stats.streakType}{stats.streak}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-gray-500">No standings yet</p>
                    <p className="text-xs text-gray-600 mt-1">Standings will appear after matchups are resolved</p>
                  </div>
                )}
              </div>

              {standings.length > 5 && (
                <button
                  onClick={() => setViewMode('table')}
                  className="w-full px-4 py-2 text-xs text-gray-500 hover:text-white transition-colors border-t border-[#333]"
                >
                  +{standings.length - 5} more...
                </button>
              )}
            </div>
          </m.div>
        ) : (
          <m.div
            key="table"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {/* Full Standings Table */}
            <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
              {/* Section Header */}
              <div className="px-4 py-3 border-b border-[#333] bg-[#222]">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                    Standings
                    {lastUpdated && (
                      <span className="text-[9px] text-gray-600 font-normal normal-case ml-2">
                        Updated {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}
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
                      const isExpanded = expandedUser === stats.uid;
                      const hasStats = leagueStats[stats.uid];

                      return (
                        <React.Fragment key={stats.uid}>
                          <tr
                            onClick={() => hasStats && setExpandedUser(isExpanded ? null : stats.uid)}
                            className={`border-b transition-colors ${hasStats ? 'cursor-pointer' : ''} ${
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
                                  {hasStats && (
                                    <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${
                                      isExpanded ? 'rotate-180' : ''
                                    }`} />
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

                          {/* Expanded Stats Row */}
                          <AnimatePresence>
                            {isExpanded && hasStats && (
                              <m.tr
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                              >
                                <td colSpan={6} className="p-0">
                                  <SeasonStatsCard
                                    stats={leagueStats[stats.uid]}
                                    displayName={getDisplayName(stats.uid)}
                                    isCurrentUser={isUser}
                                    compact={true}
                                  />
                                </td>
                              </m.tr>
                            )}
                          </AnimatePresence>

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
                <div className="p-8">
                  <div className="w-12 h-12 mx-auto mb-4 bg-blue-500/10 border border-blue-500/30 flex items-center justify-center rounded-sm">
                    <Trophy className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-center text-base font-bold text-white mb-2">
                    No Standings Yet
                  </h3>
                  <p className="text-center text-sm text-gray-400 mb-4 max-w-xs mx-auto">
                    Standings will appear after league members complete their first shows and matchups are resolved.
                  </p>
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#222] border border-[#333] rounded-sm text-xs text-gray-400">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <span>Register for a show to start earning points</span>
                    </div>
                    {currentWeek > 0 && (
                      <div className="text-xs text-gray-500">
                        Currently Week {currentWeek}
                      </div>
                    )}
                  </div>
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
                  {Object.keys(leagueStats).length > 0 && (
                    <span className="text-gray-400">Click rows to expand stats</span>
                  )}
                </div>
              </div>
            </div>

            {/* Leaderboards Section */}
            {showLeaderboards && Object.keys(leagueStats).length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowLeaderboardSection(!showLeaderboardSection)}
                  className="w-full bg-[#1a1a1a] border border-[#333] px-4 py-3 flex items-center justify-between hover:bg-[#222] transition-colors mb-3"
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-yellow-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Season Leaderboards
                    </span>
                  </div>
                  {showLeaderboardSection ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>

                <AnimatePresence>
                  {showLeaderboardSection && (
                    <m.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <LeagueLeaderboards
                        leagueStats={leagueStats}
                        currentUserId={userProfile?.uid}
                        getDisplayName={getDisplayName}
                      />
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
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
