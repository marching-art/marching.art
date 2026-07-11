// ControlBar - Class tabs and Director HUD for dashboard
// OPTIMIZATION #4: Extracted from Dashboard.jsx to reduce file size and isolate renders

import React, { memo } from 'react';
import { Flame, Coins, Clock } from 'lucide-react';
import { CORPS_CLASS_ORDER } from '../../../utils/corps';
import {
  CLASS_SHORT_LABELS,
  CLASS_UNLOCK_LEVELS,
  CLASS_UNLOCK_COSTS,
  CLASS_DISPLAY_NAMES,
} from './constants';
import { getSeasonsUntilUnlock } from '../../../utils/classUnlocks';
import { getXPProgress } from '../../../utils/captionPricing';
import { usePodiumEnabled } from '../../../hooks/useFeatures';
import NextDeadlineChip from './NextDeadlineChip';

// Helper to get next class unlock info. Everything speaks canonical class
// keys (aClass/openClass/worldClass) — the same scheme as unlockedClasses,
// CORPS_CLASS_ORDER, and the CLASS_UNLOCK_* constants.
const getNextClassUnlock = (unlockedClasses, xpLevel, corpsCoin, totalSeasons) => {
  for (const classKey of ['aClass', 'openClass', 'worldClass']) {
    if (!unlockedClasses?.includes(classKey)) {
      const levelRequired = CLASS_UNLOCK_LEVELS[classKey];
      const coinCost = CLASS_UNLOCK_COSTS[classKey];
      const meetsLevel = xpLevel >= levelRequired;
      const canAfford = corpsCoin >= coinCost;
      const seasonsUntil = getSeasonsUntilUnlock(totalSeasons, classKey);
      return {
        className: CLASS_DISPLAY_NAMES[classKey],
        classKey,
        levelRequired,
        coinCost,
        meetsLevel,
        canAfford,
        seasonsUntil,
      };
    }
  }
  return null;
};

// Streak milestone labels
const getStreakMilestone = (streak) => {
  if (streak >= 100) return 'Legendary streak!';
  if (streak >= 60) return 'Elite dedication!';
  if (streak >= 30) return 'Dedicated director!';
  if (streak >= 14) return '2-week streak!';
  if (streak >= 7) return '1-week streak!';
  return null;
};

