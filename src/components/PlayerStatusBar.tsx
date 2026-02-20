// =============================================================================
// PLAYER STATUS BAR - Persistent XP, CorpsCoin, and Streak display
// =============================================================================
// Shows player's progression currencies and streak in header area

import React, { useState, useEffect, useRef } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { TrendingUp, Coins, Flame, ChevronRight, Lock, Unlock, Clock } from 'lucide-react';
import { StreakIndicator } from './StreakIndicator';
import { getWeeksUntilUnlock } from '../utils/classUnlockTime';
import type { Timestamp } from 'firebase/firestore';

// =============================================================================
// TYPES
// =============================================================================

interface PlayerStatusBarProps {
  xp: number;
  xpLevel: number;
  corpsCoin: number;
  streak: number;
  lastLogin?: string | null;
  unlockedClasses: string[];
  createdAt?: Timestamp | Date | string | null;
  onXpClick?: () => void;
  onCoinClick?: () => void;
  onStreakClick?: () => void;
}

interface CurrencyGain {
  id: string;
  type: 'xp' | 'coin';
  amount: number;
}

// =============================================================================
// XP CONFIGURATION
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

function getNextClassUnlock(
  unlockedClasses: string[],
  xp: number,
  corpsCoin: number,
  createdAt?: Timestamp | Date | string | null
): { className: string; xpRequired: number; xpProgress: number; coinCost: number; canAfford: boolean; weeksUntil: number | null } | null {
  const classOrder = ['aClass', 'open', 'world'];

  for (const classKey of classOrder) {
    if (!unlockedClasses.includes(classKey)) {
      const levelRequired = CLASS_UNLOCK_LEVELS[classKey as keyof typeof CLASS_UNLOCK_LEVELS];
      const xpRequired = levelRequired * XP_PER_LEVEL;
      const coinCost = CLASS_UNLOCK_COSTS[classKey as keyof typeof CLASS_UNLOCK_COSTS];
      const weeksUntil = createdAt ? getWeeksUntilUnlock(createdAt, classKey) : null;

      return {
        className: CLASS_NAMES[classKey],
        xpRequired,
        xpProgress: Math.min((xp / xpRequired) * 100, 100),
        coinCost,
        canAfford: corpsCoin >= coinCost,
        weeksUntil,
      };
    }
  }

  return null; // All classes unlocked
}

// =============================================================================
// COMPONENT
// =============================================================================

