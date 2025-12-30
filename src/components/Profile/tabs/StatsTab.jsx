// StatsTab - Performance summary, scores, and account statistics (Stadium HUD)
import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Target, Clock } from 'lucide-react';

const StatsTab = ({ profile }) => {
  return (
    <motion.div
      key="stats"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Performance Summary */}
      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-display font-bold text-yellow-50 mb-4 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
          Performance Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-black/30 border border-yellow-500/20 rounded-xl p-4 text-center shadow-[0_0_15px_rgba(234,179,8,0.1)]">
            <p className="text-3xl font-display font-bold text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">{profile.stats?.championships || 0}</p>
            <p className="text-yellow-50/60 text-sm mt-1 font-display">Championships</p>
          </div>
          <div className="bg-black/30 border border-blue-500/20 rounded-xl p-4 text-center shadow-[0_0_15px_rgba(59,130,246,0.1)]">
            <p className="text-3xl font-display font-bold text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">{profile.stats?.topTenFinishes || 0}</p>
            <p className="text-yellow-50/60 text-sm mt-1 font-display">Top 10 Finishes</p>
          </div>
          <div className="bg-black/30 border border-purple-500/20 rounded-xl p-4 text-center shadow-[0_0_15px_rgba(168,85,247,0.1)]">
            <p className="text-3xl font-display font-bold text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">{profile.stats?.seasonsPlayed || 0}</p>
            <p className="text-yellow-50/60 text-sm mt-1 font-display">Seasons Played</p>
          </div>
          <div className="bg-black/30 border border-green-500/20 rounded-xl p-4 text-center shadow-[0_0_15px_rgba(74,222,128,0.1)]">
            <p className="text-3xl font-display font-bold text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]">
              {profile.stats?.championships && profile.stats?.seasonsPlayed
                ? ((profile.stats.championships / profile.stats.seasonsPlayed) * 100).toFixed(0)
                : 0}%
            </p>
            <p className="text-yellow-50/60 text-sm mt-1 font-display">Win Rate</p>
          </div>
        </div>
      </div>

      {/* Score Breakdown by Class */}
      {profile.corps && Object.keys(profile.corps).length > 0 && (
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-display font-bold text-yellow-50 mb-4 flex items-center gap-2">
            <Target className="w-6 h-6 text-green-400 drop-shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
            Current Season Scores
          </h2>
          <div className="space-y-4">
            {Object.entries(profile.corps).map(([classKey, corps]) => {
              const maxScore = 100;
              const scorePercentage = ((corps.totalSeasonScore || 0) / maxScore) * 100;
              return (
                <div key={classKey} className="bg-black/30 rounded-xl p-4 border border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <p className="font-display font-semibold text-yellow-50">{corps.name}</p>
                      <p className="text-xs text-yellow-50/70 uppercase tracking-wide">{classKey}</p>
                    </div>
                    <p className="text-xl font-display font-bold text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">{(corps.totalSeasonScore || 0).toFixed(2)}</p>
                  </div>
                  <div className="w-full bg-black/50 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-yellow-400 h-3 rounded-full transition-all shadow-[0_0_10px_rgba(234,179,8,0.3)]"
                      style={{ width: `${Math.min(scorePercentage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Account Stats */}
      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-display font-bold text-yellow-50 mb-4 flex items-center gap-2">
          <Clock className="w-6 h-6 text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" />
          Account Statistics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-black/30 border border-white/5 rounded-xl p-4">
            <p className="text-yellow-50/70 text-sm font-display">Total XP Earned</p>
            <p className="text-2xl font-display font-bold text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">{(profile.xp || 0).toLocaleString()}</p>
          </div>
          <div className="bg-black/30 border border-white/5 rounded-xl p-4">
            <p className="text-yellow-50/70 text-sm font-display">Total CorpsCoin</p>
            <p className="text-2xl font-display font-bold text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]">{(profile.corpsCoin || 0).toLocaleString()}</p>
          </div>
          <div className="bg-black/30 border border-white/5 rounded-xl p-4">
            <p className="text-yellow-50/70 text-sm font-display">Active Corps</p>
            <p className="text-2xl font-display font-bold text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">{Object.keys(profile.corps || {}).length}</p>
          </div>
          <div className="bg-black/30 border border-white/5 rounded-xl p-4">
            <p className="text-yellow-50/70 text-sm font-display">Retired Corps</p>
            <p className="text-2xl font-display font-bold text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]">{profile.retiredCorps?.length || 0}</p>
          </div>
          {profile.createdAt && (
            <div className="bg-black/30 border border-white/5 rounded-xl p-4 md:col-span-2">
              <p className="text-yellow-50/70 text-sm font-display">Member Since</p>
              <p className="text-xl font-display font-bold text-yellow-50">
                {new Date(profile.createdAt?.toDate?.() || profile.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default StatsTab;
