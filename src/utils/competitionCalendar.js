/**
 * Competition calendar — the single source for mapping a competition day
 * number (1–49) onto the real calendar date it falls on.
 *
 * A live season opens with a spring-training period (`schedule.springTrainingDays`,
 * 21 for live seasons) BEFORE competition Day 1. So competition Day N lands on:
 *
 *     startDate + springTrainingDays + (N - 1)
 *
 * Off-seasons carry no spring training (field absent -> 0), so the offset is a
 * no-op there. Omitting it dates every show/recap ~3 weeks early, which made
 * still-upcoming shows read as "past" in the setup wizard.
 *
 * This module is the ONE place that offset lives on the client. It was
 * previously copy-pasted into Schedule.jsx, ShowSelectionStep.jsx,
 * ScoresSpreadsheet.jsx and useScoresData.js; those now all call in here.
 *
 * NOTE: this converts a day NUMBER to a calendar DATE (midnight). The inverse
 * ("what competition day/time is it right now", plus per-day deadline instants)
 * lives in utils/seasonProgress.ts and utils/seasonClock.js — those need
 * millisecond precision and a 2 AM ET reset, a different concern from calendar
 * dates, so they intentionally stay separate.
 */

/**
 * Coerce a Firestore Timestamp, a Date, or a millisecond value into a Date.
 * @param {*} value
 * @returns {Date|null} null when the value can't be read as a valid date.
 */
function toDate(value) {
  if (!value) return null;
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

/** Spring-training days for a schedule (0 when absent, e.g. off-seasons). */
export function getSpringTrainingDays(schedule) {
  return schedule?.springTrainingDays || 0;
}

/**
 * The calendar date on which competition Day `dayNumber` takes place.
 *
 * Returns a LOCAL-midnight Date built from `startDate`'s UTC calendar parts, so
 * weekday/month/day formatting in local time reflects the intended calendar
 * date in every timezone. (`startDate` is stored at UTC midnight; reading it
 * with local getters would land on the previous evening in negative-UTC-offset
 * zones and shift every day one early.)
 *
 * @param {Object|null|undefined} schedule - `game-settings/season`'s
 *   `schedule` object: `{ startDate, springTrainingDays }`. `startDate` may be a
 *   Firestore Timestamp, a Date, or a millisecond value.
 * @param {number} dayNumber - Competition day (1–49).
 * @returns {Date|null} null when the schedule has no usable start date.
 */
export function competitionDayToDate(schedule, dayNumber) {
  const startDate = toDate(schedule?.startDate);
  if (!startDate || !Number.isFinite(dayNumber)) return null;
  return new Date(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate() + getSpringTrainingDays(schedule) + dayNumber - 1
  );
}

/**
 * Convenience formatter: the competition day's calendar date as a localized
 * string, or a fallback when the date can't be resolved.
 *
 * @param {Object|null|undefined} schedule - see competitionDayToDate.
 * @param {number} dayNumber - Competition day (1–49).
 * @param {Intl.DateTimeFormatOptions} [options] - toLocaleDateString options.
 * @param {string} [fallback] - Returned when no date is available (default `Day N`).
 * @returns {string}
 */
export function formatCompetitionDate(schedule, dayNumber, options, fallback) {
  const date = competitionDayToDate(schedule, dayNumber);
  if (!date) return fallback ?? `Day ${dayNumber}`;
  return date.toLocaleDateString('en-US', options);
}
