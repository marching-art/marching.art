// src/components/Dashboard/DashboardHeader.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Coins, Calendar, Flame, Award, Trophy } from 'lucide-react';

/**
 * Compact dashboard header that displays user info, XP, CorpsCoin,
 * and key stats in a space-efficient layout.
 */
const DashboardHeader = ({
  profile,
  seasonData,
  formatSeasonName,
  weeksRemaining,
  currentWeek,
  engagementData,
  activeCorps,
  activeCorpsClass
}) => {
  const xpProgress = ((profile?.xp || 0) % 1000) / 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-gold-500/10 to-cream-500/10 rounded-2xl" />
      <div className="relative p-4 glass rounded-2xl">
        {/* Main Header Row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Welcome + Season */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-bold text-gradient truncate">
              Welcome back, {profile?.displayName || 'Director'}!
            </h1>
            <p className="text-cream-300 text-sm">
              {formatSeasonName(seasonData?.name)}
            </p>
          </div>

          {/* Right: Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3">
            {/* XP */}
            <div className="glass-dark rounded-lg p-2 sm:p-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-shrink-0">
                  <Zap className="w-5 h-5 text-gold-500" />
                  <span className="absolute -top-1 -right-1 text-[10px] font-bold text-gold-500">
                    {profile?.xpLevel || 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-cream-500/60">Lvl {profile?.xpLevel || 1}</span>
                    <span className="text-xs font-semibold text-gold-500">{profile?.xp || 0}</span>
                  </div>
                  <div className="h-1 bg-charcoal-800 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="h-full bg-gradient-gold transition-all duration-500"
                      style={{ width: `${xpProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CorpsCoin */}
            <div className="glass-dark rounded-lg p-2 sm:p-3">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-gold-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-cream-500/60">Coins</p>
                  <p className="text-sm font-bold text-gold-500 truncate">
                    {(profile?.corpsCoin || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Login Streak */}
            {engagementData.loginStreak > 0 && (
              <div className="glass-dark rounded-lg p-2 sm:p-3">
                <div className="flex items-center gap-2">
                  <Flame className={`w-5 h-5 ${
                    engagementData.loginStreak >= 7 ? 'text-orange-400 animate-pulse' : 'text-orange-500'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-cream-500/60">Streak</p>
                    <p className="text-sm font-bold text-orange-400">
                      {engagementData.loginStreak}d
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Week / Remaining */}
            <div className="glass-dark rounded-lg p-2 sm:p-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-cream-500/60">Week {currentWeek}</p>
                  <p className="text-sm font-bold text-purple-400">
                    {weeksRemaining ? `${weeksRemaining}w left` : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Corps Quick Info (Desktop) - Shows active corps stats inline */}
        {activeCorps && (
          <div className="hidden lg:flex items-center gap-4 mt-3 pt-3 border-t border-cream-500/10">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-cream-500/60">Active:</span>
              <span className="font-semibold text-cream-100">
                {activeCorps.corpsName || activeCorps.name}
              </span>
            </div>
            {activeCorpsClass !== 'soundSport' && (
              <>
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-gold-500" />
                  <span className="text-sm text-cream-300">
                    #{activeCorps.rank || '-'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-gold-500" />
                  <span className="text-sm text-cream-300">
                    {activeCorps.totalSeasonScore?.toFixed(2) || '0.00'} pts
                  </span>
                </div>
              </>
            )}
            {profile?.achievements?.length > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <Award className="w-4 h-4 text-gold-500" />
                <span className="text-sm text-gold-400">
                  {profile.achievements.length} achievements
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default DashboardHeader;
