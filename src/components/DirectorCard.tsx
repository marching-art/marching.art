// =============================================================================
// DIRECTOR CARD - ESPN-style player progression display for dashboard
// =============================================================================
// Displays user's streak, level, XP progress, and CorpsCoin
// Matches site's data-terminal aesthetic: no rounded corners, tight spacing

import React, { useState, useEffect, useRef, memo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Flame, Zap, Coins, Lock, Unlock, Clock } from 'lucide-react';
import { getWeeksUntilUnlock } from '../utils/classUnlockTime';
import type { Timestamp } from 'firebase/firestore';

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
  createdAt?: Timestamp | Date | string | null;
  seasonName?: string;
  currentWeek?: number;
  compact?: boolean;
  onUnlockClass?: (classKey: string) => void;
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

interface NextClassUnlock {
  className: string;
  classKey: string;
  levelRequired: number;
  coinCost: number;
  meetsLevel: boolean;
  canAfford: boolean;
  canUnlock: boolean; // meetsLevel && canAfford
  weeksUntil: number | null; // weeks until time-based auto-unlock
}

function getNextClassUnlock(
  unlockedClasses: string[],
  xpLevel: number,
  corpsCoin: number,
  createdAt?: Timestamp | Date | string | null
): NextClassUnlock | null {
  const classOrder = ['aClass', 'open', 'world'];

  for (const classKey of classOrder) {
    if (!unlockedClasses.includes(classKey)) {
      const levelRequired = CLASS_UNLOCK_LEVELS[classKey as keyof typeof CLASS_UNLOCK_LEVELS];
      const coinCost = CLASS_UNLOCK_COSTS[classKey as keyof typeof CLASS_UNLOCK_COSTS];
      const meetsLevel = xpLevel >= levelRequired;
      const canAfford = corpsCoin >= coinCost;
      const weeksUntil = createdAt ? getWeeksUntilUnlock(createdAt, classKey) : null;

      return {
        className: CLASS_NAMES[classKey],
        classKey,
        levelRequired,
        coinCost,
        meetsLevel,
        canAfford,
        canUnlock: meetsLevel && canAfford,
        weeksUntil,
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
  createdAt,
  seasonName,
  currentWeek,
  compact = false,
  onUnlockClass,
}) => {
  const [gains, setGains] = useState<CurrencyGain[]>([]);
  const prevXpRef = useRef(xp);
  const prevCoinRef = useRef(corpsCoin);

  const xpProgress = getXpProgress(xp, xpLevel);
  const streakTier = getStreakTier(streak);
  const nextUnlock = getNextClassUnlock(unlockedClasses, xpLevel, corpsCoin, createdAt);

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
              <m.div
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

          {/* Buy button for mobile - show when user can afford */}
          {nextUnlock && nextUnlock.canAfford && onUnlockClass && (
            <>
              <div className="w-px h-4 bg-[#333]" />
              <button
                onClick={() => onUnlockClass(nextUnlock.classKey)}
                className={`h-7 px-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors ${
                  nextUnlock.meetsLevel
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                }`}
              >
                <Coins className="w-3 h-3" />
                {nextUnlock.meetsLevel ? 'Unlock' : 'Buy'}
              </button>
            </>
          )}
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
                  <m.span
                    key={gain.id}
                    className="text-xs font-bold text-blue-300"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: [0, 1, 1, 0], y: -10 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, times: [0, 0.1, 0.7, 1] }}
                  >
                    +{gain.amount} XP
                  </m.span>
                ))}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-24 h-1 bg-[#333] overflow-hidden">
                <m.div
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
                  <m.span
                    key={gain.id}
                    className="text-xs font-bold text-yellow-300"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: [0, 1, 1, 0], y: -10 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, times: [0, 0.1, 0.7, 1] }}
                  >
                    +{gain.amount}
                  </m.span>
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
            ) : nextUnlock.canAfford ? (
              <Coins className="w-4 h-4 text-yellow-500" />
            ) : (
              <Lock className="w-4 h-4 text-gray-500" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Next:</span>
                <span className={`text-xs font-bold ${nextUnlock.canUnlock ? 'text-green-400' : nextUnlock.canAfford ? 'text-yellow-400' : 'text-white'}`}>
                  {nextUnlock.className}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className={nextUnlock.meetsLevel ? 'text-green-400' : 'text-gray-500'}>
                  Lvl {nextUnlock.levelRequired}
                </span>
                <span className={nextUnlock.canAfford ? 'text-green-400' : 'text-gray-500'}>
                  {nextUnlock.coinCost.toLocaleString()} CC
                </span>
                {nextUnlock.weeksUntil != null && nextUnlock.weeksUntil > 0 && (
                  <span className="text-cyan-400 flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {nextUnlock.weeksUntil}w
                  </span>
                )}
                {nextUnlock.weeksUntil === 0 && (
                  <span className="text-green-400">Auto</span>
                )}
              </div>
            </div>
            {/* Buy button - show when user can afford but hasn't unlocked yet */}
            {nextUnlock.canAfford && onUnlockClass && (
              <button
                onClick={() => onUnlockClass(nextUnlock.classKey)}
                className={`ml-2 h-7 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                  nextUnlock.meetsLevel
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                }`}
              >
                <Coins className="w-3 h-3" />
                {nextUnlock.meetsLevel ? 'Unlock' : 'Buy'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// OPTIMIZATION #6: Wrap with React.memo to prevent unnecessary re-renders
// when parent component state changes but props haven't changed
export default memo(DirectorCard);
