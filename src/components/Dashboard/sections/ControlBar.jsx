// ControlBar - Class tabs and Director HUD for dashboard
// OPTIMIZATION #4: Extracted from Dashboard.jsx to reduce file size and isolate renders

import React, { memo } from 'react';
import { Flame, Coins, Clock } from 'lucide-react';
import { CORPS_CLASS_ORDER } from '../../../utils/corps';
import { CLASS_SHORT_LABELS, CLASS_UNLOCK_LEVELS, CLASS_UNLOCK_COSTS, CLASS_DISPLAY_NAMES } from './constants';
import { getWeeksUntilUnlock } from '../../../utils/classUnlockTime';

// Helper to get next class unlock info
// Note: unlockedClasses uses 'aClass', 'openClass', 'worldClass' format
// But CLASS_UNLOCK_* constants use 'aClass', 'open', 'world' format
const getNextClassUnlock = (unlockedClasses, xpLevel, corpsCoin, createdAt) => {
  // Map from unlock key to profile key
  const classConfig = [
    { unlockKey: 'aClass', profileKey: 'aClass' },
    { unlockKey: 'open', profileKey: 'openClass' },
    { unlockKey: 'world', profileKey: 'worldClass' },
  ];

  for (const { unlockKey, profileKey } of classConfig) {
    if (!unlockedClasses?.includes(profileKey)) {
      const levelRequired = CLASS_UNLOCK_LEVELS[unlockKey];
      const coinCost = CLASS_UNLOCK_COSTS[unlockKey];
      const meetsLevel = xpLevel >= levelRequired;
      const canAfford = corpsCoin >= coinCost;
      const weeksUntil = createdAt ? getWeeksUntilUnlock(createdAt, unlockKey) : null;
      return {
        className: CLASS_DISPLAY_NAMES[unlockKey],
        classKey: unlockKey,
        levelRequired,
        coinCost,
        meetsLevel,
        canAfford,
        weeksUntil,
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

const ControlBar = memo(({
  corps,
  activeCorpsClass,
  unlockedClasses,
  profile,
  onSwitch,
  onCreateCorps,
  onUnlockClass
}) => {
  // Director stats from profile
  const streak = profile?.engagement?.loginStreak || 0;
  const corpsCoin = profile?.corpsCoin || 0;
  const level = profile?.xpLevel || 1;

  // Calculate next class unlock
  const nextUnlock = getNextClassUnlock(unlockedClasses, level, corpsCoin, profile?.createdAt);

  return (
    <div className="sticky top-0 z-10 bg-[#1a1a1a] border-b border-[#333]">
      <div className="flex items-center justify-between px-4 py-2">
        {/* LEFT: Class Switcher (Fixed 4 Tabs) */}
        <div className="flex items-center gap-1">
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
                  className="text-[10px] font-bold uppercase px-3 py-1.5 rounded-sm text-gray-600 hover:text-gray-400 border border-dashed border-[#444] transition-colors"
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
                className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-sm transition-colors ${
                  isActive
                    ? 'bg-[#0057B8] text-white'
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {CLASS_SHORT_LABELS[classId]}
              </button>
            );
          })}
        </div>

        {/* RIGHT: Director HUD - Order: Streak, Level, Coins, Buy */}
        <div className="flex items-center gap-3">
          {/* Streak with milestone indicator */}
          {streak > 0 && (
            <div className="flex items-center gap-1" title={`${streak}-day login streak${getStreakMilestone(streak) ? ` — ${getStreakMilestone(streak)}` : ''}`}>
              <Flame className={`w-3.5 h-3.5 ${streak >= 30 ? 'text-red-500' : streak >= 7 ? 'text-orange-400' : 'text-orange-500'}`} />
              <span className={`text-xs font-bold font-data tabular-nums ${streak >= 30 ? 'text-red-500' : streak >= 7 ? 'text-orange-400' : 'text-orange-500'}`}>
                {streak}
              </span>
              {streak >= 7 && (
                <span className={`text-[9px] font-bold px-1 py-0.5 rounded-sm ${
                  streak >= 100 ? 'bg-red-500/20 text-red-400' :
                  streak >= 30 ? 'bg-orange-500/20 text-orange-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {streak >= 100 ? 'LEGEND' : streak >= 60 ? 'ELITE' : streak >= 30 ? 'DEDICATED' : 'HOT'}
                </span>
              )}
            </div>
          )}

          {/* Level */}
          <div className="flex items-center">
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-sm">
              Lvl {level}
            </span>
          </div>

          {/* CorpsCoin Wallet */}
          <div className="flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs font-bold text-yellow-500 font-data tabular-nums">
              {corpsCoin.toLocaleString()}
            </span>
          </div>

          {/* Buy Button - show when user can afford next class */}
          {nextUnlock ? (
            nextUnlock.canAfford && onUnlockClass ? (
              <button
                onClick={() => onUnlockClass(nextUnlock.classKey)}
                className={`h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors ${
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
                {nextUnlock.weeksUntil != null && nextUnlock.weeksUntil > 0 && (
                  <span className="text-cyan-400 flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {nextUnlock.weeksUntil}w
                  </span>
                )}
              </span>
            )
          ) : (
            <span className="text-[10px] text-green-500">All unlocked</span>
          )}
        </div>
      </div>
    </div>
  );
});

export default ControlBar;
