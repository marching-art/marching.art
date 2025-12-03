// RankingsTab - Overall, weekly, and monthly leaderboards
import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Star, Crown, Medal, Users, ChevronDown } from 'lucide-react';
import LoadingScreen from '../../LoadingScreen';
import EmptyState from '../../EmptyState';

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

  // Class filters - Brutalist toggle style
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
          className="bg-gradient-to-r from-amber-500/20 dark:from-gold-500/20 to-amber-400/10 dark:to-gold-400/10 border border-amber-500/30 dark:border-gold-500/30 rounded-xl shadow-sm p-4 md:p-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-amber-500/20 dark:bg-gold-500/20 flex items-center justify-center">
                {getRankIcon(userRank)}
              </div>
              <div>
                <p className="text-slate-500 dark:text-cream-400 text-xs md:text-sm">Your Current Rank</p>
                <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-cream-100">#{userRank}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Rankings Sub-tabs - Mechanical Segmented Control */}
      <div className="flex justify-center -mx-4 px-4 md:mx-0 md:px-0">
        <div className="inline-flex border-2 border-charcoal-900 dark:border-cream-100 rounded-sm overflow-hidden">
          {rankingsTabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = rankingsTab === tab.id;
            const isLast = index === rankingsTabs.length - 1;
            return (
              <button
                key={tab.id}
                onClick={() => setRankingsTab(tab.id)}
                className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-2.5 font-bold uppercase tracking-wide transition-all whitespace-nowrap text-xs md:text-sm ${
                  isActive
                    ? 'bg-charcoal-900 dark:bg-cream-100 text-gold-400 dark:text-charcoal-900'
                    : 'bg-white dark:bg-charcoal-900 text-charcoal-900 dark:text-cream-100 hover:bg-cream-100 dark:hover:bg-charcoal-800'
                } ${!isLast ? 'border-r-2 border-charcoal-900 dark:border-cream-100' : ''}`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Class Filter - Brutalist Toggle Buttons */}
      <div className="flex justify-center">
        <div className="flex flex-wrap gap-3 justify-center">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setActiveClass(cls.id)}
              className={`px-4 md:px-5 py-2 md:py-2.5 border-2 border-black dark:border-cream-100 rounded-sm transition-all text-xs md:text-sm font-bold uppercase tracking-wide ${
                activeClass === cls.id
                  ? 'bg-black dark:bg-cream-100 text-gold-400 dark:text-charcoal-900'
                  : 'bg-white dark:bg-charcoal-900 text-charcoal-900 dark:text-cream-100 hover:bg-cream-100 dark:hover:bg-charcoal-800'
              }`}
            >
              {cls.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table/Cards - Wrapped in Card Container */}
      <motion.div
        key={`${rankingsTab}-${activeClass}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-charcoal-900/50 border border-cream-300 dark:border-cream-500/20 shadow-sm rounded-xl overflow-hidden"
      >
        {loading ? (
          <LoadingScreen fullScreen={false} />
        ) : currentData.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-cream-100 dark:bg-charcoal-900/50 border-b border-cream-200 dark:border-cream-500/10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-charcoal-700 dark:text-cream-400">Rank</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-charcoal-700 dark:text-cream-400">Player</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-charcoal-700 dark:text-cream-400">Corps</th>
                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-charcoal-700 dark:text-cream-400">Score</th>
                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-charcoal-700 dark:text-cream-400">Trophies</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200 dark:divide-cream-500/10">
                  {currentData.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className={`hover:bg-cream-50 dark:hover:bg-charcoal-800/50 transition-colors ${
                        loggedInProfile?.username === entry.username
                          ? 'bg-amber-50 dark:bg-gold-500/5'
                          : idx % 2 === 0
                          ? 'bg-white dark:bg-transparent'
                          : 'bg-cream-50/50 dark:bg-charcoal-900/20'
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
          <EmptyState
            title="NO SCORES RECORDED"
            subtitle={
              rankingsTab === 'weekly'
                ? 'Awaiting weekly competition data...'
                : rankingsTab === 'monthly'
                ? 'Awaiting monthly competition data...'
                : 'Waiting for DCI season to commence...'
            }
          />
        )}
      </motion.div>

      {/* Load More Button */}
      {!loading && hasMore[rankingsTab] && (
        <div className="flex justify-center">
          <button
            onClick={loadMoreLeaderboard}
            disabled={loadingMore}
            className="flex items-center gap-2 px-5 py-2.5 bg-stone-100 dark:bg-charcoal-800/50 text-slate-600 dark:text-cream-300 rounded-lg hover:bg-stone-200 dark:hover:bg-charcoal-800 transition-colors text-sm disabled:opacity-50 border border-cream-200 dark:border-cream-500/20"
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
