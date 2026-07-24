// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
/**
 * Season Clock
 *
 * Single source of truth for every player-facing deadline:
 *   - When scores drop. Off-season: 9:00 PM ET, fixed. Live season: when the
 *     furthest-west show of the night would post (11 PM ET for an
 *     Eastern-only night, up to 2 AM ET for a West Coast night; midnight ET
 *     during Championship Week) — the exact instant is published nightly by
 *     the backend to drop_plans/{date} (functions/src/scheduled/
 *     dropDispatcher.js) and surfaced via hooks/useSeasonClock. This module
 *     provides the schedule-free ESTIMATE (exact for off-season, a
 *     conservative 2 AM ET bound for live nights) used until the plan doc
 *     exists.
 *   - When caption changes open, lock, and reset — mirrors the backend
 *     rules in functions/src/helpers/captionWindows.js. Lockouts reopen at
 *     the 2 AM ET boundary regardless of how early that night's scores
 *     dropped (the backend gate is 2 AM AND the recap existing).
 *   - When show registration effectively closes (the night's scores
 *     processing).
 *
 * All UI surfaces that display a deadline must derive it from here so the
 * times can never drift apart between screens.
 */

const ET_ZONE = 'America/New_York';
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Hour of day (ET) of the caption-lockout reopen boundary — and the latest
 * possible live-season score drop (a Pacific-westernmost night). Kept at 2 AM
 * to mirror functions/src/helpers/captionWindows.js.
 */
export const SCORES_PROCESS_HOUR_ET = 2;

/** Hour of day (ET) when off-season scores drop (fixed, year-round). */
export const OFF_SEASON_DROP_HOUR_ET = 21;

/** Earliest possible live-season drop: 11 PM ET (Eastern-only show night). */
export const LIVE_EARLIEST_DROP_HOUR_ET = 23;

/** Competition weeks in a season. */
export const TOTAL_SEASON_WEEKS = 7;

/** Caption changes allowed per week per class on days 15-42 (backend tradeLimit). */
export const WEEKLY_TRADE_LIMIT = 3;

/** Caption changes allowed per class per day during Championship Week (days 45-49). */
export const CHAMPIONSHIP_TRADE_LIMIT = 2;

/** Last competition day with unlimited caption changes. */
export const UNLIMITED_THROUGH_DAY = 14;

/** No caption changes at all on these competition days. */
export const BLACKOUT_DAYS = [43, 44];

/** First day of Championship Week. */
export const CHAMPIONSHIP_START_DAY = 45;

/**
 * Which classes still compete — and may therefore change captions — on each
 * Championship Week day (mirrors functions/src/helpers/captionWindows.js).
 * A class absent from its day's list is done for the season and locked out.
 *   - Days 45-46: Open Class & A Class.
 *   - Day 47:     all classes.
 *   - Days 48-49: World Class & SoundSport (Finals).
 */
export const CHAMPIONSHIP_CLASS_DAYS = {
  45: ['openClass', 'aClass'],
  46: ['openClass', 'aClass'],
  47: ['worldClass', 'openClass', 'aClass', 'soundSport'],
  48: ['worldClass', 'soundSport'],
  49: ['worldClass', 'soundSport'],
};

/** Final competition day of a season. */
export const SEASON_FINAL_DAY = 49;

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
 * Next occurrence of an ET wall-clock hour, rolling to tomorrow if today's
 * instance already passed.
 * @param {number} hour - 0-23 (ET)
 * @param {Date} [now]
 * @returns {Date}
 */
function nextEasternHour(hour, now = new Date()) {
  const today = easternParts(now);
  let target = easternWallTimeToDate(today.year, today.month, today.day, hour);
  if (target.getTime() <= now.getTime()) {
    const tomorrow = easternParts(new Date(now.getTime() + DAY_MS));
    target = easternWallTimeToDate(tomorrow.year, tomorrow.month, tomorrow.day, hour);
  }
  return target;
}

/**
 * Next caption-lockout reopen boundary (02:00 ET). Also the latest possible
 * live-season score drop. NOT the score-drop time itself — use
 * getScoreDropEstimate / the drop_plans doc for that.
 * @param {Date} [now]
 * @returns {Date}
 */
export function getNextScoresProcessingTime(now = new Date()) {
  return nextEasternHour(SCORES_PROCESS_HOUR_ET, now);
}

/**
 * Schedule-free estimate of the next score drop.
 *
 * Off-season drops are a fixed 9 PM ET, so the estimate is exact. Live-season
 * drops depend on the night's westernmost show (11 PM–2 AM ET; the backend
 * publishes tonight's exact instant to drop_plans/{date} from ~8 PM ET) — so
 * the estimate is the conservative 2 AM ET upper bound, marked inexact, and
 * hooks/useSeasonClock overlays the plan doc when it exists.
 *
 * @param {Object|null} seasonData - Season doc (needs status); null tolerated.
 * @param {Date} [now]
 * @returns {{at: Date, exact: boolean}}
 */