const ControlBar = memo(
  ({
    corps,
    activeCorpsClass,
    unlockedClasses,
    profile,
    onSwitch,
    onCreateCorps,
    onUnlockClass,
    onStreakClick,
    onWalletClick,
    onLevelClick,
  }) => {
    // Podium Class tab is flag-gated and always open — no unlock, no corps
    // required to click it (the zone handles the unregistered state).
    const podiumEnabled = usePodiumEnabled();

    // Director stats from profile
    const streak = profile?.engagement?.loginStreak || 0;
    const corpsCoin = profile?.corpsCoin || 0;
    const level = profile?.xpLevel || 1;
    const xpProgress = getXPProgress(profile?.xp || 0);

    // Calculate next class unlock
    const nextUnlock = getNextClassUnlock(
      unlockedClasses,
      level,
      corpsCoin,
      profile?.lifetimeStats?.totalSeasons
    );

    return (
      <div className="sticky top-0 z-10 bg-[#1a1a1a] border-b border-[#333]">
        {/* On mobile the class selector and the director HUD each get their own
            row so neither clips off the right edge; on md+ they share one row. */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-4 py-2">
          {/* Class Switcher (Fixed 4 Tabs) */}
          <div className="flex items-center justify-center md:justify-start gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {CORPS_CLASS_ORDER.map((classId) => {
              const isUnlocked = unlockedClasses?.includes(classId);
              const hasCorps = corps && corps[classId];
              const isActive = classId === activeCorpsClass && hasCorps;

              // Locked class - don't show
              if (!isUnlocked) return null;

              // Empty slot (unlocked but no corps)
              if (!hasCorps) {
                return (
                  <button
                    key={classId}
                    onClick={() => onCreateCorps?.(classId)}
                    className="flex-shrink-0 whitespace-nowrap text-[10px] font-bold uppercase px-3 min-h-touch rounded-sm text-gray-600 hover:text-gray-400 border border-dashed border-[#444] transition-colors press-feedback"
                  >
                    {CLASS_SHORT_LABELS[classId]}
                  </button>
                );
              }

              // Has corps - clickable tab
              return (
                <button
                  key={classId}
                  onClick={() => onSwitch(classId)}
                  className={`flex-shrink-0 whitespace-nowrap text-[10px] font-bold uppercase px-3 min-h-touch rounded-sm transition-colors press-feedback ${
                    isActive
                      ? 'bg-[#0057B8] text-white'
                      : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {CLASS_SHORT_LABELS[classId]}
                </button>
              );
            })}
            {podiumEnabled && (
              <button
                onClick={() => onSwitch('podiumClass')}
                className={`flex-shrink-0 whitespace-nowrap text-[10px] font-bold uppercase px-3 min-h-touch rounded-sm transition-colors press-feedback ${
                  activeCorpsClass === 'podiumClass'
                    ? 'bg-[#8a6d1a] text-white'
                    : corps?.podiumClass
                      ? 'text-gray-500 hover:text-white hover:bg-white/5'
                      : 'text-[#c9a227]/70 hover:text-[#c9a227] border border-dashed border-[#8a6d1a]/50'
                }`}
              >
                {CLASS_SHORT_LABELS.podiumClass}
              </button>
            )}
          </div>

          {/* CENTER: Next deadline countdown (scores drop / trade reset) */}
          <div className="hidden md:block">
            <NextDeadlineChip />
          </div>

          {/* Director HUD - Order: Streak, Level, Coins, Buy. On mobile this
              sits on its own row; a top divider separates it from the tabs. */}
          <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap border-t border-[#2a2a2a] pt-2 md:border-t-0 md:pt-0">
            {/* Streak with milestone indicator — opens the streak panel
                (status, next milestone, streak freeze purchase) */}
            {streak > 0 && (
              <button
                onClick={() => onStreakClick?.()}
                className="flex items-center gap-1 press-feedback hover:bg-white/5 rounded-sm px-1 -mx-1"
                title={`${streak}-day login streak${getStreakMilestone(streak) ? ` — ${getStreakMilestone(streak)}` : ''} — tap for streak details`}
              >
                <Flame
                  className={`w-3.5 h-3.5 ${streak >= 30 ? 'text-red-500' : streak >= 7 ? 'text-orange-400' : 'text-orange-500'}`}
                />
                <span
                  className={`text-xs font-bold font-data tabular-nums ${streak >= 30 ? 'text-red-500' : streak >= 7 ? 'text-orange-400' : 'text-orange-500'}`}
                >
                  {streak}
                </span>
                {streak >= 7 && (
                  <span
                    className={`text-[9px] font-bold px-1 py-0.5 rounded-sm ${
                      streak >= 100
                        ? 'bg-red-500/20 text-red-400'
                        : streak >= 30
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                    }`}
                  >
                    {streak >= 100
                      ? 'LEGEND'
                      : streak >= 60
                        ? 'ELITE'
                        : streak >= 30
                          ? 'DEDICATED'
                          : 'HOT'}
                  </span>
                )}
              </button>
            )}

            {/* Level + XP-to-next-level progress (the pill used to be a bare
                number — the game's most basic progression readout was
                invisible) — opens the full Achievements page */}
            <button
              onClick={() => onLevelClick?.()}
              className="flex items-center gap-1.5 press-feedback hover:bg-white/5 rounded-sm px-1 -mx-1"
              title={`${xpProgress.current}/${xpProgress.needed} XP to Level ${xpProgress.nextLevel} — tap to view all achievements`}
            >
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-sm">
                Lvl {level}
              </span>
              <div
                className="w-12 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={xpProgress.current}
                aria-valuemin={0}
                aria-valuemax={xpProgress.needed}
                aria-label={`XP progress to Level ${xpProgress.nextLevel}`}
              >
                <div
                  className="h-full bg-purple-500 transition-all"
                  style={{ width: `${xpProgress.percentage}%` }}
                />
              </div>
            </button>

            {/* CorpsCoin Wallet — opens transaction history + earning guide */}
            <button
              onClick={() => onWalletClick?.()}
              className="flex items-center gap-1 press-feedback hover:bg-white/5 rounded-sm px-1 -mx-1"
              title="CorpsCoin wallet — history and how to earn"
            >
              <Coins className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-xs font-bold text-yellow-500 font-data tabular-nums">
                {corpsCoin.toLocaleString()}
              </span>
            </button>

            {/* Buy Button - show when user can afford next class */}
            {nextUnlock ? (
              nextUnlock.canAfford && onUnlockClass ? (
                <button
                  onClick={() => onUnlockClass(nextUnlock.classKey)}
                  className={`min-h-touch px-3 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors press-feedback ${
                    nextUnlock.meetsLevel
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                  }`}
                  title={`${nextUnlock.meetsLevel ? 'Unlock' : 'Buy'} ${nextUnlock.className} (${nextUnlock.coinCost.toLocaleString()} CC)`}
                >
                  <Coins className="w-3 h-3" />
                  {nextUnlock.meetsLevel ? 'Unlock' : 'Buy'}
                </button>
              ) : (
                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                  {nextUnlock.className}: {nextUnlock.coinCost}CC
                  {nextUnlock.seasonsUntil != null && nextUnlock.seasonsUntil > 0 && (
                    <span
                      className="text-cyan-400 flex items-center gap-0.5"
                      title={`Unlocks free after ${nextUnlock.seasonsUntil} more completed season${nextUnlock.seasonsUntil > 1 ? 's' : ''} — or reach Level ${nextUnlock.levelRequired} first`}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      {nextUnlock.seasonsUntil} season{nextUnlock.seasonsUntil > 1 ? 's' : ''}
                    </span>
                  )}
                </span>
              )
            ) : (
              <span className="text-[10px] text-green-500">All unlocked</span>
            )}
          </div>
        </div>

        {/* Small screens get the countdown as a full-width strip */}
        <div className="md:hidden">
          <NextDeadlineChip variant="strip" />
        </div>
      </div>
    );
  }
);

export default ControlBar;
