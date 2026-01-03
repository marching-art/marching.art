// OverviewTab - Profile overview with corps, career stats, and milestones (Stadium HUD)
import React from 'react';
import { motion } from 'framer-motion';
import { Users, Target, Zap, CheckCircle } from 'lucide-react';
import { compareCorpsClasses } from '../../../utils/corps';

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
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-sm p-6">
          <h2 className="text-xl font-display font-bold text-yellow-50 mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]" />
            Active Corps
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(profile.corps)
              .sort((a, b) => compareCorpsClasses(a[0], b[0]))
              .map(([classKey, corps]) => (
              <div key={classKey} className="bg-black/30 border border-white/5 rounded-sm p-4 hover:border-yellow-500/30 hover:shadow-[0_0_15px_rgba(234,179,8,0.1)] transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs text-yellow-50/70 uppercase tracking-wide font-display">{classKey}</p>
                    <h3 className="font-display font-bold text-yellow-50 text-lg">{corps.corpsName || corps.name || 'Unnamed Corps'}</h3>
                  </div>
                  {corps.totalSeasonScore !== undefined && (
                    <div className="text-right">
                      <p className="text-xs text-yellow-50/70">Score</p>
                      <p className="text-xl font-display font-bold text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">{corps.totalSeasonScore.toFixed(2)}</p>
                    </div>
                  )}
                </div>
                {corps.location && (
                  <p className="text-sm text-yellow-50/60">{corps.location}</p>
                )}
                {corps.selectedShows && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-xs text-yellow-50/70">
                      Shows: <span className="text-yellow-400">{Object.keys(corps.selectedShows).length}</span> selected
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Career Stats */}
      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-sm p-6">
        <h2 className="text-xl font-display font-bold text-yellow-50 mb-4 flex items-center gap-2">
          <Target className="w-6 h-6 text-green-400 drop-shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
          Career Stats
        </h2>
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <div className="text-center bg-black/30 border border-yellow-500/20 rounded-sm p-4">
            <p className="text-2xl md:text-4xl font-display font-bold text-yellow-400 mb-1 md:mb-2 drop-shadow-[0_0_12px_rgba(234,179,8,0.5)]">{profile.stats?.championships || 0}</p>
            <p className="text-yellow-50/60 text-xs md:text-base font-display">Championships</p>
          </div>
          <div className="text-center bg-black/30 border border-blue-500/20 rounded-sm p-4">
            <p className="text-2xl md:text-4xl font-display font-bold text-blue-400 mb-1 md:mb-2 drop-shadow-[0_0_12px_rgba(59,130,246,0.5)]">{profile.stats?.topTenFinishes || 0}</p>
            <p className="text-yellow-50/60 text-xs md:text-base font-display">Top 10</p>
          </div>
          <div className="text-center bg-black/30 border border-purple-500/20 rounded-sm p-4">
            <p className="text-2xl md:text-4xl font-display font-bold text-purple-400 mb-1 md:mb-2 drop-shadow-[0_0_12px_rgba(168,85,247,0.5)]">{profile.stats?.seasonsPlayed || 0}</p>
            <p className="text-yellow-50/60 text-xs md:text-base font-display">Seasons</p>
          </div>
        </div>
      </div>

      {/* Milestone Progress */}
      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-sm p-6">
        <h2 className="text-xl font-display font-bold text-yellow-50 mb-4 flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]" />
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
                className={`bg-black/30 border rounded-sm p-3 ${
                  isComplete ? 'border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : 'border-white/5'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${
                    isComplete ? 'bg-yellow-500/20 text-yellow-400' : 'bg-black/40 text-yellow-50/60'
                  }`}>
                    {isComplete ? <CheckCircle className="w-4 h-4 drop-shadow-[0_0_4px_rgba(234,179,8,0.5)]" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <p className={`font-display font-semibold text-sm ${isComplete ? 'text-yellow-400' : 'text-yellow-50'}`}>
                      {milestone.name}
                    </p>
                    <p className="text-xs text-yellow-50/70">{milestone.description}</p>
                  </div>
                </div>
                <div className="w-full bg-black/50 rounded-sm h-1.5">
                  <div
                    className={`h-1.5 rounded-sm transition-all ${isComplete ? 'bg-gradient-to-r from-yellow-500 to-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'bg-blue-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-yellow-50/70 mt-1 text-right">
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
