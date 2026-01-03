// =============================================================================
// DIRECTOR CARD - ESPN-style player progression display for dashboard
// =============================================================================
// Displays user's streak, level, XP progress, and CorpsCoin
// Matches site's data-terminal aesthetic: no rounded corners, tight spacing

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Zap, Coins, Lock, Unlock } from 'lucide-react';

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
  { name: 'STARTING', minDays: 0, color: 'text-gray-400' },
  { name: 'BUILDING', minDays: 3, color: 'text-orange-400' },
  { name: 'HOT', minDays: 7, color: 'text-orange-300' },
  { name: 'FIRE', minDays: 14, color: 'text-red-400' },
  { name: 'INFERNO', minDays: 30, color: 'text-yellow-400' },
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

  return null;
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
          <div className="flex items-center gap-1.5">
            <Flame className={`w-4 h-4 ${streakTier.color}`} />
            <span className={`text-sm font-bold tabular-nums ${streakTier.color}`}>
              {streak}
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-[#333]" />

          {/* Level + XP Progress */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-bold text-blue-400">Lvl {xpLevel}</span>
            </div>
            <div className="flex-1 h-1 bg-[#333] overflow-hidden max-w-[60px]">
              <motion.div
                className="h-full bg-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress.percent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-[#333]" />

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

  // Full version for desktop dashboard - horizontal stats bar
  return (
    <div className="bg-[#1a1a1a] border border-[#333]">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#222] border-b border-[#333]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          Director Status
        </span>
        {seasonName && (
          <span className="text-[10px] text-gray-500">
            {seasonName} {currentWeek ? `• Week ${currentWeek}` : ''}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-6 px-4 py-3">
        {/* Streak */}
        <div className="flex items-center gap-3">
          <Flame className={`w-5 h-5 ${streakTier.color}`} />
          <div>
            <div className="flex items-baseline gap-1">
              <span className={`text-xl font-bold font-data tabular-nums ${streakTier.color}`}>
                {streak}
              </span>
              <span className="text-[10px] text-gray-500">day streak</span>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${streakTier.color}`}>
              {streakTier.name}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-[#333]" />

        {/* Level & XP */}
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-blue-400" />
          <div className="relative">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-blue-400">Level {xpLevel}</span>
              {/* XP gain animation */}
              <AnimatePresence>
                {gains.filter((g) => g.type === 'xp').map((gain) => (
                  <motion.span
                    key={gain.id}
                    className="text-xs font-bold text-blue-300"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: [0, 1, 1, 0], y: -10 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, times: [0, 0.1, 0.7, 1] }}
                  >
                    +{gain.amount} XP
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-24 h-1 bg-[#333] overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress.percent}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-[10px] text-gray-500 tabular-nums font-data">
                {xpProgress.current}/{xpProgress.max}
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-[#333]" />

        {/* CorpsCoin */}
        <div className="flex items-center gap-3 relative">
          <Coins className="w-5 h-5 text-yellow-500" />
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-yellow-500 tabular-nums font-data">
                {corpsCoin.toLocaleString()}
              </span>
              {/* Coin gain animation */}
              <AnimatePresence>
                {gains.filter((g) => g.type === 'coin').map((gain) => (
                  <motion.span
                    key={gain.id}
                    className="text-xs font-bold text-yellow-300"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: [0, 1, 1, 0], y: -10 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, times: [0, 0.1, 0.7, 1] }}
                  >
                    +{gain.amount}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
            <span className="text-[10px] text-gray-500">CorpsCoin</span>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Next unlock (right aligned) */}
        {nextUnlock && (
          <div className="flex items-center gap-3 pl-4 border-l border-[#333]">
            {nextUnlock.canUnlock ? (
              <Unlock className="w-4 h-4 text-green-400" />
            ) : (
              <Lock className="w-4 h-4 text-gray-500" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Next:</span>
                <span className={`text-xs font-bold ${nextUnlock.canUnlock ? 'text-green-400' : 'text-white'}`}>
                  {nextUnlock.className}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className={xpLevel >= nextUnlock.levelRequired ? 'text-green-400' : 'text-gray-500'}>
                  Lvl {nextUnlock.levelRequired}
                </span>
                <span className={corpsCoin >= nextUnlock.coinCost ? 'text-green-400' : 'text-gray-500'}>
                  {nextUnlock.coinCost.toLocaleString()} CC
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectorCard;