export function getScoreDropEstimate(seasonData, now = new Date()) {
  if (seasonData?.status === 'off-season') {
    return { at: nextEasternHour(OFF_SEASON_DROP_HOUR_ET, now), exact: true };
  }
  return { at: nextEasternHour(SCORES_PROCESS_HOUR_ET, now), exact: false };
}

/**
 * Tonight's show-date key (YYYY-MM-DD, ET) — the drop_plans/{date} doc id.
 * Mirrors the backend's 3-hour show-day reset (functions/src/helpers/
 * dropPlanner.js showDateFor): the whole 11 PM–2:45 AM drop window belongs
 * to the calendar date the shows were held.
 * @param {Date} [now]
 * @returns {string}
 */
export function getShowDateKey(now = new Date()) {
  const shifted = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const p = easternParts(shifted);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * The LATEST instant show registration can close: 02:00 ET the day after the
 * show — the last possible moment that night's scores can process. Use for
 * "is this show definitely past?" checks (scheduleUtils.isEventPast). For the
 * player-facing "change attendance until..." message, use
 * getShowRegistrationCloseEstimate — scores usually process earlier.
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
 * The EARLIEST instant a show's registration can close — when that night's
 * scores may start processing. Off-season: 9 PM ET on the show date (exact).
 * Live season: 11 PM ET on the show date (an Eastern-only night; western
 * shows push the actual drop later, so this is the safe bound to promise).
 * @param {Date|null} eventDate - Local-midnight Date for the show's calendar day
 * @param {Object|null} seasonData - Season doc (needs status)
 * @returns {{at: Date, exact: boolean}|null}
 */
export function getShowRegistrationCloseEstimate(eventDate, seasonData) {
  if (!eventDate || Number.isNaN(eventDate.getTime())) return null;
  const year = String(eventDate.getFullYear());
  const month = String(eventDate.getMonth() + 1).padStart(2, '0');
  const day = String(eventDate.getDate()).padStart(2, '0');
  if (seasonData?.status === 'off-season') {
    return { at: easternWallTimeToDate(year, month, day, OFF_SEASON_DROP_HOUR_ET), exact: true };
  }
  return { at: easternWallTimeToDate(year, month, day, LIVE_EARLIEST_DROP_HOUR_ET), exact: false };
}

/**
 * The caption-change window for a given instant.
 *
 * Replicates the backend rules exactly (functions/src/helpers/captionWindows.js,
 * enforced by saveLineup) — keep the two in sync:
 *   - Days 1-14: unlimited changes, ending at the day-14 boundary (8 PM ET
 *     during EDT).
 *   - Days 15-42: 3 changes per week per class, spendable one at a time or
 *     all at once.
 *   - Every Saturday 8 PM ET (end of days 7/14/21/28/35/42): changes lock
 *     until the 2 AM ET reopen boundary (that night's scores are final by
 *     then — they drop earlier, but the lock holds until 2 AM).
 *   - Days 43-44: no changes at all.
 *   - Days 45-49 (Championship Week): 2 changes per day for each class still
 *     competing that day (the allotment resets every competition day); changes
 *     close at the 8 PM ET boundary each day and reopen at 2 AM ET.
 *     Only Open/A compete Days 45-46, all classes Day 47, and World/SoundSport
 *     the Days 48-49 Finals — a class not competing is locked out (pass
 *     corpsClass to surface that; omit for a class-agnostic window).
 *
 * Days are 24h blocks measured in raw milliseconds from schedule.startDate,
 * with spring-training days excluded before competition Day 1. The client
 * treats a lockout as ending at the 2 AM ET processing run; the backend
 * additionally waits for the day's recap to actually exist.
 *
 * @param {Object} seasonData - Season doc (needs schedule.startDate)
 * @param {Date} [now]
 * @param {string|null} [corpsClass] - Canonical class id. When provided, the
 *   Championship-day class lockout (a class that no longer competes) is
 *   applied; omit for a class-agnostic window.
 * @returns {{
 *   day: number,
 *   week: number,
 *   phase: 'unlimited'|'weekly'|'blackout'|'championship'|'complete',
 *   status: 'open'|'locked'|'closed',
 *   tradeLimit: number,
 *   periodKey: number,
 *   isUnlimited: boolean,
 *   unlimitedEndsAt: Date|null,
 *   locksAt: Date|null,
 *   reopensAt: Date|null,
 *   resetsAt: Date|null,
 *   nextLimit: number|null,
 * }|null} null when the season has no start date
 */
export function getCaptionChangeInfo(seasonData, now = new Date(), corpsClass = null) {
  const startTs = seasonData?.schedule?.startDate;
  if (!startTs) return null;
  const startDate = typeof startTs.toDate === 'function' ? startTs.toDate() : new Date(startTs);
  if (Number.isNaN(startDate.getTime())) return null;

  const springTrainingDays = seasonData.schedule.springTrainingDays || 0;
  const dayStart = (d) => new Date(startDate.getTime() + (springTrainingDays + d - 1) * DAY_MS);
  const day = Math.floor((now.getTime() - startDate.getTime()) / DAY_MS) + 1 - springTrainingDays;
  const week = Math.max(1, Math.ceil(day / 7));
  // Lockouts end at the 2 AM ET reopen boundary after a lock (scores drop
  // earlier under the timezone-aware pipeline, but the backend holds the
  // lock until 2 AM AND the recap exists — captionWindows.js).
  const reopenAfter = (d) => getNextScoresProcessingTime(dayStart(d));

  const base = {
    day,
    week,
    tradeLimit: WEEKLY_TRADE_LIMIT,
    periodKey: week,
    isUnlimited: false,
    unlimitedEndsAt: null,
    locksAt: null,
    reopensAt: null,
    resetsAt: null,
    nextLimit: null,
  };

  if (day > SEASON_FINAL_DAY) {
    return { ...base, phase: 'complete', status: 'closed', tradeLimit: 0 };
  }

  if (BLACKOUT_DAYS.includes(day)) {
    const opensAt = reopenAfter(CHAMPIONSHIP_START_DAY);
    return {
      ...base,
      phase: 'blackout',
      status: 'closed',
      tradeLimit: 0,
      reopensAt: opensAt,
      resetsAt: opensAt,
      nextLimit: CHAMPIONSHIP_TRADE_LIMIT,
    };
  }

  if (day >= CHAMPIONSHIP_START_DAY) {
    // Only classes competing that day may change (per CHAMPIONSHIP_CLASS_DAYS).
    // A class that's finished for the season is closed out; the class-agnostic
    // call (no corpsClass) reports the general window instead.
    const competingClasses = CHAMPIONSHIP_CLASS_DAYS[day] || [];
    const classClosed = corpsClass != null && !competingClasses.includes(corpsClass);
    if (classClosed) {
      return {
        ...base,
        phase: 'championship',
        status: 'closed',
        tradeLimit: 0,
        periodKey: day,
      };
    }

    const opensAt = reopenAfter(day);
    const locked = now.getTime() < opensAt.getTime();
    return {
      ...base,
      phase: 'championship',
      status: locked ? 'locked' : 'open',
      tradeLimit: CHAMPIONSHIP_TRADE_LIMIT,
      periodKey: day,
      reopensAt: locked ? opensAt : null,
      locksAt: locked ? null : dayStart(day + 1),
    };
  }

  // Days 1-42 (day < 1 is spring training / pre-season: unlimited, no lock).
  // Weeks begin on days 8, 15, 22, 29, 36 — the morning after a Saturday
  // 8 PM ET close — and stay locked until the 2 AM ET reopen boundary.
  const isWeekStartDay = day > 1 && day % 7 === 1;
  const opensAt = isWeekStartDay ? reopenAfter(day) : null;
  const locked = opensAt !== null && now.getTime() < opensAt.getTime();
  const isUnlimited = day <= UNLIMITED_THROUGH_DAY;

  // When the next fresh allotment becomes usable, and how big it is.
  const resets = isUnlimited
    ? { at: reopenAfter(UNLIMITED_THROUGH_DAY + 1), limit: WEEKLY_TRADE_LIMIT }
    : week < 6
      ? { at: reopenAfter(week * 7 + 1), limit: WEEKLY_TRADE_LIMIT }
      : { at: reopenAfter(CHAMPIONSHIP_START_DAY), limit: CHAMPIONSHIP_TRADE_LIMIT };

  return {
    ...base,
    phase: isUnlimited ? 'unlimited' : 'weekly',
    status: locked ? 'locked' : 'open',
    tradeLimit: isUnlimited ? Infinity : WEEKLY_TRADE_LIMIT,
    isUnlimited,
    unlimitedEndsAt: isUnlimited ? dayStart(UNLIMITED_THROUGH_DAY + 1) : null,
    locksAt: locked ? null : dayStart(week * 7 + 1),
    reopensAt: locked ? opensAt : null,
    resetsAt: resets.at,
    nextLimit: resets.limit,
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
