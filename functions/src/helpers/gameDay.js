/**
 * Game-day date math shared by the nightly scoring processors and the admin
 * manual trigger. This logic was previously copy-pasted in three places
 * (dailyProcessors.js, scoring.js, admin.js), so a DST or boundary fix had to
 * be made three times. It lives here once now.
 *
 * The game-day boundary is SEASON-TYPE-AWARE (the "score drop" redesign):
 *
 *   - Live season: game days reset at 2 AM ET. The scheduler fires at 2 AM
 *     and scores the game day that just ended ("yesterday") — real West Coast
 *     DCI shows post scores after 1 AM ET, so the run can't be earlier.
 *   - Off-season: game days end at 9 PM ET and scores run the SAME evening
 *     (the 21:00 processor scores that calendar date's shows). Historical
 *     data is available all day, so the drop moves to prime time and becomes
 *     the nightly reveal event.
 *
 * Everything keyed to "the game day" (scoring, Podium rehearsal days,
 * challenge/prediction buckets, league pools) shares this boundary via the
 * helpers below — pass the season status so all of them roll together.
 * Callers that omit the status get the live-season behavior, which matches
 * every pre-redesign call site.
 *
 * We use Intl.DateTimeFormat to reliably get the current Eastern wall-clock
 * time, which correctly handles DST transitions (unlike a toLocaleString
 * round-trip, which loses timezone context when re-parsed by new Date()).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Live season: shift back 2h then take the previous calendar date — a run in
// the 12-2 AM window still belongs to the previous game day.
const LIVE_RESET_SHIFT_HOURS = 2;
// Off-season: shift FORWARD 3h then take the previous calendar date — at/after
// 9 PM ET the just-ended game day is TODAY's date (scored this evening), and
// before 9 PM it is yesterday's.
const OFF_SEASON_RESET_SHIFT_HOURS = -3;

/**
 * The reset shift for a season status. Exported for the mirrors' tests.
 * @param {string|null|undefined} seasonStatus - game-settings/season `status`
 *   ("live-season" | "off-season"); anything else behaves like live season.
 * @returns {number} hours to shift back before taking the calendar date
 */
function resetShiftHours(seasonStatus) {
  return seasonStatus === "off-season" ? OFF_SEASON_RESET_SHIFT_HOURS : LIVE_RESET_SHIFT_HOURS;
}

/**
 * The game day that just ended, as a Date at UTC midnight whose calendar
 * date equals the Eastern game date. (The value is only used for calendar
 * arithmetic against a UTC-midnight season start date.)
 *
 * @param {Date} [now] - Injectable clock for tests; defaults to now.
 * @param {string} [seasonStatus] - "off-season" ends game days at 9 PM ET
 *   (same-evening scoring); anything else uses the live 2 AM ET reset.
 * @returns {Date}
 */
function getCompletedGameDayET(now = new Date(), seasonStatus = undefined) {
  const etParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const etValues = {};
  for (const part of etParts) etValues[part.type] = part.value;

  // Build a UTC Date that represents the ET wall-clock time (arithmetic only).
  // Some ICU versions report midnight as hour "24" in h23 mode.
  const nowET = new Date(Date.UTC(
    parseInt(etValues.year),
    parseInt(etValues.month) - 1,
    parseInt(etValues.day),
    parseInt(etValues.hour === "24" ? "0" : etValues.hour),
    parseInt(etValues.minute),
    parseInt(etValues.second),
  ));

  // Shift by the reset offset so e.g. 1 AM on Jan 5 is still Jan 4's game day
  // (live), or so 9:30 PM on Jan 5 has already completed Jan 5 (off-season).
  const gameTimeET = new Date(nowET.getTime() - resetShiftHours(seasonStatus) * 60 * 60 * 1000);
  const yesterday = new Date(gameTimeET);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);
  return yesterday;
}

