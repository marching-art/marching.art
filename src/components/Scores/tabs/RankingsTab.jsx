// RankingsTab - Overall, weekly, and monthly leaderboards
import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Star, Crown, Medal, Users, ChevronDown } from 'lucide-react';
import LoadingScreen from '../../LoadingScreen';

// Helper functions
const getRankIcon = (rank) => {
  switch (rank) {
    case 1:
      return (
        <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-yellow-500/20 text-amber-700 dark:text-yellow-400 px-2 py-1 rounded">
          <Crown className="w-4 h-4 md:w-5 md:h-5" />
        </span>
      );
    case 2:
      return (
        <span className="inline-flex items-center gap-1 bg-slate-200 dark:bg-gray-500/20 text-slate-600 dark:text-gray-400 px-2 py-1 rounded">
          <Trophy className="w-4 h-4 md:w-5 md:h-5" />
        </span>
      );
    case 3:
      return (
        <span className="inline-flex items-center gap-1 bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 px-2 py-1 rounded">
          <Medal className="w-4 h-4 md:w-5 md:h-5" />
        </span>
      );
    default:
      return <span className="text-slate-600 dark:text-cream-300 font-bold">#{rank}</span>;
  }
};

const getRankBgColor = (rank) => {
  switch (rank) {
    case 1:
      return 'bg-amber-50 dark:bg-gradient-to-r dark:from-yellow-400/20 dark:to-yellow-500/10 border-amber-300 dark:border-yellow-400/30';
    case 2:
      return 'bg-slate-100 dark:bg-gradient-to-r dark:from-gray-400/20 dark:to-gray-500/10 border-slate-300 dark:border-gray-400/30';
    case 3:
      return 'bg-orange-50 dark:bg-gradient-to-r dark:from-orange-400/20 dark:to-orange-500/10 border-orange-300 dark:border-orange-400/30';
    default:
      if (rank <= 10) return 'bg-stone-100 dark:bg-charcoal-800/30 border-stone-300 dark:border-cream-500/20';
      return 'bg-stone-50 dark:bg-charcoal-900/30 border-stone-200 dark:border-cream-500/10';
  }
};

