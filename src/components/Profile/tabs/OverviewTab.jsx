// OverviewTab - Profile overview with corps, career stats, and milestones
import React from 'react';
import { motion } from 'framer-motion';
import { Users, Target, Zap, CheckCircle } from 'lucide-react';

const OverviewTab = ({ profile, milestones }) => {
  return (
    <motion.div
      key="overview"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Active Corps */}
      {profile.corps && Object.keys(profile.corps).length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-400" />
            Active Corps
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(profile.corps)
              .sort((a, b) => {
                const classOrder = { worldClass: 0, openClass: 1, aClass: 2, soundSport: 3 };
                return (classOrder[a[0]] ?? 99) - (classOrder[b[0]] ?? 99);
              })
              .map(([classKey, corps]) => (
              <div key={classKey} className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4 hover:border-gold-500/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs text-cream-400 uppercase tracking-wide">{classKey}</p>
                    <h3 className="font-bold text-cream-100 text-lg">{corps.corpsName || corps.name || 'Unnamed Corps'}</h3>
                  </div>
                  {corps.totalSeasonScore !== undefined && (
                    <div className="text-right">
                      <p className="text-xs text-cream-400">Score</p>
                      <p className="text-xl font-bold text-gold-400">{corps.totalSeasonScore.toFixed(2)}</p>
                    </div>
                  )}
                </div>
                {corps.location && (
                  <p className="text-sm text-cream-400">{corps.location}</p>
                )}
                {corps.selectedShows && (
                  <div className="mt-3 pt-3 border-t border-charcoal-700">
                    <p className="text-xs text-cream-400">
                      Shows: {Object.keys(corps.selectedShows).length} selected
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Career Stats */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
          <Target className="w-6 h-6 text-green-400" />
          Career Stats
        </h2>
        <div className="grid grid-cols-3 gap-3 md:gap-6">
          <div className="text-center">
            <p className="text-2xl md:text-4xl font-bold text-gold-400 mb-1 md:mb-2">{profile.stats?.championships || 0}</p>
            <p className="text-cream-400 text-xs md:text-base">Championships</p>
          </div>
          <div className="text-center">
            <p className="text-2xl md:text-4xl font-bold text-blue-400 mb-1 md:mb-2">{profile.stats?.topTenFinishes || 0}</p>
            <p className="text-cream-400 text-xs md:text-base">Top 10</p>
          </div>
          <div className="text-center">
            <p className="text-2xl md:text-4xl font-bold text-purple-400 mb-1 md:mb-2">{profile.stats?.seasonsPlayed || 0}</p>
            <p className="text-cream-400 text-xs md:text-base">Seasons</p>
          </div>
        </div>
      </div>

      {/* Milestone Progress */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-400" />
          Milestone Progress
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {milestones.slice(0, 6).map((milestone, idx) => {
            const Icon = milestone.icon;
            const isComplete = milestone.current >= milestone.requirement;
            const progress = Math.min((milestone.current / milestone.requirement) * 100, 100);

            return (
              <div
                key={idx}
                className={`bg-charcoal-800/50 border rounded-lg p-3 ${
                  isComplete ? 'border-gold-500/50' : 'border-charcoal-700'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isComplete ? 'bg-gold-500/20 text-gold-400' : 'bg-charcoal-700 text-cream-400'
                  }`}>
                    {isComplete ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold text-sm ${isComplete ? 'text-gold-400' : 'text-cream-100'}`}>
                      {milestone.name}
                    </p>
                    <p className="text-xs text-cream-400">{milestone.description}</p>
                  </div>
                </div>
                <div className="w-full bg-charcoal-700 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${isComplete ? 'bg-gold-500' : 'bg-blue-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-cream-400 mt-1 text-right">
                  {milestone.current} / {milestone.requirement}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default OverviewTab;
