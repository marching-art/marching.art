/**
 * useUrgencyTriggers Hook - Urgency and Timing Data for Landing Page
 *
 * Consolidates season and schedule data into actionable urgency messages.
 * Used to display contextual, time-sensitive information without being pushy.
 */

import { useMemo } from 'react';
import { useSeasonStore } from '../store/seasonStore';
import { useScheduleStore } from '../store/scheduleStore';
import { isShowLive, showStartsAtDate } from '../utils/scheduleUtils';

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

// Show dates are stored at UTC midnight, so read their UTC calendar
// components when comparing against the user's local calendar date —
// otherwise every show shifts one day earlier in negative-UTC-offset
// timezones (Schedule.jsx does the same when projecting day numbers).
function matchesCalendarDay(date, target) {
  if (!date) return false;
  const compareDate = date instanceof Date ? date : date.toDate?.() || new Date(date);
  return (
    target.getFullYear() === compareDate.getUTCFullYear() &&
    target.getMonth() === compareDate.getUTCMonth() &&
    target.getDate() === compareDate.getUTCDate()
  );
}

function isToday(date) {
  return matchesCalendarDay(date, new Date());
}

function isTomorrow(date) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return matchesCalendarDay(date, tomorrow);
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

/**
 * Format a show's real start time in its venue timezone (e.g. "7:30 PM").
 * Falls back to the local zone when the show has no timezone.
 * @param {Object} show
 * @returns {string|null}
 */
function formatShowStart(show) {
  const start = showStartsAtDate(show);
  if (!start) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: show.timezone || undefined,
      timeZoneName: 'short',
    }).format(start);
  } catch {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(start);
  }
}

// =============================================================================
// URGENCY TRIGGERS HOOK
// =============================================================================

export function useUrgencyTriggers() {
  // Season data from global store. currentDay/currentWeek are derived once in
  // the store from the canonical season clock (utils/seasonProgress) — read
  // them here rather than recomputing, so this surface can't drift.
  const seasonData = useSeasonStore((state) => state.seasonData);
  const weeksRemaining = useSeasonStore((state) => state.weeksRemaining);
  const seasonLoading = useSeasonStore((state) => state.loading);
  const currentDay = useSeasonStore((state) => state.currentDay);
  const currentWeek = useSeasonStore((state) => state.currentWeek);

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
      liveShows: [],
      nextShowToday: null,
      nextShowStartLabel: null,

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

    // Season progress comes from the store's canonical derivation.
    result.currentWeek = currentWeek;
    result.currentDay = currentDay;

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
      const now = new Date();
      result.showsToday = competitions.filter((show) => isToday(show.date));
      result.showsTomorrow = competitions.filter((show) => isTomorrow(show.date));
      result.isLiveShowDay = result.showsToday.length > 0;

      // HONEST live detection: a show is "in progress" only when NOW falls inside
      // its real start→scores window (from the scraped detail page). No more
      // "it's evening so assume shows are live" guessing.
      const enrichedToday = result.showsToday.filter((s) => showStartsAtDate(s));
      result.liveShows = result.showsToday.filter((s) => isShowLive(s, now));

      if (enrichedToday.length > 0) {
        // We have real timing for at least some of today's shows — trust it.
        result.isLiveShowNow = result.liveShows.length > 0;
        // Earliest upcoming (not-yet-started) show today, for the countdown copy.
        const upcoming = enrichedToday
          .filter((s) => showStartsAtDate(s) > now)
          .sort((a, b) => showStartsAtDate(a) - showStartsAtDate(b));
        result.nextShowToday = upcoming[0] || null;
        result.nextShowStartLabel = result.nextShowToday
          ? formatShowStart(result.nextShowToday)
          : null;
      } else {
        // No enriched timing (off-season / unscraped) — preserve prior behavior so
        // nothing regresses: assume evening shows are live.
        const hour = getCurrentHour();
        result.isLiveShowNow = result.isLiveShowDay && hour >= 18 && hour <= 23;
      }
    }

    // Build urgency triggers based on conditions
    const triggers = [];

    // 1. LIVE SHOWS NOW (highest priority) — only when a show is genuinely on the
    //    field right now. Count reflects shows actually performing, not every show
    //    dated today. Scores archive overnight, so the copy says "performing now".
    if (result.isLiveShowNow) {
      // liveShows is populated when we have real timing; fall back to today's count
      // for the unenriched evening-heuristic path.
      const liveCount = result.liveShows.length || result.showsToday.length;
      triggers.push({
        id: 'live_now',
        level: URGENCY_LEVELS.HIGH,
        type: 'live',
        message: `${liveCount} show${liveCount > 1 ? 's' : ''} performing now`,
        subMessage: 'Live from the DCI tour',
        icon: 'activity',
        pulse: true,
      });
    }
    // 2. SHOWS TODAY (before showtime)
    else if (result.isLiveShowDay) {
      triggers.push({
        id: 'shows_today',
        level: URGENCY_LEVELS.HIGH,
        type: 'show_day',
        message: 'Live scores tonight',
        // Prefer the real first-show time when we scraped it; otherwise fall back
        // to a simple count of today's shows.
        subMessage: result.nextShowStartLabel
          ? `First show at ${result.nextShowStartLabel}`
          : `${result.showsToday.length} show${result.showsToday.length > 1 ? 's' : ''} competing today`,
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
          level:
            result.daysUntilRegistrationCloses <= 3 ? URGENCY_LEVELS.HIGH : URGENCY_LEVELS.MEDIUM,
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
  }, [
    seasonData,
    weeksRemaining,
    seasonLoading,
    competitions,
    scheduleLoading,
    currentDay,
    currentWeek,
  ]);

  return triggers;
}

export default useUrgencyTriggers;
