// src/components/Dashboard/DashboardSidebar.jsx
import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Target, Trophy, Wrench, Users, Calendar, Star,
  ChevronDown, Sparkles, Award, Crown, Gift, Activity,
  Zap
} from 'lucide-react';

/**
 * Streamlined sidebar - Weekly progress, activity feed, and quick links
 * Stats (Level, Coins, Streak) are now only in the header to avoid redundancy
 */
const DashboardSidebar = ({
  weeklyProgress,
  engagementData,
  profile,
  activeCorps,
  activeCorpsClass,
  currentWeek,
  unclaimedRewardsCount
}) => {
  const [expandedSection, setExpandedSection] = useState('weekly');

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="space-y-3">
      {/* Battle Pass Notification - Priority CTA */}
      {unclaimedRewardsCount > 0 && (
        <Link
          to="/battlepass"
          className="block glass-premium rounded-xl p-3 border border-gold-500/30 hover:border-gold-500/60 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Crown className="w-6 h-6 text-gold-500 group-hover:scale-110 transition-transform" />
              <Sparkles className="w-3 h-3 text-gold-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gradient">
                {unclaimedRewardsCount} Rewards!
              </p>
              <p className="text-xs text-cream-300">Claim now</p>
            </div>
            <Gift className="w-4 h-4 text-gold-500" />
          </div>
        </Link>
      )}

      {/* Weekly Progress - Primary info for competitive players */}
      {activeCorps && activeCorpsClass !== 'soundSport' && weeklyProgress && (
        <div className="accordion-section">
          <button
            onClick={() => toggleSection('weekly')}
            className="accordion-header"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gold-500" />
              <span className="text-xs font-bold text-gold-500 uppercase tracking-widest">Week {currentWeek} Progress</span>
            </div>
            <ChevronDown className={`accordion-chevron ${expandedSection === 'weekly' ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {expandedSection === 'weekly' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="accordion-content pt-3 grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-black/40 border border-white/5 hover:border-gold-500/30 transition-colors">
                    <div className="flex items-center gap-1 mb-1">
                      <Target className="w-3 h-3 text-blue-400" />
                      <span className="data-label-sm">Rehearsals</span>
                    </div>
                    <p className="text-sm font-mono font-bold text-blue-400">
                      +{weeklyProgress.rehearsalsCompleted || 0}
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-black/40 border border-white/5 hover:border-gold-500/30 transition-colors">
                    <div className="flex items-center gap-1 mb-1">
                      <Star className="w-3 h-3 text-gold-400" />
                      <span className="data-label-sm">Score</span>
                    </div>
                    <p className={`text-sm font-mono font-bold ${
                      (weeklyProgress.scoreImprovement || 0) > 0 ? 'text-green-400' :
                      (weeklyProgress.scoreImprovement || 0) < 0 ? 'text-red-400' : 'text-cream-100'
                    }`}>
                      {(weeklyProgress.scoreImprovement || 0) > 0 ? '+' : ''}{(weeklyProgress.scoreImprovement || 0).toFixed(1)}
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-black/40 border border-white/5 hover:border-gold-500/30 transition-colors">
                    <div className="flex items-center gap-1 mb-1">
                      <Trophy className="w-3 h-3 text-purple-400" />
                      <span className="data-label-sm">Rank</span>
                    </div>
                    <p className={`text-sm font-mono font-bold ${
                      (weeklyProgress.rankChange || 0) > 0 ? 'text-green-400' :
                      (weeklyProgress.rankChange || 0) < 0 ? 'text-red-400' : 'text-cream-100'
                    }`}>
                      {(weeklyProgress.rankChange || 0) > 0 ? '↑' : (weeklyProgress.rankChange || 0) < 0 ? '↓' : '→'}
                      {Math.abs(weeklyProgress.rankChange || 0)}
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-black/40 border border-white/5 hover:border-gold-500/30 transition-colors">
                    <div className="flex items-center gap-1 mb-1">
                      <Wrench className="w-3 h-3 text-orange-400" />
                      <span className="data-label-sm">Equipment</span>
                    </div>
                    <p className={`text-sm font-mono font-bold ${
                      (weeklyProgress.equipmentMaintained || 0) >= 85 ? 'text-green-400' :
                      (weeklyProgress.equipmentMaintained || 0) >= 70 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {(weeklyProgress.equipmentMaintained || 0).toFixed(0)}%
                    </p>
                  </div>
                </div>

                {((weeklyProgress.scoreImprovement || 0) > 0 || (weeklyProgress.rankChange || 0) > 0) && (
                  <div className="mx-3 mb-3 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-green-400" />
                      <span className="text-xs text-green-400">
                        {(weeklyProgress.rankChange || 0) > 0 ? 'Climbing ranks!' : 'Scores improving!'}
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Recent Activity Feed */}
      {engagementData?.recentActivity?.length > 0 && (
        <div className="accordion-section">
          <button
            onClick={() => toggleSection('activity')}
            className="accordion-header"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-gold-500" />
              <span className="text-xs font-bold text-gold-500 uppercase tracking-widest">Recent Activity</span>
            </div>
            <ChevronDown className={`accordion-chevron ${expandedSection === 'activity' ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {expandedSection === 'activity' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="accordion-content pt-3 space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                  {engagementData.recentActivity.slice(0, 5).map((activity, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-xs text-cream-100/60 p-1.5 bg-black/40 border border-white/5 rounded-lg"
                    >
                      {activity.icon === 'flame' && <span className="text-orange-400">🔥</span>}
                      {activity.icon === 'trophy' && <Trophy className="w-3 h-3 text-gold-500 flex-shrink-0" />}
                      {activity.icon === 'star' && <Star className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
                      <span className="flex-1 truncate">{activity.message}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Achievements Summary */}
      {profile?.achievements?.length > 0 && (
        <Link
          to="/profile"
          className="block glass rounded-xl p-3 hover:bg-cream-500/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gold-500/20">
              <Award className="w-4 h-4 text-gold-500" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gold-400">
                {profile.achievements.length} Achievements
              </div>
              <div className="text-xs text-cream-500/60">View profile</div>
            </div>
          </div>
        </Link>
      )}

      {/* Quick Links */}
      <div className="glass-slot space-y-1">
        <h4 className="section-label mb-2">Quick Links</h4>
        <Link
          to="/scores"
          className="flex items-center gap-2 p-2 rounded-lg bg-black/40 border border-white/5 hover:border-gold-500/30 transition-colors text-cream-100/80 text-sm"
        >
          <Trophy className="w-4 h-4 text-gold-500" />
          Leaderboards
        </Link>
        <Link
          to="/staff"
          className="flex items-center gap-2 p-2 rounded-lg bg-black/40 border border-white/5 hover:border-gold-500/30 transition-colors text-cream-100/80 text-sm"
        >
          <Users className="w-4 h-4 text-purple-400" />
          Staff Market
        </Link>
        <Link
          to="/leagues"
          className="flex items-center gap-2 p-2 rounded-lg bg-black/40 border border-white/5 hover:border-gold-500/30 transition-colors text-cream-100/80 text-sm"
        >
          <Zap className="w-4 h-4 text-blue-400" />
          Leagues
        </Link>
      </div>
    </div>
  );
};

export default memo(DashboardSidebar);
