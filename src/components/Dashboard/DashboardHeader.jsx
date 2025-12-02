// src/components/Dashboard/DashboardHeader.jsx
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Zap, Coins, Calendar, Flame } from 'lucide-react';

/**
 * Streamlined dashboard header - shows user identity and key stats
 * Corps-specific info is now in CommandCenter to avoid redundancy
 */
const DashboardHeader = ({
  profile,
  seasonData,
  formatSeasonName,
  weeksRemaining,
  currentWeek,
  engagementData
}) => {
  const xpProgress = ((profile?.xp || 0) % 1000) / 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Welcome Message */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-display font-bold text-gradient truncate">
            Welcome back, {profile?.displayName || 'Director'}!
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-cream-400 text-sm">
              {formatSeasonName(seasonData?.name)}
            </span>
            {weeksRemaining && (
              <span className="flex items-center gap-1 text-xs text-purple-400">
                <Calendar className="w-3 h-3" />
                Week {currentWeek} • {weeksRemaining}w left
              </span>
            )}
          </div>
        </div>

        {/* Compact Stats Row */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Login Streak */}
          {engagementData?.loginStreak > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <Flame className={`w-4 h-4 ${
                engagementData.loginStreak >= 7 ? 'text-orange-400 animate-pulse' : 'text-orange-500'
              }`} />
              <span className="text-sm font-bold text-orange-400">
                {engagementData.loginStreak}d
              </span>
            </div>
          )}

          {/* XP Level */}
          <Link
            to="/profile"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gold-500/10 border border-gold-500/20 hover:border-gold-500/40 transition-colors"
          >
            <div className="relative">
              <Zap className="w-4 h-4 text-gold-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-gold-500">Lvl {profile?.xpLevel || 1}</span>
              <div className="w-12 h-1 bg-charcoal-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold-500 transition-all duration-500"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
            </div>
          </Link>

          {/* CorpsCoin */}
          <Link
            to="/staff"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gold-500/10 border border-gold-500/20 hover:border-gold-500/40 transition-colors"
          >
            <Coins className="w-4 h-4 text-gold-500" />
            <span className="text-sm font-bold text-gold-500">
              {(profile?.corpsCoin || 0).toLocaleString()}
            </span>
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default memo(DashboardHeader);
