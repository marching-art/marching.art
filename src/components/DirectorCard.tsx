// =============================================================================
// DIRECTOR CARD - ESPN-style player progression card for dashboard
// =============================================================================
// Displays user's streak, level, XP progress, and CorpsCoin in a clean card
// Replaces header clutter with dashboard-integrated display

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, Zap, Coins, ChevronRight, Lock, Unlock,
  TrendingUp, Award, Star
} from 'lucide-react';
import { Link } from 'react-router-dom';

// =============================================================================
// TYPES
// =============================================================================

interface DirectorCardProps {
  displayName: string;
  xp: number;
  xpLevel: number;
  corpsCoin: number;
  streak: number;
  lastLogin?: string | null;
  unlockedClasses: string[];
  seasonName?: string;
  currentWeek?: number;
  compact?: boolean;
}

interface CurrencyGain {
  id: string;
  type: 'xp' | 'coin';
  amount: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const XP_PER_LEVEL = 1000;

const CLASS_UNLOCK_LEVELS = {
  aClass: 3,
  open: 5,
  world: 10,
};

const CLASS_UNLOCK_COSTS = {
  aClass: 1000,
  open: 2500,
  world: 5000,
};

const CLASS_NAMES: Record<string, string> = {
  aClass: 'A Class',
  open: 'Open Class',
  world: 'World Class',
};

// Streak tier configuration
const STREAK_TIERS = [
  { name: 'Starting', minDays: 0, color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
  { name: 'Building', minDays: 3, color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  { name: 'Hot', minDays: 7, color: 'text-orange-300', bgColor: 'bg-orange-500/30' },
  { name: 'Fire', minDays: 14, color: 'text-red-400', bgColor: 'bg-red-500/30' },
  { name: 'Inferno', minDays: 30, color: 'text-yellow-400', bgColor: 'bg-yellow-500/30' },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getXpProgress(xp: number, level: number): { current: number; max: number; percent: number } {
  const xpForCurrentLevel = (level - 1) * XP_PER_LEVEL;
  const xpInCurrentLevel = xp - xpForCurrentLevel;
  return {
    current: xpInCurrentLevel,
    max: XP_PER_LEVEL,
    percent: (xpInCurrentLevel / XP_PER_LEVEL) * 100,
  };
}

function getStreakTier(streak: number) {
  for (let i = STREAK_TIERS.length - 1; i >= 0; i--) {
    if (streak >= STREAK_TIERS[i].minDays) {
      return STREAK_TIERS[i];
    }
  }
  return STREAK_TIERS[0];
}

function getNextClassUnlock(
  unlockedClasses: string[],
  xpLevel: number,
  corpsCoin: number
): { className: string; classKey: string; levelRequired: number; coinCost: number; canUnlock: boolean } | null {
  const classOrder = ['aClass', 'open', 'world'];

  for (const classKey of classOrder) {
    if (!unlockedClasses.includes(classKey)) {
      const levelRequired = CLASS_UNLOCK_LEVELS[classKey as keyof typeof CLASS_UNLOCK_LEVELS];
      const coinCost = CLASS_UNLOCK_COSTS[classKey as keyof typeof CLASS_UNLOCK_COSTS];

      return {
        className: CLASS_NAMES[classKey],
        classKey,
        levelRequired,
        coinCost,
        canUnlock: xpLevel >= levelRequired && corpsCoin >= coinCost,
      };
    }
  }

  return null; // All classes unlocked
}

// =============================================================================
// COMPONENT
// =============================================================================

export const DirectorCard: React.FC<DirectorCardProps> = ({
  displayName,
  xp,
  xpLevel,
  corpsCoin,
  streak,
  lastLogin,
  unlockedClasses,
  seasonName,
  currentWeek,
  compact = false,
}) => {
  const [gains, setGains] = useState<CurrencyGain[]>([]);
  const prevXpRef = useRef(xp);
  const prevCoinRef = useRef(corpsCoin);

  const xpProgress = getXpProgress(xp, xpLevel);
  const streakTier = getStreakTier(streak);
  const nextUnlock = getNextClassUnlock(unlockedClasses, xpLevel, corpsCoin);

  // Animate currency gains
  useEffect(() => {
    const xpDiff = xp - prevXpRef.current;
    const coinDiff = corpsCoin - prevCoinRef.current;

    if (xpDiff > 0) {
      const gain: CurrencyGain = { id: `xp-${Date.now()}`, type: 'xp', amount: xpDiff };
      setGains((prev) => [...prev, gain]);
      setTimeout(() => {
        setGains((prev) => prev.filter((g) => g.id !== gain.id));
      }, 2000);
    }

    if (coinDiff > 0) {
      const gain: CurrencyGain = { id: `coin-${Date.now()}`, type: 'coin', amount: coinDiff };
      setGains((prev) => [...prev, gain]);
      setTimeout(() => {
        setGains((prev) => prev.filter((g) => g.id !== gain.id));
      }, 2000);
    }

    prevXpRef.current = xp;
    prevCoinRef.current = corpsCoin;
  }, [xp, corpsCoin]);

  // Compact version for mobile - single horizontal row
  if (compact) {
    return (
      <div className="bg-[#1a1a1a] border-b border-[#333] px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          {/* Streak */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${streakTier.bgColor}`}>
            <Flame className={`w-4 h-4 ${streakTier.color}`} />
            <span className={`text-sm font-bold tabular-nums ${streakTier.color}`}>
              {streak}
            </span>
          </div>

          {/* Level + XP Progress */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-bold text-blue-400">Lvl {xpLevel}</span>
            </div>
            <div className="flex-1 h-1.5 bg-[#333] rounded-full overflow-hidden max-w-[80px]">
              <motion.div
                className="h-full bg-blue-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress.percent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* CorpsCoin */}
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-bold text-yellow-500 tabular-nums">
              {corpsCoin >= 1000 ? `${(corpsCoin / 1000).toFixed(1)}k` : corpsCoin}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Full card version for desktop dashboard
  return (
    <div className="bg-gradient-to-r from-[#1a1a1a] to-[#222] border border-[#333] rounded-lg overflow-hidden">
      {/* Header bar with season context */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-b border-[#333]">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-yellow-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Director Status
          </span>
        </div>
        {seasonName && (
          <span className="text-xs text-gray-500">
            {seasonName} {currentWeek ? `• Week ${currentWeek}` : ''}
          </span>
        )}
      </div>

      {/* Main stats row */}
      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Streak */}
          <div className="flex items-center gap-3">
            <motion.div
              className={`relative flex items-center justify-center w-12 h-12 rounded-xl ${streakTier.bgColor}`}
              animate={streak >= 7 ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Flame className={`w-6 h-6 ${streakTier.color}`} />
              {streak >= 14 && (
                <motion.div
                  className="absolute inset-0 rounded-xl"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{
                    background: streak >= 30
                      ? 'radial-gradient(circle, rgba(234,179,8,0.3) 0%, transparent 70%)'
                      : 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, transparent 70%)'
                  }}
                />
              )}
            </motion.div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold tabular-nums ${streakTier.color}`}>
                  {streak}
                </span>
                <span className="text-xs text-gray-500">day streak</span>
              </div>
              <span className={`text-xs font-medium uppercase tracking-wider ${streakTier.color}`}>
                {streakTier.name}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-10 bg-[#333]" />

          {/* Center: Level & XP */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-blue-400" />
              <span className="text-lg font-bold text-blue-400">Level {xpLevel}</span>

              {/* XP gain animation */}
              <AnimatePresence>
                {gains.filter((g) => g.type === 'xp').map((gain) => (
                  <motion.span
                    key={gain.id}
                    className="text-sm font-bold text-blue-300 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: [0, 1, 1, 0], y: -20 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2, times: [0, 0.1, 0.7, 1] }}
                  >
                    +{gain.amount} XP
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-[#333] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress.percent}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-xs text-gray-500 tabular-nums">
                {xpProgress.current}/{xpProgress.max}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-10 bg-[#333]" />

          {/* Right: CorpsCoin */}
          <div className="relative">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              <span className="text-lg font-bold text-yellow-500 tabular-nums">
                {corpsCoin.toLocaleString()}
              </span>

              {/* Coin gain animation */}
              <AnimatePresence>
                {gains.filter((g) => g.type === 'coin').map((gain) => (
                  <motion.span
                    key={gain.id}
                    className="absolute -top-4 right-0 text-sm font-bold text-yellow-300 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: [0, 1, 1, 0], y: -20 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2, times: [0, 0.1, 0.7, 1] }}
                  >
                    +{gain.amount}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
            <span className="text-xs text-gray-500">CorpsCoin</span>
          </div>
        </div>

        {/* Next unlock progress (if applicable) */}
        {nextUnlock && (
          <div className="mt-4 pt-3 border-t border-[#333]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {nextUnlock.canUnlock ? (
                  <Unlock className="w-4 h-4 text-green-400" />
                ) : (
                  <Lock className="w-4 h-4 text-gray-500" />
                )}
                <span className="text-sm text-gray-400">
                  Next: <span className={nextUnlock.canUnlock ? 'text-green-400 font-medium' : 'text-white font-medium'}>{nextUnlock.className}</span>
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className={xpLevel >= nextUnlock.levelRequired ? 'text-green-400' : 'text-gray-500'}>
                  Lvl {nextUnlock.levelRequired}
                </span>
                <span className={corpsCoin >= nextUnlock.coinCost ? 'text-green-400' : 'text-gray-500'}>
                  {nextUnlock.coinCost.toLocaleString()} CC
                </span>
                {nextUnlock.canUnlock && (
                  <Link
                    to="/profile"
                    className="flex items-center gap-1 text-yellow-500 hover:text-yellow-400 font-medium"
                  >
                    Unlock <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* All classes unlocked state */}
        {!nextUnlock && unlockedClasses.length >= 4 && (
          <div className="mt-4 pt-3 border-t border-[#333]">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-yellow-400 font-medium">All Classes Unlocked!</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectorCard;
