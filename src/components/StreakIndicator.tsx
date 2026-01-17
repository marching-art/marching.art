// =============================================================================
// STREAK INDICATOR - Persistent streak display with tier visualization
// =============================================================================
// Shows streak prominently in header, with tier progression and risk awareness

import React, { useState, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Flame, Shield, AlertTriangle } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface StreakIndicatorProps {
  streak: number;
  lastLogin?: string | null;
  compact?: boolean;
  onStreakFreezeClick?: () => void;
  hasStreakFreeze?: boolean;
}

interface StreakTier {
  name: string;
  minDays: number;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor?: string;
  animate: boolean;
}

// =============================================================================
// STREAK TIERS
// =============================================================================

const STREAK_TIERS: StreakTier[] = [
  { name: 'Starting', minDays: 0, color: 'text-gray-400', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/30', animate: false },
  { name: 'Building', minDays: 3, color: 'text-orange-400', bgColor: 'bg-orange-500/20', borderColor: 'border-orange-500/30', animate: false },
  { name: 'Hot', minDays: 7, color: 'text-orange-300', bgColor: 'bg-orange-500/30', borderColor: 'border-orange-400/50', animate: true },
  { name: 'Fire', minDays: 14, color: 'text-red-400', bgColor: 'bg-red-500/30', borderColor: 'border-red-400/50', glowColor: 'shadow-red-500/20', animate: true },
  { name: 'Inferno', minDays: 30, color: 'text-gold-400', bgColor: 'bg-gold-500/30', borderColor: 'border-gold-400/50', glowColor: 'shadow-gold-500/30', animate: true },
];

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getStreakTier(streak: number): StreakTier {
  for (let i = STREAK_TIERS.length - 1; i >= 0; i--) {
    if (streak >= STREAK_TIERS[i].minDays) {
      return STREAK_TIERS[i];
    }
  }
  return STREAK_TIERS[0];
}

function getNextMilestone(streak: number): number | null {
  for (const milestone of STREAK_MILESTONES) {
    if (streak < milestone) return milestone;
  }
  return null;
}

function getProgressToNextMilestone(streak: number): { current: number; next: number; progress: number } | null {
  const nextMilestone = getNextMilestone(streak);
  if (!nextMilestone) return null;

  const prevMilestone = STREAK_MILESTONES[STREAK_MILESTONES.indexOf(nextMilestone) - 1] || 0;
  const progress = ((streak - prevMilestone) / (nextMilestone - prevMilestone)) * 100;

  return { current: streak, next: nextMilestone, progress };
}

function isStreakAtRisk(lastLogin: string | null): boolean {
  if (!lastLogin) return false;

  const lastLoginDate = new Date(lastLogin);
  const now = new Date();
  const hoursSinceLogin = (now.getTime() - lastLoginDate.getTime()) / (1000 * 60 * 60);

  // At risk if last login was more than 18 hours ago (6 hours until reset)
  return hoursSinceLogin >= 18 && hoursSinceLogin < 24;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const StreakIndicator: React.FC<StreakIndicatorProps> = ({
  streak,
  lastLogin,
  compact = false,
  onStreakFreezeClick,
  hasStreakFreeze = false,
}) => {
  const tier = getStreakTier(streak);
  const milestoneProgress = getProgressToNextMilestone(streak);
  const atRisk = isStreakAtRisk(lastLogin ?? null);
  const [showPulse, setShowPulse] = useState(false);

  // Pulse animation for high streaks
  useEffect(() => {
    if (tier.animate && streak > 0) {
      const interval = setInterval(() => {
        setShowPulse(true);
        setTimeout(() => setShowPulse(false), 1000);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [tier.animate, streak]);

  if (streak === 0) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-800/50 border border-gray-700/50">
        <Flame className="w-4 h-4 text-gray-500" />
        <span className="text-xs text-gray-500 font-medium">No streak</span>
      </div>
    );
  }

  // Compact version for header
  if (compact) {
    return (
      <m.div
        className={`flex items-center gap-1.5 px-2 py-1 rounded ${tier.bgColor} ${tier.borderColor} border ${tier.glowColor ? `shadow-lg ${tier.glowColor}` : ''}`}
        animate={showPulse ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        <m.div
          animate={tier.animate ? {
            rotate: [-5, 5, -5],
            scale: [1, 1.1, 1]
          } : {}}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatDelay: 2
          }}
        >
          <Flame className={`w-4 h-4 ${tier.color}`} />
        </m.div>
        <span className={`text-sm font-bold tabular-nums ${tier.color}`}>
          {streak}
        </span>
        {atRisk && !hasStreakFreeze && (
          <AlertTriangle className="w-3 h-3 text-yellow-400 animate-pulse" />
        )}
        {hasStreakFreeze && (
          <Shield className="w-3 h-3 text-blue-400" title="Streak protected" />
        )}
      </m.div>
    );
  }

  // Full version with progress bar
  return (
    <m.div
      className={`rounded-sm ${tier.bgColor} ${tier.borderColor} border p-3 ${tier.glowColor ? `shadow-lg ${tier.glowColor}` : ''}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <m.div
            animate={tier.animate ? {
              rotate: [-5, 5, -5],
              scale: [1, 1.15, 1]
            } : {}}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              repeatDelay: 1.5
            }}
          >
            <Flame className={`w-6 h-6 ${tier.color}`} />
          </m.div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold tabular-nums ${tier.color}`}>
                {streak}
              </span>
              <span className="text-sm text-gray-400">day streak</span>
            </div>
            <span className={`text-xs font-medium uppercase tracking-wider ${tier.color}`}>
              {tier.name}
            </span>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2">
          {hasStreakFreeze && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/20 border border-blue-500/30">
              <Shield className="w-3 h-3 text-blue-400" />
              <span className="text-xs text-blue-400 font-medium">Protected</span>
            </div>
          )}
          {atRisk && !hasStreakFreeze && (
            <m.button
              onClick={onStreakFreezeClick}
              className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/20 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <AlertTriangle className="w-3 h-3 text-yellow-400" />
              <span className="text-xs text-yellow-400 font-medium">At Risk!</span>
            </m.button>
          )}
        </div>
      </div>

      {/* Progress to next milestone */}
      {milestoneProgress && (
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Next milestone</span>
            <span className={tier.color}>
              {milestoneProgress.current} / {milestoneProgress.next} days
            </span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-sm overflow-hidden">
            <m.div
              className={`h-full rounded-sm ${tier.bgColor.replace('/20', '')} ${tier.bgColor.replace('/30', '')}`}
              initial={{ width: 0 }}
              animate={{ width: `${milestoneProgress.progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                background: streak >= 30
                  ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                  : streak >= 14
                    ? 'linear-gradient(90deg, #ef4444, #f87171)'
                    : 'linear-gradient(90deg, #f97316, #fb923c)'
              }}
            />
          </div>
        </div>
      )}
    </m.div>
  );
};

export default StreakIndicator;
