/**
 * useUrgencyTriggers Hook - Urgency and Timing Data for Landing Page
 *
 * Consolidates season and schedule data into actionable urgency messages.
 * Used to display contextual, time-sensitive information without being pushy.
 */

import { useMemo } from 'react';
import { useSeasonStore } from '../store/seasonStore';
import { useScheduleStore } from '../store/scheduleStore';
import { getSeasonProgress } from './useSeason';

// =============================================================================
// URGENCY TRIGGER TYPES
// =============================================================================

/**
 * Urgency levels determine display priority and styling
 * - high: Red/orange, prominent placement (finals week, today's shows)
 * - medium: Yellow, notable but not critical (countdown, deadlines approaching)
 * - low: Blue/gray, informational (season progress, general info)
 */
export const URGENCY_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a date is today (comparing date strings)
 */
function isToday(date) {
  if (!date) return false;
  const today = new Date();
  const compareDate = date instanceof Date ? date : date.toDate?.() || new Date(date);
  return today.toDateString() === compareDate.toDateString();
}

/**
 * Check if a date is tomorrow
 */
function isTomorrow(date) {
  if (!date) return false;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const compareDate = date instanceof Date ? date : date.toDate?.() || new Date(date);
  return tomorrow.toDateString() === compareDate.toDateString();
}

/**
 * Calculate days until a date
 */
