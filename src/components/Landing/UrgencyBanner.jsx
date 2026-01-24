/**
 * UrgencyBanner Component - Contextual Time-Sensitive Messaging
 *
 * Displays urgency triggers from useUrgencyTriggers hook in a non-intrusive way.
 * Adapts styling based on urgency level and trigger type.
 * Designed to inform, not pressure - creates FOMO through information, not manipulation.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { m } from 'framer-motion';
import {
  Activity, Calendar, Clock, Trophy, TrendingUp, UserPlus,
  ChevronRight, Zap
} from 'lucide-react';
import { useUrgencyTriggers, URGENCY_LEVELS } from '../../hooks/useUrgencyTriggers';

// =============================================================================
// ICON MAPPING
// =============================================================================

const ICONS = {
  activity: Activity,
  calendar: Calendar,
  clock: Clock,
  trophy: Trophy,
  'trending-up': TrendingUp,
  'user-plus': UserPlus,
};

// =============================================================================
// STYLE CONFIGURATIONS BY URGENCY LEVEL
// =============================================================================

const LEVEL_STYLES = {
  [URGENCY_LEVELS.HIGH]: {
    container: 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border-red-500/30',
    icon: 'bg-red-500/20 text-red-500',
    text: 'text-red-400',
    subtext: 'text-red-300/70',
    pulse: 'animate-pulse',
  },
  [URGENCY_LEVELS.MEDIUM]: {
    container: 'bg-gradient-to-r from-yellow-500/20 to-orange-500/10 border-yellow-500/30',
    icon: 'bg-yellow-500/20 text-yellow-500',
    text: 'text-yellow-400',
    subtext: 'text-yellow-300/70',
    pulse: '',
  },
  [URGENCY_LEVELS.LOW]: {
    container: 'bg-[#1a1a1a] border-[#333]',
    icon: 'bg-[#0057B8]/20 text-[#0057B8]',
    text: 'text-gray-300',
    subtext: 'text-gray-500',
    pulse: '',
  },
};

// =============================================================================
// URGENCY BADGE COMPONENT (Compact version)
// =============================================================================

export const UrgencyBadge = ({ className = '' }) => {
  const { primary, isLoading } = useUrgencyTriggers();

  if (isLoading || !primary) return null;

  const styles = LEVEL_STYLES[primary.level] || LEVEL_STYLES[URGENCY_LEVELS.LOW];
  const Icon = ICONS[primary.icon] || Activity;

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-sm border ${styles.container} ${className}`}
    >
      <div className={`${primary.pulse ? styles.pulse : ''}`}>
        <Icon className={`w-4 h-4 ${styles.icon.split(' ')[1]}`} />
      </div>
      <span className={`text-sm font-medium ${styles.text}`}>
        {primary.message}
      </span>
    </m.div>
  );
};

// =============================================================================
// URGENCY BANNER COMPONENT (Full version for sidebar)
// =============================================================================

const UrgencyBanner = ({ showCTA = true, maxTriggers = 2, className = '' }) => {
  const { all, isLoading, isLiveShowNow, showsToday } = useUrgencyTriggers();

  if (isLoading || all.length === 0) return null;

  // Show up to maxTriggers
  const visibleTriggers = all.slice(0, maxTriggers);

  return (
    <m.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`space-y-2 ${className}`}
    >
      {visibleTriggers.map((trigger, index) => {
        const styles = LEVEL_STYLES[trigger.level] || LEVEL_STYLES[URGENCY_LEVELS.LOW];
        const Icon = ICONS[trigger.icon] || Activity;

        return (
          <div
            key={trigger.id}
            className={`rounded-sm border overflow-hidden ${styles.container}`}
          >
            <div className="px-3 py-2.5 flex items-center gap-3">
              {/* Icon */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-sm flex items-center justify-center ${styles.icon} ${trigger.pulse ? styles.pulse : ''}`}>
                <Icon className="w-4 h-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${styles.text}`}>
                  {trigger.message}
                </div>
                {trigger.subMessage && (
                  <div className={`text-xs ${styles.subtext}`}>
                    {trigger.subMessage}
                  </div>
                )}
              </div>

              {/* Live indicator for live shows */}
              {trigger.type === 'live' && (
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <span className="text-xs font-bold text-red-500 uppercase tracking-wider">
                    Live
                  </span>
                </div>
              )}
            </div>

            {/* CTA for first trigger only */}
            {showCTA && index === 0 && trigger.level === URGENCY_LEVELS.HIGH && (
              <Link
                to="/register"
                className="flex items-center justify-center gap-2 px-3 py-2 bg-white/5 border-t border-white/10 text-sm font-medium text-white hover:bg-white/10 transition-colors"
              >
                <Zap className="w-4 h-4 text-yellow-500" />
                Join now to compete
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        );
      })}
    </m.div>
  );
};

// =============================================================================
// SEASON COUNTDOWN COMPONENT (Minimal inline version)
// =============================================================================

export const SeasonCountdown = ({ className = '' }) => {
  const { weeksRemaining, daysUntilFinals, currentWeek, seasonType, isLoading } = useUrgencyTriggers();

  if (isLoading || weeksRemaining === 0) return null;

  // Only show for live seasons with meaningful countdown
  if (seasonType !== 'live' || weeksRemaining > 6) return null;

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <Clock className="w-4 h-4 text-yellow-500" />
      <span className="text-gray-400">
        <span className="font-semibold text-white">{weeksRemaining}</span>
        {' '}week{weeksRemaining > 1 ? 's' : ''} until finals
      </span>
    </div>
  );
};

// =============================================================================
// LIVE INDICATOR COMPONENT (For headers/nav)
// =============================================================================

export const LiveIndicator = ({ className = '' }) => {
  const { isLiveShowNow, isLiveShowDay, showsToday, isLoading } = useUrgencyTriggers();

  if (isLoading || !isLiveShowDay) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isLiveShowNow ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="text-xs font-bold text-red-500 uppercase tracking-wider">
            Live Now
          </span>
        </>
      ) : (
        <>
          <Activity className="w-3.5 h-3.5 text-yellow-500" />
          <span className="text-xs font-medium text-yellow-500">
            {showsToday.length} show{showsToday.length > 1 ? 's' : ''} today
          </span>
        </>
      )}
    </div>
  );
};

export default UrgencyBanner;