export const PlayerStatusBar: React.FC<PlayerStatusBarProps> = ({
  xp,
  xpLevel,
  corpsCoin,
  streak,
  lastLogin,
  unlockedClasses,
  createdAt,
  onXpClick,
  onCoinClick,
  onStreakClick,
}) => {
  const [gains, setGains] = useState<CurrencyGain[]>([]);
  const prevXpRef = useRef(xp);
  const prevCoinRef = useRef(corpsCoin);

  const xpProgress = getXpProgress(xp, xpLevel);
  const nextUnlock = getNextClassUnlock(unlockedClasses, xp, corpsCoin, createdAt);

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

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {/* Streak - Most Important */}
      <div onClick={onStreakClick} className="cursor-pointer">
        <StreakIndicator streak={streak} lastLogin={lastLogin} compact />
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px h-6 bg-gray-700" />

      {/* XP with level and progress */}
      <button
        onClick={onXpClick}
        className="relative flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 transition-colors group"
      >
        <TrendingUp className="w-4 h-4 text-blue-400" />
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-blue-300 tabular-nums">
              Lvl {xpLevel}
            </span>
          </div>
          {/* Mini progress bar */}
          <div className="w-12 h-1 bg-blue-900/50 rounded-sm overflow-hidden">
            <m.div
              className="h-full bg-blue-400 rounded-sm"
              initial={{ width: 0 }}
              animate={{ width: `${xpProgress.percent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* XP gain animation - Enhanced floating feedback */}
        <AnimatePresence>
          {gains
            .filter((g) => g.type === 'xp')
            .map((gain) => (
              <m.span
                key={gain.id}
                className="absolute -top-6 left-1/2 text-sm font-bold text-blue-300 pointer-events-none whitespace-nowrap drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                initial={{ opacity: 0, y: 10, x: '-50%', scale: 0.5 }}
                animate={{ opacity: [0, 1, 1, 0], y: -30, x: '-50%', scale: [0.5, 1.2, 1, 0.8] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, times: [0, 0.1, 0.7, 1] }}
              >
                +{gain.amount} XP
              </m.span>
            ))}
        </AnimatePresence>

        {/* Tooltip on hover */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          <div className="text-xs text-gray-300">
            <div className="font-semibold text-white mb-1">
              {xp.toLocaleString()} XP (Level {xpLevel})
            </div>
            <div>
              {xpProgress.current.toLocaleString()} / {xpProgress.max.toLocaleString()} to next level
            </div>
            {nextUnlock && (
              <div className="mt-1 pt-1 border-t border-gray-700">
                <span className="text-blue-400">{nextUnlock.className}</span>: {Math.round(nextUnlock.xpProgress)}% XP
              </div>
            )}
          </div>
        </div>
      </button>

      {/* CorpsCoin */}
      <button
        onClick={onCoinClick}
        className="relative flex items-center gap-1.5 px-2 py-1 rounded bg-gold-500/20 border border-gold-500/30 hover:bg-gold-500/30 transition-colors group"
      >
        <Coins className="w-4 h-4 text-gold-400" />
        <span className="text-sm font-bold text-gold-300 tabular-nums">
          {corpsCoin >= 1000 ? `${(corpsCoin / 1000).toFixed(1)}k` : corpsCoin}
        </span>

        {/* CC gain animation - Enhanced floating feedback */}
        <AnimatePresence>
          {gains
            .filter((g) => g.type === 'coin')
            .map((gain) => (
              <m.span
                key={gain.id}
                className="absolute -top-6 left-1/2 text-sm font-bold text-gold-300 pointer-events-none whitespace-nowrap drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]"
                initial={{ opacity: 0, y: 10, x: '-50%', scale: 0.5 }}
                animate={{ opacity: [0, 1, 1, 0], y: -30, x: '-50%', scale: [0.5, 1.2, 1, 0.8] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, times: [0, 0.1, 0.7, 1] }}
              >
                +{gain.amount} CC
              </m.span>
            ))}
        </AnimatePresence>

        {/* Tooltip on hover */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          <div className="text-xs text-gray-300">
            <div className="font-semibold text-white mb-1">
              {corpsCoin.toLocaleString()} CorpsCoin
            </div>
            {nextUnlock && (
              <div className="flex items-center gap-1">
                {nextUnlock.canAfford ? (
                  <Unlock className="w-3 h-3 text-green-400" />
                ) : (
                  <Lock className="w-3 h-3 text-gray-500" />
                )}
                <span className={nextUnlock.canAfford ? 'text-green-400' : 'text-gray-400'}>
                  {nextUnlock.className}: {nextUnlock.coinCost.toLocaleString()} CC
                </span>
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Next unlock indicator (desktop only) */}
      {nextUnlock && (
        <div className="hidden lg:flex items-center gap-2 px-2 py-1 rounded bg-gray-800/50 border border-gray-700/50">
          <span className="text-xs text-gray-400">Next:</span>
          <span className="text-xs font-medium text-gray-300">{nextUnlock.className}</span>
          {nextUnlock.weeksUntil != null && nextUnlock.weeksUntil > 0 && (
            <span className="text-[10px] text-cyan-400 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {nextUnlock.weeksUntil}w
            </span>
          )}
          <ChevronRight className="w-3 h-3 text-gray-500" />
        </div>
      )}
    </div>
  );
};

export default PlayerStatusBar;