function daysUntil(date) {
  if (!date) return null;
  const now = new Date();
  const targetDate = date instanceof Date ? date : date.toDate?.() || new Date(date);
  const diffTime = targetDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get hour of day (0-23)
 */
function getCurrentHour() {
  return new Date().getHours();
}

// =============================================================================
// URGENCY TRIGGERS HOOK
// =============================================================================

export function useUrgencyTriggers() {
  // Season data from global store
  const seasonData = useSeasonStore((state) => state.seasonData);
  const weeksRemaining = useSeasonStore((state) => state.weeksRemaining);
  const seasonLoading = useSeasonStore((state) => state.loading);

  // Schedule data from global store
  const competitions = useScheduleStore((state) => state.competitions);
  const scheduleLoading = useScheduleStore((state) => state.loading);

  // Calculate all urgency triggers
  const triggers = useMemo(() => {
    const result = {
      // Primary triggers (shown prominently)
      primary: null,

      // All active triggers
      all: [],

      // Specific trigger states
      isLiveShowDay: false,
      isLiveShowNow: false,
      showsToday: [],
      showsTomorrow: [],

      // Season info
      seasonType: seasonData?.seasonType || 'off',
      currentWeek: 0,
      currentDay: 0,
      weeksRemaining: weeksRemaining || 0,
      daysUntilFinals: null,

      // Registration info
      registrationOpen: false,
      daysUntilRegistrationCloses: null,

      // Loading state
      isLoading: seasonLoading || scheduleLoading,
    };

    if (!seasonData || seasonLoading) {
      return result;
    }

    // Calculate season progress
    const progress = getSeasonProgress(seasonData);
    result.currentWeek = progress.currentWeek;
    result.currentDay = progress.currentDay;

    // Calculate days until finals/season end
    if (seasonData.schedule?.endDate) {
      result.daysUntilFinals = daysUntil(seasonData.schedule.endDate);
    }
    if (seasonData.schedule?.finalsDate) {
      result.daysUntilFinals = daysUntil(seasonData.schedule.finalsDate);
    }

    // Check registration status
    result.registrationOpen = seasonData.registrationOpen || false;
    if (seasonData.registrationDeadline) {
      result.daysUntilRegistrationCloses = daysUntil(seasonData.registrationDeadline);
    }

    // Find today's and tomorrow's shows
    if (competitions && competitions.length > 0) {
      result.showsToday = competitions.filter((show) => isToday(show.date));
      result.showsTomorrow = competitions.filter((show) => isTomorrow(show.date));
      result.isLiveShowDay = result.showsToday.length > 0;

      // Check if shows are likely happening now (evening hours, typically 7pm-11pm)
      const hour = getCurrentHour();
      result.isLiveShowNow = result.isLiveShowDay && hour >= 18 && hour <= 23;
    }

    // Build urgency triggers based on conditions
    const triggers = [];

    // 1. LIVE SHOWS NOW (highest priority)
    if (result.isLiveShowNow) {
      triggers.push({
        id: 'live_now',
        level: URGENCY_LEVELS.HIGH,
        type: 'live',
        message: 'Live scores updating now',
        subMessage: `${result.showsToday.length} show${result.showsToday.length > 1 ? 's' : ''} in progress`,
        icon: 'activity',
        pulse: true,
      });
    }
    // 2. SHOWS TODAY (before evening)
    else if (result.isLiveShowDay) {
      triggers.push({
        id: 'shows_today',
        level: URGENCY_LEVELS.HIGH,
        type: 'show_day',
        message: 'Live scores tonight',
        subMessage: `${result.showsToday.length} show${result.showsToday.length > 1 ? 's' : ''} competing today`,
        icon: 'calendar',
        pulse: false,
      });
    }
    // 3. SHOWS TOMORROW
    else if (result.showsTomorrow.length > 0) {
      triggers.push({
        id: 'shows_tomorrow',
        level: URGENCY_LEVELS.MEDIUM,
        type: 'upcoming',
        message: 'Shows tomorrow',
        subMessage: `${result.showsTomorrow.length} competition${result.showsTomorrow.length > 1 ? 's' : ''} scheduled`,
        icon: 'calendar',
        pulse: false,
      });
    }

    // 4. FINALS WEEK (last week of season)
    if (result.weeksRemaining === 1) {
      triggers.push({
        id: 'finals_week',
        level: URGENCY_LEVELS.HIGH,
        type: 'finals',
        message: 'Finals week',
        subMessage: 'The championship is here',
        icon: 'trophy',
        pulse: true,
      });
    }
    // 5. SEASON COUNTDOWN (2-4 weeks remaining)
    else if (result.weeksRemaining > 0 && result.weeksRemaining <= 4) {
      triggers.push({
        id: 'season_countdown',
        level: result.weeksRemaining <= 2 ? URGENCY_LEVELS.MEDIUM : URGENCY_LEVELS.LOW,
        type: 'countdown',
        message: `${result.weeksRemaining} week${result.weeksRemaining > 1 ? 's' : ''} until finals`,
        subMessage: result.daysUntilFinals ? `${result.daysUntilFinals} days remaining` : null,
        icon: 'clock',
        pulse: false,
      });
    }

    // 6. REGISTRATION CLOSING SOON
    if (result.registrationOpen && result.daysUntilRegistrationCloses !== null) {
      if (result.daysUntilRegistrationCloses <= 7 && result.daysUntilRegistrationCloses > 0) {
        triggers.push({
          id: 'registration_closing',
          level: result.daysUntilRegistrationCloses <= 3 ? URGENCY_LEVELS.HIGH : URGENCY_LEVELS.MEDIUM,
          type: 'deadline',
          message: `Registration closes in ${result.daysUntilRegistrationCloses} day${result.daysUntilRegistrationCloses > 1 ? 's' : ''}`,
          subMessage: 'Join before the deadline',
          icon: 'user-plus',
          pulse: result.daysUntilRegistrationCloses <= 3,
        });
      }
    }

    // 7. SEASON PROGRESS (informational)
    if (result.currentWeek > 0 && seasonData.seasonType === 'live') {
      triggers.push({
        id: 'season_progress',
        level: URGENCY_LEVELS.LOW,
        type: 'progress',
        message: `Week ${result.currentWeek} of ${seasonData.totalWeeks || 7}`,
        subMessage: seasonData.seasonType === 'live' ? 'Live Season' : 'Off-Season',
        icon: 'trending-up',
        pulse: false,
      });
    }

    result.all = triggers;
    result.primary = triggers.length > 0 ? triggers[0] : null;

    return result;
  }, [seasonData, weeksRemaining, seasonLoading, competitions, scheduleLoading]);

  return triggers;
}

export default useUrgencyTriggers;
