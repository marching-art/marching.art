// src/components/Dashboard/DashboardSidebar.jsx
import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Target, Trophy, Wrench, Users, Calendar, Star,
  ChevronDown, Sparkles, Flame, Award, Crown, Gift, Activity,
  TrendingUp, Zap
} from 'lucide-react';

/**
 * Sidebar component for desktop - shows weekly progress, stats, and quick links
 * Daily activities are now in the main Daily Ops view
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
      {/* Battle Pass Notification - Gold accent on cream */}
      {unclaimedRewardsCount > 0 && (
        <Link
          to="/battlepass"
          className="block card-cream p-3 hover:scale-[1.02] transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Crown className="w-6 h-6 text-gold-600 group-hover:scale-110 transition-transform" />
              <Sparkles className="w-3 h-3 text-gold-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-oswald font-bold text-gold-600">
                {unclaimedRewardsCount} Rewards!
              </p>
              <p className="text-xs font-montserrat text-brown-900/70">Claim now</p>
            </div>
            <Gift className="w-4 h-4 text-gold-600" />
          </div>
        </Link>
      )}

      {/* Login Streak - Cream Card */}
      {engagementData?.loginStreak > 1 && (
        <div className="card-cream p-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Flame className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <div className="text-lg font-oswald font-bold text-orange-600">
                {engagementData.loginStreak} Days
              </div>
              <div className="text-xs font-montserrat text-brown-900/60">Login Streak</div>
            </div>
            {engagementData.loginStreak >= 7 && (
              <Sparkles className="w-4 h-4 text-gold-500" />
            )}
          </div>
        </div>
      )}

      {/* Quick Stats - Cream Card */}
      <div className="card-cream p-3">
        <h4 className="text-xs font-oswald font-semibold text-gold-600 uppercase tracking-wider mb-3 flex items-center gap-2">
          <TrendingUp className="w-3 h-3" />
          Your Stats
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg bg-blue-100 border border-blue-300 text-center">
            <div className="text-lg font-oswald font-bold text-blue-700">
              {profile?.xpLevel || 1}
            </div>
            <div className="text-[10px] font-montserrat text-brown-900/60">Level</div>
          </div>
          <div className="p-2 rounded-lg bg-gold-100 border border-gold-400 text-center">
            <div className="text-lg font-oswald font-bold text-gold-600">
              {profile?.corpsCoin || 0}
            </div>
            <div className="text-[10px] font-montserrat text-brown-900/60">CorpsCoin</div>
          </div>
        </div>
      </div>

      {/* Weekly Progress - Cream Card */}
      {activeCorps && activeCorpsClass !== 'soundSport' && weeklyProgress && (
        <div className="card-cream overflow-hidden">
          <button
            onClick={() => toggleSection('weekly')}
            className="w-full p-3 flex items-center justify-between hover:bg-cream-200 transition-colors rounded-t-xl"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-oswald font-semibold text-brown-900">Week {currentWeek}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-brown-900/60 transition-transform ${
              expandedSection === 'weekly' ? 'rotate-180' : ''
            }`} />
          </button>

          <AnimatePresence>
            {expandedSection === 'weekly' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-blue-100 border border-blue-300">
                    <div className="flex items-center gap-1 mb-1">
                      <Target className="w-3 h-3 text-blue-600" />
                      <span className="text-[10px] font-montserrat text-brown-900/60">Rehearsals</span>
                    </div>
                    <p className="text-lg font-oswald font-bold text-blue-700">
                      +{weeklyProgress.rehearsalsCompleted || 0}
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-gold-100 border border-gold-400">
                    <div className="flex items-center gap-1 mb-1">
                      <Star className="w-3 h-3 text-gold-600" />
                      <span className="text-[10px] font-montserrat text-brown-900/60">Score</span>
                    </div>
                    <p className={`text-lg font-oswald font-bold ${
                      (weeklyProgress.scoreImprovement || 0) > 0 ? 'text-green-600' :
                      (weeklyProgress.scoreImprovement || 0) < 0 ? 'text-red-600' : 'text-brown-900'
                    }`}>
                      {(weeklyProgress.scoreImprovement || 0) > 0 ? '+' : ''}{(weeklyProgress.scoreImprovement || 0).toFixed(1)}
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-purple-100 border border-purple-300">
                    <div className="flex items-center gap-1 mb-1">
                      <Trophy className="w-3 h-3 text-purple-600" />
                      <span className="text-[10px] font-montserrat text-brown-900/60">Rank</span>
                    </div>
                    <p className={`text-lg font-oswald font-bold ${
                      (weeklyProgress.rankChange || 0) > 0 ? 'text-green-600' :
                      (weeklyProgress.rankChange || 0) < 0 ? 'text-red-600' : 'text-brown-900'
                    }`}>
                      {(weeklyProgress.rankChange || 0) > 0 ? '↑' : (weeklyProgress.rankChange || 0) < 0 ? '↓' : '→'}
                      {Math.abs(weeklyProgress.rankChange || 0)}
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-orange-100 border border-orange-300">
                    <div className="flex items-center gap-1 mb-1">
                      <Wrench className="w-3 h-3 text-orange-600" />
                      <span className="text-[10px] font-montserrat text-brown-900/60">Equipment</span>
                    </div>
                    <p className={`text-lg font-oswald font-bold ${
                      (weeklyProgress.equipmentMaintained || 0) >= 80 ? 'text-green-600' :
                      (weeklyProgress.equipmentMaintained || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {(weeklyProgress.equipmentMaintained || 0).toFixed(0)}%
                    </p>
                  </div>
                </div>

                {((weeklyProgress.scoreImprovement || 0) > 0 || (weeklyProgress.rankChange || 0) > 0) && (
                  <div className="mx-3 mb-3 p-2 rounded-lg bg-green-100 border border-green-300">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-green-600" />
                      <span className="text-xs font-montserrat text-green-700">
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

      {/* Recent Activity - Cream Card */}
      {engagementData?.recentActivity?.length > 0 && (
        <div className="card-cream overflow-hidden">
          <button
            onClick={() => toggleSection('activity')}
            className="w-full p-3 flex items-center justify-between hover:bg-cream-200 transition-colors rounded-t-xl"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-600" />
              <span className="text-sm font-oswald font-semibold text-brown-900">Activity</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-brown-900/60 transition-transform ${
              expandedSection === 'activity' ? 'rotate-180' : ''
            }`} />
          </button>

          <AnimatePresence>
            {expandedSection === 'activity' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                  {engagementData.recentActivity.slice(0, 5).map((activity, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-xs font-montserrat text-brown-900/70 p-1.5 bg-cream-200 rounded"
                    >
                      {activity.icon === 'flame' && <Flame className="w-3 h-3 text-orange-600 flex-shrink-0" />}
                      {activity.icon === 'trophy' && <Trophy className="w-3 h-3 text-gold-600 flex-shrink-0" />}
                      {activity.icon === 'star' && <Star className="w-3 h-3 text-yellow-600 flex-shrink-0" />}
                      <span className="flex-1 truncate">{activity.message}</span>
                    </div>
                  ))}
                </div>
                {profile?.achievements?.length > 0 && (
                  <div className="mx-3 mb-3 pt-2 border-t border-gold-400/30">
                    <div className="flex items-center gap-1.5">
                      <Award className="w-3 h-3 text-gold-600" />
                      <span className="text-xs font-montserrat text-gold-600">
                        {profile.achievements.length} achievements
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Quick Links - Cream Card */}
      <div className="card-cream p-3 space-y-2">
        <h4 className="text-xs font-oswald font-semibold text-gold-600 uppercase tracking-wider mb-2">
          Quick Links
        </h4>
        <Link
          to="/scores"
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-cream-200 transition-colors text-brown-900 text-sm font-montserrat"
        >
          <Trophy className="w-4 h-4 text-gold-600" />
          Leaderboards
        </Link>
        <Link
          to="/staff"
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-cream-200 transition-colors text-brown-900 text-sm font-montserrat"
        >
          <Users className="w-4 h-4 text-purple-600" />
          Staff Market
        </Link>
        <Link
          to="/leagues"
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-cream-200 transition-colors text-brown-900 text-sm font-montserrat"
        >
          <Zap className="w-4 h-4 text-blue-600" />
          Leagues
        </Link>
      </div>
    </div>
  );
};

export default memo(DashboardSidebar);
