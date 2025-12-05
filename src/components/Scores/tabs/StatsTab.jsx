// StatsTab - Lifetime statistics leaderboard
import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Crown, Medal, Users } from 'lucide-react';
import { SystemLoader, ConsoleEmptyState } from '../../ui/CommandConsole';

// Lifetime views configuration
const lifetimeViews = [
  { id: 'totalPoints', label: 'Total Points', desc: 'All-time points' },
  { id: 'totalSeasons', label: 'Seasons', desc: 'Seasons played' },
  { id: 'totalShows', label: 'Shows', desc: 'Shows attended' },
  { id: 'bestSeasonScore', label: 'Best Season', desc: 'Highest season score' },
  { id: 'leagueChampionships', label: 'Championships', desc: 'League titles won' }
];

// Helper functions
const getRankIcon = (rank) => {
  switch (rank) {
    case 1:
      return <Crown className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />;
    case 2:
      return <Trophy className="w-5 h-5 md:w-6 md:h-6 text-gray-400" />;
    case 3:
      return <Medal className="w-5 h-5 md:w-6 md:h-6 text-orange-400" />;
    default:
      return <span className="text-cream-300 font-bold">#{rank}</span>;
  }
};

const getRankBgColor = (rank) => {
  switch (rank) {
    case 1:
      return 'bg-gradient-to-r from-yellow-400/20 to-yellow-500/10 border-yellow-400/30';
    case 2:
      return 'bg-gradient-to-r from-gray-400/20 to-gray-500/10 border-gray-400/30';
    case 3:
      return 'bg-gradient-to-r from-orange-400/20 to-orange-500/10 border-orange-400/30';
    default:
      if (rank <= 10) return 'bg-charcoal-800/30 border-cream-500/20';
      return 'bg-charcoal-900/30 border-cream-500/10';
  }
};

const StatsTab = ({
  loading,
  lifetimeData,
  lifetimeView,
  setLifetimeView,
  loggedInProfile
}) => {
  return (
    <div className="space-y-6">
      {/* Lifetime View Selector - Mechanical Segmented Control */}
      <div className="flex justify-center -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto">
        <div className="inline-flex border-2 border-charcoal-900 dark:border-cream-100 rounded-sm overflow-hidden">
          {lifetimeViews.map((view, index) => {
            const isActive = lifetimeView === view.id;
            const isLast = index === lifetimeViews.length - 1;
            return (
              <button
                key={view.id}
                onClick={() => setLifetimeView(view.id)}
                className={`px-3 md:px-4 py-2 md:py-2.5 font-bold uppercase tracking-wide transition-all whitespace-nowrap text-xs md:text-sm ${
                  isActive
                    ? 'bg-charcoal-900 dark:bg-cream-100 text-gold-400 dark:text-charcoal-900'
                    : 'bg-white dark:bg-charcoal-900 text-charcoal-900 dark:text-cream-100 hover:bg-cream-100 dark:hover:bg-charcoal-800'
                } ${!isLast ? 'border-r-2 border-charcoal-900 dark:border-cream-100' : ''}`}
              >
                {view.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lifetime Stats Table/Cards */}
      <motion.div
        key={lifetimeView}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-charcoal-800/30 rounded-lg overflow-hidden"
      >
        {loading ? (
          <div className="py-12">
            <SystemLoader
              messages={[
                'QUERYING DATABASE...',
                'AGGREGATING LIFETIME STATS...',
                'CALCULATING RANKINGS...',
              ]}
              showProgress={true}
            />
          </div>
        ) : lifetimeData.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-charcoal-900/50 border-b border-cream-500/10">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-cream-400">Rank</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-cream-400">Player</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-cream-400">Total Points</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-cream-400">Seasons</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-cream-400">Shows</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-cream-400">Best Season</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-cream-400">Championships</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-500/10">
                  {lifetimeData.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`hover:bg-charcoal-800/50 transition-colors ${
                        loggedInProfile?.username === entry.username ? 'bg-gold-500/5' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {getRankIcon(entry.rank)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-charcoal-800 flex items-center justify-center">
                            <Users className="w-5 h-5 text-cream-400" />
                          </div>
                          <div>
                            <p className="text-cream-100 font-medium">{entry.username}</p>
                            <p className="text-cream-500/60 text-sm">{entry.userTitle || 'Rookie'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-cream-100 font-bold">{entry.lifetimeStats?.totalPoints?.toLocaleString() || '0'}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-cream-100 font-bold">{entry.lifetimeStats?.totalSeasons || 0}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-cream-100 font-bold">{entry.lifetimeStats?.totalShows || 0}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-cream-100 font-bold">{entry.lifetimeStats?.bestSeasonScore?.toFixed(2) || '0.00'}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Trophy className="w-4 h-4 text-gold-500" />
                          <span className="text-cream-100 font-bold">{entry.lifetimeStats?.leagueChampionships || 0}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 p-3">
              {lifetimeData.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-lg p-3 border transition-all ${
                    getRankBgColor(entry.rank)
                  } ${loggedInProfile?.username === entry.username ? 'ring-2 ring-gold-500' : ''}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-shrink-0">
                        {getRankIcon(entry.rank)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-cream-100 font-semibold text-sm truncate">{entry.username}</p>
                        <p className="text-cream-500/60 text-xs">{entry.userTitle || 'Rookie'}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-cream-100 font-bold">{entry.lifetimeStats?.[lifetimeView]?.toLocaleString() || '0'}</p>
                      <p className="text-cream-500/60 text-xs">{lifetimeViews.find(v => v.id === lifetimeView)?.label}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex flex-col text-cream-400">
                      <span className="text-cream-500/60">Total Points</span>
                      <span className="font-semibold text-cream-300">{entry.lifetimeStats?.totalPoints?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="flex flex-col text-cream-400">
                      <span className="text-cream-500/60">Seasons</span>
                      <span className="font-semibold text-cream-300">{entry.lifetimeStats?.totalSeasons || 0}</span>
                    </div>
                    <div className="flex flex-col text-cream-400">
                      <span className="text-cream-500/60">Shows</span>
                      <span className="font-semibold text-cream-300">{entry.lifetimeStats?.totalShows || 0}</span>
                    </div>
                    <div className="flex flex-col text-cream-400">
                      <span className="text-cream-500/60">Championships</span>
                      <div className="flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-gold-500" />
                        <span className="font-semibold text-cream-300">{entry.lifetimeStats?.leagueChampionships || 0}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <ConsoleEmptyState
            variant="server"
            title="NO LIFETIME STATS DETECTED"
            subtitle="Database query returned empty. Complete seasons to register on the leaderboard."
          />
        )}
      </motion.div>
    </div>
  );
};

export default StatsTab;
