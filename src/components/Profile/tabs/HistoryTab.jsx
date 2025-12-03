// HistoryTab - Season history, retired corps, and class progression
import React from 'react';
import { motion } from 'framer-motion';
import { History, Trophy, Calendar, Medal, TrendingUp, CheckCircle, Lock } from 'lucide-react';
import EmptyState from '../../EmptyState';

// Note: unlockedClasses array uses 'open' and 'world' (not 'openClass' and 'worldClass')
const CLASS_ORDER = ['world', 'open', 'aClass', 'soundSport'];
const CLASS_LEVELS = { soundSport: 1, aClass: 3, open: 5, world: 10 };
const CLASS_NAMES = { soundSport: 'SoundSport', aClass: 'A Class', open: 'Open Class', world: 'World Class' };
const CLASS_COLORS = { soundSport: 'green', aClass: 'blue', open: 'purple', world: 'gold' };

const colorClasses = {
  gold: 'bg-gold-500/20 text-gold-400',
  blue: 'bg-blue-500/20 text-blue-400',
  green: 'bg-green-500/20 text-green-400',
  purple: 'bg-purple-500/20 text-purple-400'
};

const HistoryTab = ({ profile, seasonHistory }) => {
  return (
    <motion.div
      key="history"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Season History Timeline */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
          <History className="w-6 h-6 text-purple-400" />
          Season History
        </h2>
        {seasonHistory.length > 0 ? (
          <div className="space-y-4">
            {seasonHistory.map((season, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-start gap-4"
              >
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    season.placement === 1 ? 'bg-gold-500/20 text-gold-400' :
                    season.placement <= 3 ? 'bg-blue-500/20 text-blue-400' :
                    'bg-charcoal-700 text-cream-400'
                  }`}>
                    {season.placement === 1 ? <Trophy className="w-5 h-5" /> :
                     season.placement ? `#${season.placement}` : <Calendar className="w-5 h-5" />}
                  </div>
                  {idx < seasonHistory.length - 1 && (
                    <div className="w-0.5 h-12 bg-charcoal-700 mt-2" />
                  )}
                </div>
                <div className="flex-1 bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-cream-100">{season.corpsName || 'Corps'}</p>
                      <p className="text-xs text-cream-400 uppercase">{season.classKey}</p>
                    </div>
                    {season.finalScore && (
                      <p className="text-lg font-bold text-gold-400">{season.finalScore.toFixed(2)}</p>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    {season.showsCompleted && (
                      <p className="text-cream-400">Shows: {season.showsCompleted}</p>
                    )}
                    {season.seasonNumber && (
                      <p className="text-cream-400">Season {season.seasonNumber}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="NO HISTORY YET"
            subtitle="Complete seasons to build your history..."
          />
        )}
      </div>

      {/* Retired Corps Hall of Fame */}
      {profile.retiredCorps && profile.retiredCorps.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
            <Medal className="w-6 h-6 text-gold-400" />
            Hall of Fame - Retired Corps
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.retiredCorps.map((corps, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-charcoal-800/50 border border-gold-500/30 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-cream-100 text-lg">{corps.corpsName}</h3>
                    <p className="text-xs text-cream-400 uppercase">{corps.corpsClass}</p>
                    {corps.location && (
                      <p className="text-sm text-cream-400 mt-1">{corps.location}</p>
                    )}
                  </div>
                  <Trophy className="w-6 h-6 text-gold-400" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-charcoal-700">
                  <div>
                    <p className="text-lg font-bold text-blue-400">{corps.totalSeasons || 0}</p>
                    <p className="text-xs text-cream-400">Seasons</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gold-400">{corps.bestSeasonScore?.toFixed(1) || '-'}</p>
                    <p className="text-xs text-cream-400">Best</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-400">{corps.totalShows || 0}</p>
                    <p className="text-xs text-cream-400">Shows</p>
                  </div>
                </div>
                {corps.retiredAt && (
                  <p className="text-xs text-cream-500 mt-3 text-center">
                    Retired {new Date(corps.retiredAt?.toDate?.() || corps.retiredAt).toLocaleDateString()}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Class Progression */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-green-400" />
          Class Progression
        </h2>
        <div className="space-y-3">
          {CLASS_ORDER.map((classKey) => {
            const isUnlocked = profile.unlockedClasses?.includes(classKey) ||
                               (profile.xpLevel || 1) >= CLASS_LEVELS[classKey];
            const color = CLASS_COLORS[classKey];
            return (
              <div
                key={classKey}
                className={`flex items-center justify-between p-4 rounded-lg ${
                  isUnlocked
                    ? 'bg-charcoal-800/50 border border-charcoal-700'
                    : 'bg-charcoal-900/50 border border-charcoal-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isUnlocked ? colorClasses[color] : 'bg-charcoal-800 text-charcoal-500'
                  }`}>
                    {isUnlocked ? <CheckCircle className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className={`font-semibold ${isUnlocked ? 'text-cream-100' : 'text-cream-500'}`}>
                      {CLASS_NAMES[classKey]}
                    </p>
                    <p className={`text-sm ${isUnlocked ? 'text-cream-400' : 'text-cream-600'}`}>
                      Unlocks at Level {CLASS_LEVELS[classKey]}
                    </p>
                  </div>
                </div>
                {isUnlocked && (
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                    Unlocked
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default HistoryTab;
