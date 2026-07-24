// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
/**
 * Game-day date math shared by the nightly scoring processors and the admin
 * manual trigger. This logic was previously copy-pasted in three places
 * (dailyProcessors.js, scoring.js, admin.js), so a DST or boundary fix had to
 * be made three times. It lives here once now.
 *
 * Game days reset at 2 AM Eastern: the scheduler fires at 2 AM ET and scores
 * the game day that just ended ("yesterday"). We use Intl.DateTimeFormat to
 * reliably get the current Eastern wall-clock time, which correctly handles
 * DST transitions (unlike a toLocaleString round-trip, which loses timezone
 * context when re-parsed by new Date()).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Game days roll over at 2 AM ET, not midnight, so a run in the 12-2 AM
// window still belongs to the previous game day.
const GAME_DAY_RESET_HOURS = 2;

/**
 * The game day that just ended, as a Date at UTC midnight whose calendar
 * date equals the Eastern game date. (The value is only used for calendar
 * arithmetic against a UTC-midnight season start date.)
 *
 * @param {Date} [now] - Injectable clock for tests; defaults to now.
 * @returns {Date}
 */
function getCompletedGameDayET(now = new Date()) {
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

  // Shift by the reset offset so e.g. 1 AM on Jan 5 is still Jan 4's game day.
  const gameTimeET = new Date(nowET.getTime() - GAME_DAY_RESET_HOURS * 60 * 60 * 1000);
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
 * @returns {number}
 */
function getCompletedCalendarDay(seasonStartDate, now = new Date()) {
  const completedGameDay = getCompletedGameDayET(now);
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
 * The week is derived from the game day currently IN PROGRESS
 * (getActiveCalendarDay), so it rolls at the same 2 AM ET boundary as
 * everything else in this file and as weekly settlement (scoring.js). It
 * previously counted raw UTC days, which flipped at 8 PM ET (EDT) / 7 PM ET
 * (EST) — inside the window where the Sunday 11:59 PM ET matchup generator
 * (leagueAutomation.js) runs, making it disagree with the Monday 8 AM push
 * job by a full week.
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

  const activeDay = getActiveCalendarDay(startDate, now);
  const springTrainingDays = seasonData?.schedule?.springTrainingDays || 0;
  return Math.max(1, Math.ceil((activeDay - springTrainingDays) / 7));
}

/**
 * 1-based calendar day of the game day currently IN PROGRESS (Phase 1.3).
 * The nightly processors score the completed day; interactive verbs (Podium
 * rehearsal block allocation) act on the active one — always exactly
 * completed + 1 because both share the 2 AM ET boundary. Server-side
 * validation for "today" MUST use this, never client-supplied days
 * (PODIUM.md §14.2.4).
 *
 * @param {Date} seasonStartDate - Season start (UTC midnight).
 * @param {Date} [now] - Injectable clock for tests; defaults to now.
 * @returns {number}
 */
function getActiveCalendarDay(seasonStartDate, now = new Date()) {
  return getCompletedCalendarDay(seasonStartDate, now) + 1;
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

// Podium processes at 9 PM ET under the timezone-aware pipeline
// (scheduled/dropDispatcher.js podiumNightly).
const PODIUM_PROCESS_HOUR_ET = 21;

/**
 * The calendar day Podium's interactive verbs should act on.
 *
 * Under the legacy pipeline (dropSchedulingEnabled=false) this is the plain
 * 2 AM-reset active day, unchanged. Under the timezone-aware pipeline,
 * Podium's nightly processing runs at 9 PM ET and ends its own state.today
 * forward (processor.js sets today = calendarDay + 1) — so the active day
 * must roll at 9 PM too: after tonight's run, verbs act on TOMORROW. Leaving
 * the 2 AM boundary in place would make a 9:30 PM verb request the
 * already-processed day, and rollToday would rebuild it with a fresh block
 * allotment whose spends are silently discarded at the next roll.
 *
 * @param {Date} seasonStartDate - Season start (UTC midnight).
 * @param {boolean} [dropSchedulingEnabled] - features.dropScheduling.
 * @param {Date} [now] - Injectable clock for tests.
 * @returns {number}
 */
function getActivePodiumCalendarDay(seasonStartDate, dropSchedulingEnabled = false, now = new Date()) {
  if (!dropSchedulingEnabled) return getActiveCalendarDay(seasonStartDate, now);

  const etParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const etValues = {};
  for (const part of etParts) etValues[part.type] = part.value;
  // Some ICU versions report midnight as hour "24" in h23 mode.
  const hour = parseInt(etValues.hour === "24" ? "0" : etValues.hour);
  const dayShift = hour >= PODIUM_PROCESS_HOUR_ET ? 1 : 0;
  const etDateUtc = Date.UTC(
    parseInt(etValues.year),
    parseInt(etValues.month) - 1,
    parseInt(etValues.day) + dayShift,
    0, 0, 0,
  );
  const startNormalized = Date.UTC(
    seasonStartDate.getUTCFullYear(),
    seasonStartDate.getUTCMonth(),
    seasonStartDate.getUTCDate(),
    0, 0, 0,
  );
  return Math.floor((etDateUtc - startNormalized) / MS_PER_DAY) + 1;
}

module.exports = {
  getCompletedGameDayET,
  getCompletedCalendarDay,
  getActiveCalendarDay,
  getActivePodiumCalendarDay,
  toCompetitionDay,
  getCurrentSeasonWeek,
  PODIUM_PROCESS_HOUR_ET,
};