const RankingsTab = ({
  loading,
  leaderboardData,
  rankingsTab,
  setRankingsTab,
  activeClass,
  setActiveClass,
  userRank,
  loggedInProfile,
  user,
  hasMore,
  loadingMore,
  loadMoreLeaderboard
}) => {
  const currentData = leaderboardData[rankingsTab];

  // Rankings sub-tabs
  const rankingsTabs = [
    { id: 'overall', label: 'Overall', icon: Trophy },
    { id: 'weekly', label: 'Weekly', icon: TrendingUp },
    { id: 'monthly', label: 'Monthly', icon: Star }
  ];

  // Class filters
  const classes = [
    { id: 'world', label: 'World Class' },
    { id: 'open', label: 'Open Class' },
    { id: 'a', label: 'A Class' }
  ];

  return (
    <div className="space-y-6">
      {/* User Rank Card */}
      {user && userRank && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gradient-to-r from-gold-500/20 to-gold-400/10 border border-gold-500/30 rounded-lg p-4 md:p-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gold-500/20 flex items-center justify-center">
                {getRankIcon(userRank)}
              </div>
              <div>
                <p className="text-cream-400 text-xs md:text-sm">Your Current Rank</p>
                <p className="text-xl md:text-2xl font-bold text-cream-100">#{userRank}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Rankings Sub-tabs */}
      <div className="border-b border-cream-500/20">
        <div className="flex justify-center gap-1 overflow-x-auto pb-px -mx-4 px-4 md:mx-0 md:px-0">
          {rankingsTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setRankingsTab(tab.id)}
                className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-2.5 md:py-3 font-medium transition-all whitespace-nowrap text-sm md:text-base ${
                  rankingsTab === tab.id
                    ? 'text-gold-500 border-b-2 border-gold-500'
                    : 'text-cream-500/60 hover:text-cream-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Class Filter */}
      <div className="flex justify-center">
        <div className="flex flex-wrap gap-2 justify-center">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setActiveClass(cls.id)}
              className={`px-3 md:px-4 py-2 rounded-lg transition-all text-sm ${
                activeClass === cls.id
                  ? 'bg-cream-100 text-charcoal-900 font-medium'
                  : 'bg-charcoal-800/50 text-cream-300 hover:bg-charcoal-800'
              }`}
            >
              {cls.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table/Cards */}
      <motion.div
        key={`${rankingsTab}-${activeClass}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-charcoal-800/30 rounded-lg overflow-hidden"
      >
        {loading ? (
          <LoadingScreen fullScreen={false} />
        ) : currentData.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-stone-100 dark:bg-charcoal-900/50 border-b border-stone-300 dark:border-cream-500/10">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-600 dark:text-cream-400">Rank</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-600 dark:text-cream-400">Player</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-600 dark:text-cream-400">Corps</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-600 dark:text-cream-400">Score</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-600 dark:text-cream-400">Trophies</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className={`border-b border-stone-200 dark:border-cream-500/10 hover:bg-stone-100 dark:hover:bg-charcoal-800/50 transition-colors ${
                        loggedInProfile?.username === entry.username
                          ? 'bg-amber-50 dark:bg-gold-500/5'
                          : idx % 2 === 0
                          ? 'bg-white dark:bg-transparent'
                          : 'bg-stone-50 dark:bg-charcoal-900/20'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {getRankIcon(entry.rank)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-charcoal-800 flex items-center justify-center">
                            <Users className="w-5 h-5 text-slate-500 dark:text-cream-400" />
                          </div>
                          <div>
                            <p className="text-slate-900 dark:text-cream-100 font-medium">{entry.username}</p>
                            <p className="text-slate-500 dark:text-cream-500/60 text-sm">{entry.userTitle || 'Rookie'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-slate-700 dark:text-cream-300">{entry.corpsName || 'No Corps'}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-slate-900 dark:text-cream-100 font-bold">{entry.score?.toFixed(2) || '0.00'}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Trophy className="w-4 h-4 text-amber-600 dark:text-gold-500" />
                          <span className="text-slate-900 dark:text-cream-100">{entry.trophies || 0}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 p-3">
              {currentData.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-lg p-3 border transition-all ${
                    getRankBgColor(entry.rank)
                  } ${loggedInProfile?.username === entry.username ? 'ring-2 ring-amber-500 dark:ring-gold-500' : ''}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-shrink-0">
                        {getRankIcon(entry.rank)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-slate-900 dark:text-cream-100 font-semibold text-sm truncate">{entry.username}</p>
                        <p className="text-slate-500 dark:text-cream-500/60 text-xs">{entry.userTitle || 'Rookie'}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-slate-900 dark:text-cream-100 font-bold">{entry.score?.toFixed(2) || '0.00'}</p>
                      <p className="text-slate-500 dark:text-cream-500/60 text-xs">Score</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-cream-400 min-w-0">
                      <Users className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{entry.corpsName || 'No Corps'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-700 dark:text-cream-300 flex-shrink-0">
                      <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-gold-500" />
                      <span className="font-semibold">{entry.trophies || 0}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12 md:py-20 px-4">
            <Trophy className="w-12 h-12 md:w-16 md:h-16 text-cream-500/30 mx-auto mb-4" />
            <p className="text-cream-300 text-base md:text-lg font-semibold">No scores recorded yet</p>
            <p className="text-cream-500/60 text-sm mt-2 max-w-md mx-auto">
              {rankingsTab === 'weekly'
                ? 'Weekly rankings will appear after shows are scored this week'
                : rankingsTab === 'monthly'
                ? 'Monthly rankings will appear after shows are scored this month'
                : 'Rankings will appear after the first shows are scored this season'}
            </p>
          </div>
        )}
      </motion.div>

      {/* Load More Button */}
      {!loading && hasMore[rankingsTab] && (
        <div className="flex justify-center">
          <button
            onClick={loadMoreLeaderboard}
            disabled={loadingMore}
            className="flex items-center gap-2 px-5 py-2.5 bg-charcoal-800/50 text-cream-300 rounded-lg hover:bg-charcoal-800 transition-colors text-sm disabled:opacity-50"
          >
            <ChevronDown className={`w-4 h-4 ${loadingMore ? 'animate-bounce' : ''}`} />
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
};

export default RankingsTab;
