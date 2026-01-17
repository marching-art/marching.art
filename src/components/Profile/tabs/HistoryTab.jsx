// HistoryTab - Season history, retired corps, and class progression (Stadium HUD)
import React from 'react';
import { m } from 'framer-motion';
import { History, Trophy, Calendar, Medal, TrendingUp, CheckCircle, Lock } from 'lucide-react';
import EmptyState from '../../EmptyState';

// Note: unlockedClasses array uses 'open' and 'world' (not 'openClass' and 'worldClass')
const CLASS_ORDER = ['world', 'open', 'aClass', 'soundSport'];
const CLASS_LEVELS = { soundSport: 1, aClass: 3, open: 5, world: 10 };
const CLASS_NAMES = { soundSport: 'SoundSport', aClass: 'A Class', open: 'Open Class', world: 'World Class' };
const CLASS_COLORS = {
  soundSport: { border: 'border-green-500/30', bg: 'bg-green-500/20', text: 'text-green-400', glow: 'drop-shadow-[0_0_6px_rgba(74,222,128,0.5)]' },
  aClass: { border: 'border-blue-500/30', bg: 'bg-blue-500/20', text: 'text-blue-400', glow: 'drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]' },
  open: { border: 'border-purple-500/30', bg: 'bg-purple-500/20', text: 'text-purple-400', glow: 'drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]' },
  world: { border: 'border-yellow-500/30', bg: 'bg-yellow-500/20', text: 'text-yellow-400', glow: 'drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]' }
};

const HistoryTab = ({ profile, seasonHistory }) => {
  return (
    <m.div
      key="history"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Season History Timeline */}
      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-sm p-6">
        <h2 className="text-xl font-display font-bold text-yellow-50 mb-4 flex items-center gap-2">
          <History className="w-6 h-6 text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" />
          Season History
        </h2>
        {seasonHistory.length > 0 ? (
          <div className="space-y-4">
            {seasonHistory.map((season, idx) => (
              <m.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-start gap-4"
              >
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${
                    season.placement === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                    season.placement <= 3 ? 'bg-blue-500/20 text-blue-400' :
                    'bg-black/40 text-yellow-50/60'
                  }`}>
                    {season.placement === 1 ? <Trophy className="w-5 h-5 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]" /> :
                     season.placement ? `#${season.placement}` : <Calendar className="w-5 h-5" />}
                  </div>
                  {idx < seasonHistory.length - 1 && (
                    <div className="w-0.5 h-12 bg-white/10 mt-2" />
                  )}
                </div>
                <div className="flex-1 bg-black/30 border border-white/5 rounded-sm p-4 hover:border-yellow-500/20 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-display font-semibold text-yellow-50">{season.corpsName || 'Corps'}</p>
                      <p className="text-xs text-yellow-50/70 uppercase tracking-wide">{season.classKey}</p>
                    </div>
                    {season.finalScore && (
                      <p className="text-lg font-display font-bold text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">{season.finalScore.toFixed(2)}</p>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    {season.showsCompleted && (
                      <p className="text-yellow-50/70">Shows: <span className="text-yellow-50">{season.showsCompleted}</span></p>
                    )}
                    {season.seasonNumber && (
                      <p className="text-yellow-50/70">Season <span className="text-yellow-50">{season.seasonNumber}</span></p>
                    )}
                  </div>
                </div>
              </m.div>
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
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-sm p-6">
          <h2 className="text-xl font-display font-bold text-yellow-50 mb-4 flex items-center gap-2">
            <Medal className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]" />
            Hall of Fame - Retired Corps
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.retiredCorps.map((corps, idx) => (
              <m.div
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-black/30 border border-yellow-500/20 rounded-sm p-4 shadow-[0_0_15px_rgba(234,179,8,0.1)]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-display font-bold text-yellow-50 text-lg">{corps.corpsName}</h3>
                    <p className="text-xs text-yellow-50/70 uppercase tracking-wide">{corps.corpsClass}</p>
                    {corps.location && (
                      <p className="text-sm text-yellow-50/60 mt-1">{corps.location}</p>
                    )}
                  </div>
                  <Trophy className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-white/5">
                  <div>
                    <p className="text-lg font-display font-bold text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]">{corps.totalSeasons || 0}</p>
                    <p className="text-xs text-yellow-50/70">Seasons</p>
                  </div>
                  <div>
                    <p className="text-lg font-display font-bold text-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]">{corps.bestSeasonScore?.toFixed(1) || '-'}</p>
                    <p className="text-xs text-yellow-50/70">Best</p>
                  </div>
                  <div>
                    <p className="text-lg font-display font-bold text-green-400 drop-shadow-[0_0_6px_rgba(74,222,128,0.5)]">{corps.totalShows || 0}</p>
                    <p className="text-xs text-yellow-50/70">Shows</p>
                  </div>
                </div>
                {corps.retiredAt && (
                  <p className="text-xs text-yellow-50/40 mt-3 text-center">
                    Retired {new Date(corps.retiredAt?.toDate?.() || corps.retiredAt).toLocaleDateString()}
                  </p>
                )}
              </m.div>
            ))}
          </div>
        </div>
      )}

      {/* Class Progression */}
      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-sm p-6">
        <h2 className="text-xl font-display font-bold text-yellow-50 mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-green-400 drop-shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
          Class Progression
        </h2>
        <div className="space-y-3">
          {CLASS_ORDER.map((classKey) => {
            const isUnlocked = profile.unlockedClasses?.includes(classKey) ||
                               (profile.xpLevel || 1) >= CLASS_LEVELS[classKey];
            const colors = CLASS_COLORS[classKey];
            return (
              <div
                key={classKey}
                className={`flex items-center justify-between p-4 rounded-sm transition-all ${
                  isUnlocked
                    ? `bg-black/30 border ${colors.border} shadow-[0_0_15px_rgba(234,179,8,0.05)]`
                    : 'bg-black/20 border border-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${
                    isUnlocked ? `${colors.bg} ${colors.text}` : 'bg-black/40 text-yellow-50/30'
                  }`}>
                    {isUnlocked ? <CheckCircle className={`w-5 h-5 ${colors.glow}`} /> : <Lock className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className={`font-display font-semibold ${isUnlocked ? 'text-yellow-50' : 'text-yellow-50/40'}`}>
                      {CLASS_NAMES[classKey]}
                    </p>
                    <p className={`text-sm ${isUnlocked ? 'text-yellow-50/70' : 'text-yellow-50/30'}`}>
                      Unlocks at Level {CLASS_LEVELS[classKey]}
                    </p>
                  </div>
                </div>
                {isUnlocked && (
                  <span className={`text-xs ${colors.bg} ${colors.text} px-2 py-1 rounded-sm font-display font-medium ${colors.glow}`}>
                    Unlocked
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </m.div>
  );
};

export default HistoryTab;
