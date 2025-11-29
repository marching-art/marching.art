// src/components/Dashboard/DashboardHeader.jsx
// Classic Prestige Theme - Cream cards with gold accents
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Zap, Coins, Calendar, Flame, Award, Trophy } from 'lucide-react';

/**
 * Classic Prestige Dashboard Header
 * Cream card with gold shadows, polished premium feel
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
      {/* Main Header Card - Classic Prestige Cream */}
      <div className="bg-cream-100 rounded-xl shadow-gold-deep border border-gold-400/40 p-5">
        {/* Main Header Row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Welcome + Season */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-oswald font-bold text-black uppercase tracking-wide truncate">
              Welcome back, {profile?.displayName || 'Director'}!
            </h1>
            <p className="text-black/60 text-sm mt-1">
              {formatSeasonName(seasonData?.name)}
            </p>
          </div>

          {/* Right: Quick Stats Grid - Cream sub-cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3">
            {/* XP */}
            <div className="bg-cream-200/70 border border-gold-400/30 rounded-lg p-2 sm:p-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-shrink-0">
                  <Zap className="w-5 h-5 text-gold-600" />
                  <span className="absolute -top-1 -right-1 text-[10px] font-bold text-gold-600">
                    {profile?.xpLevel || 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-black/50">Lvl {profile?.xpLevel || 1}</span>
                    <span className="text-xs font-semibold text-gold-600">{profile?.xp || 0}</span>
                  </div>
                  <div className="h-1 bg-cream-300 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="h-full bg-gradient-gold transition-all duration-500"
                      style={{ width: `${xpProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CorpsCoin */}
            <div className="bg-cream-200/70 border border-gold-400/30 rounded-lg p-2 sm:p-3">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-gold-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-black/50">Coins</p>
                  <p className="text-sm font-bold text-gold-600 truncate">
                    {(profile?.corpsCoin || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Login Streak */}
            {engagementData.loginStreak > 0 && (
              <div className="bg-cream-200/70 border border-gold-400/30 rounded-lg p-2 sm:p-3">
                <div className="flex items-center gap-2">
                  <Flame className={`w-5 h-5 ${
                    engagementData.loginStreak >= 7 ? 'text-orange-500 animate-pulse' : 'text-orange-600'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-black/50">Streak</p>
                    <p className="text-sm font-bold text-orange-600">
                      {engagementData.loginStreak}d
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Week / Remaining */}
            <div className="bg-cream-200/70 border border-gold-400/30 rounded-lg p-2 sm:p-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-black/50">Week {currentWeek}</p>
                  <p className="text-sm font-bold text-purple-600">
                    {weeksRemaining ? `${weeksRemaining}w left` : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Corps Quick Info (Desktop) - Shows active corps stats inline */}
        {activeCorps && (
          <div className="hidden lg:flex items-center gap-4 mt-4 pt-4 border-t border-gold-400/20">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-black/50">Active:</span>
              <span className="font-semibold text-black">
                {activeCorps.corpsName || activeCorps.name}
              </span>
            </div>
            {activeCorpsClass !== 'soundSport' && (
              <>
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-gold-600" />
                  <span className="text-sm text-black/70">
                    #{activeCorps.rank || '-'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-gold-600" />
                  <span className="text-sm text-black/70">
                    {activeCorps.totalSeasonScore?.toFixed(2) || '0.00'} pts
                  </span>
                </div>
              </>
            )}
            {profile?.achievements?.length > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <Award className="w-4 h-4 text-gold-600" />
                <span className="text-sm text-gold-700 font-medium">
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

export default memo(DashboardHeader);
