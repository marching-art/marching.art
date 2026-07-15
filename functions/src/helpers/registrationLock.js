/**
 * Registration-lock rule — the "calendar limitation on setting up a corps for
 * each class."
 *
 * Each class closes new-corps registration a fixed number of weeks before
 * finals (classRegistry registrationLockWeeks: World 6, Open 5, A 4,
 * SoundSport 0) so a director can't enter a class with too little season left
 * to field a competitive run.
 *
 * The window is measured BACKWARD from schedule.endDate, which is why it is
 * inherently spring-training aware: the 21-day spring-training period sits
 * BEFORE competition Day 1, so "weeks remaining" only ever counts down toward
 * finals and never mistakes spring-training days for competition weeks. (During
 * spring training the count is at its maximum and above every lock threshold,
 * so a class can never lock early because of it.)
 *
 * Single source of truth shared by registerCorps and processCorpsDecisions so
 * both entrypoints enforce the same rule with the same wording.
 */

const { REGISTRATION_LOCK_WEEKS } = require("./classRegistry");

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whole calendar weeks (rounded up) from `now` until the season ends, or null
 * when the season has no end date.
 * @param {Object} seasonData - game-settings/season doc.
 * @param {Date} [now]
 * @returns {number|null}
 */
function weeksUntilSeasonEnd(seasonData, now = new Date()) {
  const endTs = seasonData?.schedule?.endDate;
  const end = endTs?.toDate ? endTs.toDate() : endTs ? new Date(endTs) : null;
  if (!end || Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - now.getTime()) / WEEK_MS);
}

/**
 * Registration-lock state for setting up a corps in `corpsClass`.
 * @param {Object} seasonData - game-settings/season doc.
 * @param {string} corpsClass - Canonical class id.
 * @param {Date} [now]
 * @returns {{locked: boolean, lockWeeks: number, weeksRemaining: number|null}}
 */
function getRegistrationLock(seasonData, corpsClass, now = new Date()) {
  const lockWeeks = REGISTRATION_LOCK_WEEKS[corpsClass] || 0;
  const weeksRemaining = weeksUntilSeasonEnd(seasonData, now);
  const locked = lockWeeks > 0 && weeksRemaining !== null && weeksRemaining < lockWeeks;
  return { locked, lockWeeks, weeksRemaining };
}

/**
 * Player-facing explanation of why a class is registration-locked.
 * @param {string} corpsClass - Canonical class id.
 * @param {number} lockWeeks
 * @param {number|null} weeksRemaining
 * @returns {string}
 */
function registrationLockMessage(corpsClass, lockWeeks, weeksRemaining) {
  const left =
    weeksRemaining === null
      ? ""
      : ` Only ${weeksRemaining} week${weeksRemaining === 1 ? "" : "s"} remain this season.`;
  return (
    `Registration for ${corpsClass} is closed. Each class locks a set number of ` +
    `weeks before finals (${corpsClass} locks ${lockWeeks} weeks out) so a new corps ` +
    `has enough season left to compete.${left} You can set one up when the next season opens.`
  );
}

module.exports = { weeksUntilSeasonEnd, getRegistrationLock, registrationLockMessage };
