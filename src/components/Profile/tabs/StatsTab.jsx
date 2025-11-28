// StatsTab - Performance summary, scores, and account statistics
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
      <div className="glass rounded-2xl p-6">
        <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-blue-400" />
          Performance Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-gold-400">{profile.stats?.championships || 0}</p>
            <p className="text-cream-400 text-sm mt-1">Championships</p>
          </div>
          <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-blue-400">{profile.stats?.topTenFinishes || 0}</p>
            <p className="text-cream-400 text-sm mt-1">Top 10 Finishes</p>
          </div>
          <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-purple-400">{profile.stats?.seasonsPlayed || 0}</p>
            <p className="text-cream-400 text-sm mt-1">Seasons Played</p>
          </div>
          <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-green-400">
              {profile.stats?.championships && profile.stats?.seasonsPlayed
                ? ((profile.stats.championships / profile.stats.seasonsPlayed) * 100).toFixed(0)
                : 0}%
            </p>
            <p className="text-cream-400 text-sm mt-1">Win Rate</p>
          </div>
        </div>
      </div>

      {/* Score Breakdown by Class */}
      {profile.corps && Object.keys(profile.corps).length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
            <Target className="w-6 h-6 text-green-400" />
            Current Season Scores
          </h2>
          <div className="space-y-4">
            {Object.entries(profile.corps).map(([classKey, corps]) => {
              const maxScore = 100;
              const scorePercentage = ((corps.totalSeasonScore || 0) / maxScore) * 100;
              return (
                <div key={classKey}>
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <p className="font-semibold text-cream-100">{corps.name}</p>
                      <p className="text-xs text-cream-400 uppercase">{classKey}</p>
                    </div>
                    <p className="text-xl font-bold text-gold-400">{(corps.totalSeasonScore || 0).toFixed(2)}</p>
                  </div>
                  <div className="w-full bg-charcoal-700 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-gold-500 h-3 rounded-full transition-all"
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
      <div className="glass rounded-2xl p-6">
        <h2 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
          <Clock className="w-6 h-6 text-purple-400" />
          Account Statistics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
            <p className="text-cream-400 text-sm">Total XP Earned</p>
            <p className="text-2xl font-bold text-blue-400">{(profile.xp || 0).toLocaleString()}</p>
          </div>
          <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
            <p className="text-cream-400 text-sm">Total CorpsCoin</p>
            <p className="text-2xl font-bold text-green-400">{(profile.corpsCoin || 0).toLocaleString()}</p>
          </div>
          <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
            <p className="text-cream-400 text-sm">Active Corps</p>
            <p className="text-2xl font-bold text-purple-400">{Object.keys(profile.corps || {}).length}</p>
          </div>
          <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
            <p className="text-cream-400 text-sm">Retired Corps</p>
            <p className="text-2xl font-bold text-orange-400">{profile.retiredCorps?.length || 0}</p>
          </div>
          {profile.createdAt && (
            <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4 md:col-span-2">
              <p className="text-cream-400 text-sm">Member Since</p>
              <p className="text-xl font-bold text-cream-100">
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
