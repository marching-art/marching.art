// =============================================================================
// RESOURCE HEADER - Global HUD Top Bar
// =============================================================================
// Slim, sticky header displaying critical resources at a glance.
// Data-dense "sports ticker" aesthetic with real-time values.
//
// Data Props (from Phase 1 Audit):
// - Corps Name: activeCorps.corpsName || activeCorps.name
// - Funds: profile.corpsCoin
// - XP: profile.xp, profile.xpLevel
// - Season: seasonData.seasonNumber
// - Week: currentWeek (from useSeasonStore)
// - Day: currentDay (from useSeasonStore)

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Coins,
  Zap,
  Calendar,
  Flame,
  Trophy,
  ChevronDown,
  Settings,
} from 'lucide-react';
import BrandLogo from '../BrandLogo';

// =============================================================================
// STAT CELL - Compact data display unit
// =============================================================================

const StatCell = ({ icon: Icon, value, label, href, color = 'gold', pulse = false }) => {
  const colorClasses = {
    gold: 'text-gold-400 border-gold-500/20 bg-gold-500/10 hover:bg-gold-500/15',
    blue: 'text-blue-400 border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/15',
    green: 'text-green-400 border-green-500/20 bg-green-500/10 hover:bg-green-500/15',
    orange: 'text-orange-400 border-orange-500/20 bg-orange-500/10 hover:bg-orange-500/15',
    purple: 'text-purple-400 border-purple-500/20 bg-purple-500/10 hover:bg-purple-500/15',
  };

  const Content = (
    <div className={`
      flex items-center gap-1.5 px-2 py-1 rounded border
      transition-colors duration-150
      ${colorClasses[color]}
      ${pulse ? 'animate-pulse' : ''}
    `}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="text-xs font-data font-bold tracking-tight">{value}</span>
      {label && (
        <span className="text-[9px] text-cream/40 uppercase tracking-wide hidden sm:inline">
          {label}
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="shrink-0">
        {Content}
      </Link>
    );
  }

  return <div className="shrink-0">{Content}</div>;
};

// =============================================================================
// XP PROGRESS CELL - Level with mini progress bar
// =============================================================================

const XPCell = ({ xp = 0, xpLevel = 1 }) => {
  // XP thresholds from Phase 1 audit
  const XP_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];

  const currentThreshold = XP_THRESHOLDS[xpLevel - 1] || 0;
  const nextThreshold = XP_THRESHOLDS[xpLevel] || (currentThreshold + 1000);
  const xpInLevel = xp - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  const progress = Math.min((xpInLevel / xpNeeded) * 100, 100);

  return (
    <Link
      to="/profile"
      className="flex items-center gap-2 px-2 py-1 rounded border
        text-gold-400 border-gold-500/20 bg-gold-500/10 hover:bg-gold-500/15
        transition-colors duration-150 shrink-0"
    >
      <Zap className="w-3.5 h-3.5" />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-data font-bold tracking-tight">
          L{xpLevel}
        </span>
        <div className="w-10 h-1 bg-charcoal-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gold-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>
    </Link>
  );
};

// =============================================================================
// SEASON TICKER - Week/Day counter
// =============================================================================

const SeasonTicker = ({ seasonNumber, currentWeek, currentDay, weeksRemaining }) => {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded border
      text-purple-400 border-purple-500/20 bg-purple-500/10 shrink-0">
      <Calendar className="w-3.5 h-3.5" />
      <div className="flex items-center gap-1 text-xs font-data">
        <span className="font-bold">S{seasonNumber || 1}</span>
        <span className="text-cream/30">|</span>
        <span className="font-bold">W{currentWeek || 1}</span>
        <span className="text-cream/30">/</span>
        <span className="text-cream/50">D{currentDay || 1}</span>
      </div>
      {weeksRemaining && (
        <span className="text-[9px] text-purple-300/60 hidden lg:inline">
          {weeksRemaining}w left
        </span>
      )}
    </div>
  );
};

// =============================================================================
// CORPS SELECTOR - Active corps dropdown trigger
// =============================================================================