/**
 * 1-based calendar day of the just-ended game day, counted from the season
 * start date. Day 1 is the season's first calendar day; callers subtract any
 * spring-training offset themselves and validate the resulting range.
 *
 * seasonStartDate is stored at midnight UTC (see getNextOffSeasonWindow), so
 * it must be normalized on the UTC calendar. Reading it via the ET timezone
 * would shift winter UTC-midnight dates back one day (midnight UTC = previous
 * evening in EST), making the day one too high — e.g. Semifinals (day 48)
 * mislabeled as Finals (day 49).
 *
 * @param {Date} seasonStartDate - Season start (UTC midnight).
 * @param {Date} [now] - Injectable clock for tests; defaults to now.
 * @param {string} [seasonStatus] - See getCompletedGameDayET.
 * @returns {number}
 */
function getCompletedCalendarDay(seasonStartDate, now = new Date(), seasonStatus = undefined) {
  const completedGameDay = getCompletedGameDayET(now, seasonStatus);
  const seasonStartNormalized = new Date(Date.UTC(
    seasonStartDate.getUTCFullYear(),
    seasonStartDate.getUTCMonth(),
    seasonStartDate.getUTCDate(),
    0, 0, 0,
  ));
  const diffInMillis = completedGameDay.getTime() - seasonStartNormalized.getTime();
  return Math.floor(diffInMillis / MS_PER_DAY) + 1;
}

/**
 * 1-based competition week for a season doc, computed from the schedule
 * dates (there is no persisted currentWeek field — jobs that read one were
 * dead paths). Live seasons subtract spring training so competition Day 1
 * starts week 1; off-seasons have no spring training (field absent -> 0).
 *
 * @param {Object} seasonData - game-settings/season doc data.
 * @param {Date} [now] - Injectable clock for tests; defaults to now.
 * @returns {number|null} Week number (≥1), or null if the season doc has no
 *   usable start date.
 */
function getCurrentSeasonWeek(seasonData, now = new Date()) {
  const rawStart = seasonData?.schedule?.startDate;
  const startDate =
    rawStart && typeof rawStart.toDate === "function" ? rawStart.toDate() : rawStart;
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) return null;

  const diffInDays = Math.floor((now - startDate) / MS_PER_DAY);
  const springTrainingDays = seasonData?.schedule?.springTrainingDays || 0;
  return Math.max(1, Math.ceil((diffInDays + 1 - springTrainingDays) / 7));
}

/**
 * 1-based calendar day of the game day currently IN PROGRESS (Phase 1.3).
 * The nightly processors score the completed day; interactive verbs (Podium
 * rehearsal block allocation) act on the active one — always exactly
 * completed + 1 because both share the same season-aware boundary (2 AM ET
 * live, 9 PM ET off-season). Server-side validation for "today" MUST use
 * this, never client-supplied days (PODIUM.md §14.2.4).
 *
 * @param {Date} seasonStartDate - Season start (UTC midnight).
 * @param {Date} [now] - Injectable clock for tests; defaults to now.
 * @param {string} [seasonStatus] - See getCompletedGameDayET.
 * @returns {number}
 */
function getActiveCalendarDay(seasonStartDate, now = new Date(), seasonStatus = undefined) {
  return getCompletedCalendarDay(seasonStartDate, now, seasonStatus) + 1;
}

/**
 * Map a calendar day to a competition day by removing the season's
 * spring-training offset (live seasons only; off-seasons have none).
 * Values <1 mean spring training; >49 means the season is over.
 *
 * @param {number} calendarDay
 * @param {Object} seasonData - game-settings/season doc data.
 * @returns {number}
 */
function toCompetitionDay(calendarDay, seasonData) {
  const springTrainingDays =
    seasonData?.status === "live-season" ? seasonData?.schedule?.springTrainingDays || 21 : 0;
  return calendarDay - springTrainingDays;
}

module.exports = {
  getCompletedGameDayET,
  getCompletedCalendarDay,
  getActiveCalendarDay,
  toCompetitionDay,
  getCurrentSeasonWeek,
  resetShiftHours,
};
