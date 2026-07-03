/**
 * Season Clock
 *
 * Single source of truth for every player-facing deadline:
 *   - When scores process (nightly Cloud Function, 02:00 America/New_York —
 *     see functions/src/scheduled/dailyProcessors.js)
 *   - When the weekly lineup-change (trade) counter resets — mirrors the
 *     backend week math in functions/src/callable/lineups.js
 *   - When show registration effectively closes (scores processing the
 *     night after the show)
 *
 * All UI surfaces that display a deadline must derive it from here so the
 * times can never drift apart between screens.
 */

const ET_ZONE = 'America/New_York';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Hour of day (ET) when the nightly score processors run. */
export const SCORES_PROCESS_HOUR_ET = 2;

/** Competition weeks in a season. */
export const TOTAL_SEASON_WEEKS = 7;

/** Lineup changes allowed per week once limits apply (backend tradeLimit). */
export const WEEKLY_TRADE_LIMIT = 3;

/**
 * Break a Date into its Eastern-Time wall-clock parts.
 * @param {Date} date
 * @returns {{year: string, month: string, day: string, hour: string, minute: string}}
 */
function easternParts(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: ET_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const out = {};
  for (const { type, value } of fmt.formatToParts(date)) out[type] = value;
  return out;
}

/**
 * Get the UTC instant for a given Eastern-Time wall-clock time.
 * Tries both EST and EDT offsets and keeps the one that round-trips.
 * @param {string} year - 'YYYY'
 * @param {string} month - 'MM'
 * @param {string} day - 'DD'
 * @param {number} hour - 0-23 (ET)
 * @returns {Date}
 */
function easternWallTimeToDate(year, month, day, hour) {
  const hh = String(hour).padStart(2, '0');
  for (const offset of ['-05:00', '-04:00']) {
    const candidate = new Date(`${year}-${month}-${day}T${hh}:00:00${offset}`);
    const p = easternParts(candidate);
    if (p.year === year && p.month === month && p.day === day && Number(p.hour) === hour) {
      return candidate;
    }
  }
  // The wall time doesn't exist (spring-forward skips 2 AM); the scheduler
  // fires at the next real instant, 3 AM EDT.
  return new Date(`${year}-${month}-${day}T03:00:00-04:00`);
}

/**
 * Next instant the nightly score processors run (02:00 ET).
 * @param {Date} [now]
 * @returns {Date}
 */
export function getNextScoresProcessingTime(now = new Date()) {
  const today = easternParts(now);
  let target = easternWallTimeToDate(today.year, today.month, today.day, SCORES_PROCESS_HOUR_ET);
  if (target.getTime() <= now.getTime()) {
    const tomorrow = easternParts(new Date(now.getTime() + DAY_MS));
    target = easternWallTimeToDate(
      tomorrow.year,
      tomorrow.month,
      tomorrow.day,
      SCORES_PROCESS_HOUR_ET
    );
  }
  return target;
}

/**
 * The instant show registration effectively closes: scores processing at
 * 02:00 ET the day after the show. Until then, attendance can still change.
 * @param {Date|null} eventDate - Local-midnight Date for the show's calendar day
 *   (as produced by Schedule's getActualDate)
 * @returns {Date|null}
 */
export function getShowRegistrationDeadline(eventDate) {
  if (!eventDate || Number.isNaN(eventDate.getTime())) return null;
  const next = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate() + 1);
  const year = String(next.getFullYear());
  const month = String(next.getMonth() + 1).padStart(2, '0');
  const day = String(next.getDate()).padStart(2, '0');
  return easternWallTimeToDate(year, month, day, SCORES_PROCESS_HOUR_ET);
}

/**
 * Current trade week and when its counter resets.
 *
 * Replicates the backend math exactly (functions/src/callable/lineups.js):
 * weeks are 7-day blocks measured in raw milliseconds from schedule.startDate,
 * with spring-training days excluded before competition Day 1. The reset
 * instant is therefore startDate + (week * 7 + springTrainingDays) days.
 *
 * @param {Object} seasonData - Season doc (needs schedule.startDate, status)
 * @param {Date} [now]
 * @returns {{
 *   week: number,
 *   resetsAt: Date|null,
 *   isUnlimitedWeek: boolean,
 *   unlimitedEndsAt: Date|null,
 *   tradeLimit: number,
 * }|null} null when the season has no start date
 */
export function getTradeWeekInfo(seasonData, now = new Date()) {
  const startTs = seasonData?.schedule?.startDate;
  if (!startTs) return null;
  const startDate = typeof startTs.toDate === 'function' ? startTs.toDate() : new Date(startTs);
  if (Number.isNaN(startDate.getTime())) return null;

  const springTrainingDays = seasonData.schedule.springTrainingDays || 0;
  const currentDay =
    Math.floor((now.getTime() - startDate.getTime()) / DAY_MS) + 1 - springTrainingDays;
  const week = Math.max(1, Math.ceil(currentDay / 7));

  const boundaryAfterWeek = (w) =>
    new Date(startDate.getTime() + (w * 7 + springTrainingDays) * DAY_MS);

  // Unlimited-change windows mirror the backend: off-season week 1,
  // live-season weeks 1-3.
  let isUnlimitedWeek = false;
  let unlimitedEndsAt = null;
  if (seasonData.status === 'off-season' && week === 1) {
    isUnlimitedWeek = true;
    unlimitedEndsAt = boundaryAfterWeek(1);
  } else if (seasonData.status === 'live-season' && week <= 3) {
    isUnlimitedWeek = true;
    unlimitedEndsAt = boundaryAfterWeek(3);
  }

  return {
    week,
    resetsAt: week < TOTAL_SEASON_WEEKS ? boundaryAfterWeek(week) : null,
    isUnlimitedWeek,
    unlimitedEndsAt,
    tradeLimit: WEEKLY_TRADE_LIMIT,
  };
}

/**
 * Compact countdown label: "2d 4h", "6h 12m", "45m", "now".
 * @param {number} ms - Milliseconds until the deadline
 * @returns {string}
 */
export function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 'now';
  const totalMinutes = Math.ceil(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Short absolute label in ET, e.g. "Sun 8:00 PM ET".
 * @param {Date|null} date
 * @returns {string}
 */
export function formatEtShort(date) {
  if (!date) return '';
  const label = date.toLocaleString('en-US', {
    timeZone: ET_ZONE,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${label} ET`;
}

/**
 * Full absolute label in ET, e.g. "Sun, Jul 6, 2:00 AM ET".
 * @param {Date|null} date
 * @returns {string}
 */
export function formatEtDayTime(date) {
  if (!date) return '';
  const label = date.toLocaleString('en-US', {
    timeZone: ET_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${label} ET`;
}