const CorpsSelector = ({
  corpsName,
  corpsClass,
  rank,
  hasMultipleCorps,
  onCorpsSwitch
}) => {
  const classColors = {
    worldClass: 'bg-gold-500/20 text-gold-400 border-gold-500/30',
    openClass: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    aClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    soundSport: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  const classAbbrev = {
    worldClass: 'WC',
    openClass: 'OC',
    aClass: 'AC',
    soundSport: 'SS',
  };

  return (
    <button
      onClick={hasMultipleCorps ? onCorpsSwitch : undefined}
      className={`
        flex items-center gap-2 px-2.5 py-1.5 rounded-lg border
        bg-surface-secondary/50 border-white/10
        ${hasMultipleCorps ? 'hover:bg-surface-tertiary cursor-pointer' : 'cursor-default'}
        transition-colors duration-150
      `}
    >
      {/* Class Badge */}
      <span className={`
        px-1.5 py-0.5 rounded text-[9px] font-display font-bold uppercase tracking-wider border
        ${classColors[corpsClass] || classColors.soundSport}
      `}>
        {classAbbrev[corpsClass] || 'SS'}
      </span>

      {/* Corps Name */}
      <span className="text-sm font-display font-bold text-cream truncate max-w-[120px] sm:max-w-[180px]">
        {corpsName || 'UNNAMED'}
      </span>

      {/* Rank Badge (Top 10 only) */}
      {rank && rank <= 10 && (
        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gold-500/20 text-gold-400 text-[9px] font-bold">
          <Trophy className="w-2.5 h-2.5" />
          #{rank}
        </span>
      )}

      {/* Dropdown Indicator */}
      {hasMultipleCorps && (
        <ChevronDown className="w-3.5 h-3.5 text-cream/40" />
      )}
    </button>
  );
};

// =============================================================================
// RESOURCE HEADER COMPONENT
// =============================================================================

/**
 * ResourceHeader - Global sticky HUD header
 *
 * @param {Object} profile - User profile with corpsCoin, xp, xpLevel
 * @param {Object} activeCorps - Current active corps data
 * @param {string} activeCorpsClass - Current corps class key
 * @param {boolean} hasMultipleCorps - Whether user has multiple corps
 * @param {Object} seasonData - Season data with seasonNumber
 * @param {number} currentWeek - Current week (1-7)
 * @param {number} currentDay - Current day (1-49)
 * @param {number} weeksRemaining - Weeks remaining in season
 * @param {Object} engagementData - Login streak data
 * @param {Function} onCorpsSwitch - Handler for corps switching
 */
const ResourceHeader = ({
  profile,
  activeCorps,
  activeCorpsClass,
  hasMultipleCorps = false,
  seasonData,
  currentWeek,
  currentDay,
  weeksRemaining,
  engagementData,
  onCorpsSwitch,
}) => {
  return (
    <header className="
      sticky top-0 z-50
      w-full h-12
      bg-surface/95 backdrop-blur-md
      border-b border-white/10
      shadow-lg shadow-black/20
    ">
      <div className="h-full px-3 flex items-center justify-between gap-3">
        {/* Left Section: Logo + Corps */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Brand Mark */}
          <Link to="/" className="shrink-0 hidden sm:block">
            <BrandLogo className="w-7 h-7" color="text-gold-400" />
          </Link>

          {/* Divider */}
          <div className="hidden sm:block w-px h-6 bg-white/10" />

          {/* Corps Selector */}
          {activeCorps ? (
            <CorpsSelector
              corpsName={activeCorps.corpsName || activeCorps.name}
              corpsClass={activeCorpsClass}
              rank={activeCorps.rank}
              hasMultipleCorps={hasMultipleCorps}
              onCorpsSwitch={onCorpsSwitch}
            />
          ) : (
            <span className="text-sm text-cream/50 italic">No Corps</span>
          )}
        </div>

        {/* Center Section: Season Ticker (hidden on mobile) */}
        <div className="hidden md:flex items-center">
          <SeasonTicker
            seasonNumber={seasonData?.seasonNumber}
            currentWeek={currentWeek}
            currentDay={currentDay}
            weeksRemaining={weeksRemaining}
          />
        </div>

        {/* Right Section: Resources */}
        <div className="flex items-center gap-1.5">
          {/* Login Streak */}
          {engagementData?.loginStreak > 0 && (
            <StatCell
              icon={Flame}
              value={`${engagementData.loginStreak}d`}
              color="orange"
              pulse={engagementData.loginStreak >= 7}
            />
          )}

          {/* XP Level */}
          <XPCell
            xp={profile?.xp || 0}
            xpLevel={profile?.xpLevel || 1}
          />

          {/* CorpsCoin */}
          <StatCell
            icon={Coins}
            value={(profile?.corpsCoin || 0).toLocaleString()}
            href="/staff"
            color="gold"
          />

          {/* Profile/Settings (compact) */}
          <Link
            to="/profile"
            className="p-1.5 rounded text-cream/40 hover:text-cream hover:bg-white/5 transition-colors hidden lg:block"
            title="Profile & Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
};

export default memo(ResourceHeader);
