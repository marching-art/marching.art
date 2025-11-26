// src/components/Dashboard/DashboardSidebar.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Trophy, Wrench, Calendar, Star,
  ChevronDown, Check, Sparkles,
  Flame, Award, Crown, Gift, Activity
} from 'lucide-react';

/**
 * Sidebar component for desktop that displays challenges, weekly progress,
 * and quick links in a compact, always-visible format.
 */
const DashboardSidebar = ({
  dailyChallenges,
  weeklyProgress,
  engagementData,
  profile,
  activeCorps,
  activeCorpsClass,
  currentWeek,
  unclaimedRewardsCount,
  onTabChange,
  completeDailyChallenge
}) => {
  const [expandedSection, setExpandedSection] = useState('challenges');

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getIcon = (iconName) => {
    const icons = {
      target: Target,
      trophy: Trophy,
      wrench: Wrench,
      users: Users,
      calendar: Calendar,
      star: Star,
      flame: Flame
    };
    return icons[iconName] || Target;
  };

  const completedChallenges = dailyChallenges.filter(c => c.completed).length;
  const allChallengesComplete = dailyChallenges.every(c => c.completed);

  return (
    <div className="space-y-3">
      {/* Battle Pass Notification (Compact) */}
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

      {/* Daily Challenges */}
      {dailyChallenges.length > 0 && (
        <div className="glass rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('challenges')}
            className="w-full p-3 flex items-center justify-between hover:bg-cream-500/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-cream-100">Daily Challenges</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                allChallengesComplete
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-cream-500/10 text-cream-500/60'
              }`}>
                {completedChallenges}/{dailyChallenges.length}
              </span>
              <ChevronDown className={`w-4 h-4 text-cream-500/60 transition-transform ${
                expandedSection === 'challenges' ? 'rotate-180' : ''
              }`} />
            </div>
          </button>

          <AnimatePresence>
            {expandedSection === 'challenges' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 space-y-2">
                  {dailyChallenges.map((challenge) => {
                    const Icon = getIcon(challenge.icon);
                    const progressPercent = (challenge.progress / challenge.target) * 100;

                    return (
                      <div
                        key={challenge.id}
                        onClick={() => {
                          if (challenge.id === 'maintain_equipment') {
                            onTabChange('equipment');
                            completeDailyChallenge('maintain_equipment');
                          } else if (challenge.id === 'staff_meeting') {
                            onTabChange('staff');
                            completeDailyChallenge('staff_meeting');
                          } else if (challenge.action && !challenge.completed) {
                            challenge.action();
                          }
                        }}
                        className={`p-2 rounded-lg border transition-all cursor-pointer ${
                          challenge.completed
                            ? 'bg-green-500/10 border-green-500/20'
                            : 'bg-charcoal-900/30 border-cream-500/10 hover:border-cream-500/20'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded ${
                            challenge.completed ? 'bg-green-500/20' : 'bg-blue-500/20'
                          }`}>
                            <Icon className={`w-3 h-3 ${
                              challenge.completed ? 'text-green-400' : 'text-blue-400'
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-cream-100 truncate">
                                {challenge.title}
                              </span>
                              {challenge.completed && (
                                <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1 bg-charcoal-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    challenge.completed ? 'bg-green-500' : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-gold-500 font-medium">
                                {challenge.reward}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {allChallengesComplete && (
                    <div className="p-2 rounded-lg bg-gradient-to-r from-gold-500/20 to-yellow-500/20 border border-gold-500/30">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-gold-500" />
                        <span className="text-xs font-semibold text-gold-400">
                          All complete!
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Weekly Progress */}
      {activeCorps && activeCorpsClass !== 'soundSport' && (
        <div className="glass rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('weekly')}
            className="w-full p-3 flex items-center justify-between hover:bg-cream-500/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-cream-100">This Week</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-cream-500/60 transition-transform ${
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
                  {/* Rehearsals */}
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-1 mb-1">
                      <Target className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] text-cream-500/60">Rehearsals</span>
                    </div>
                    <p className="text-lg font-bold text-blue-400">
                      +{weeklyProgress.rehearsalsCompleted}
                    </p>
                  </div>

                  {/* Score Change */}
                  <div className="p-2 rounded-lg bg-gold-500/10 border border-gold-500/20">
                    <div className="flex items-center gap-1 mb-1">
                      <Star className="w-3 h-3 text-gold-400" />
                      <span className="text-[10px] text-cream-500/60">Score</span>
                    </div>
                    <p className={`text-lg font-bold ${
                      weeklyProgress.scoreImprovement > 0 ? 'text-green-400' :
                      weeklyProgress.scoreImprovement < 0 ? 'text-red-400' : 'text-cream-400'
                    }`}>
                      {weeklyProgress.scoreImprovement > 0 ? '+' : ''}{weeklyProgress.scoreImprovement.toFixed(1)}
                    </p>
                  </div>

                  {/* Rank Change */}
                  <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <div className="flex items-center gap-1 mb-1">
                      <Trophy className="w-3 h-3 text-purple-400" />
                      <span className="text-[10px] text-cream-500/60">Rank</span>
                    </div>
                    <p className={`text-lg font-bold ${
                      weeklyProgress.rankChange > 0 ? 'text-green-400' :
                      weeklyProgress.rankChange < 0 ? 'text-red-400' : 'text-cream-400'
                    }`}>
                      {weeklyProgress.rankChange > 0 ? '↑' : weeklyProgress.rankChange < 0 ? '↓' : '→'}
                      {Math.abs(weeklyProgress.rankChange)}
                    </p>
                  </div>

                  {/* Equipment */}
                  <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <div className="flex items-center gap-1 mb-1">
                      <Wrench className="w-3 h-3 text-orange-400" />
                      <span className="text-[10px] text-cream-500/60">Equipment</span>
                    </div>
                    <p className={`text-lg font-bold ${
                      weeklyProgress.equipmentMaintained >= 80 ? 'text-green-400' :
                      weeklyProgress.equipmentMaintained >= 60 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {weeklyProgress.equipmentMaintained.toFixed(0)}%
                    </p>
                  </div>
                </div>

                {/* Weekly Insight */}
                {(weeklyProgress.scoreImprovement > 0 || weeklyProgress.rankChange > 0) && (
                  <div className="mx-3 mb-3 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-green-400" />
                      <span className="text-xs text-green-400">
                        {weeklyProgress.rankChange > 0 ? 'Climbing ranks!' : 'Scores improving!'}
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Recent Activity (Compact) */}
      {engagementData.recentActivity?.length > 0 && (
        <div className="glass rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('activity')}
            className="w-full p-3 flex items-center justify-between hover:bg-cream-500/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-400" />
              <span className="text-sm font-semibold text-cream-100">Activity</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-cream-500/60 transition-transform ${
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
                      className="flex items-center gap-2 text-xs text-cream-500/70 p-1.5 bg-charcoal-900/30 rounded"
                    >
                      {activity.icon === 'flame' && <Flame className="w-3 h-3 text-orange-400 flex-shrink-0" />}
                      {activity.icon === 'trophy' && <Trophy className="w-3 h-3 text-gold-500 flex-shrink-0" />}
                      {activity.icon === 'star' && <Star className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
                      <span className="flex-1 truncate">{activity.message}</span>
                    </div>
                  ))}
                </div>
                {profile?.achievements?.length > 0 && (
                  <div className="mx-3 mb-3 pt-2 border-t border-cream-500/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Award className="w-3 h-3 text-gold-500" />
                        <span className="text-xs text-gold-400">
                          {profile.achievements.length} achievements
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

    </div>
  );
};

export default DashboardSidebar;
