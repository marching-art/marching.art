/**
 * The rehearsal's clock.
 *
 * Nearly everything in the nightly pipeline derives "what day is it" from the
 * season document's start date against the wall clock, through the 2 AM ET game
 * day reset in helpers/gameDay.js. Rather than fake timers — which would not
 * reach inside Intl.DateTimeFormat, and would drift from what the real jobs do
 * — the rehearsal moves the SEASON instead: before each day is played, the
 * start date is re-pinned so that the day just completed is the day we want
 * scored.
 *
 * That keeps every derivation honest. getCompletedCalendarDay, the week math
 * the matchup generator pairs on, and the recap dates the scorer stamps all run
 * their real code against a real clock; only the season's origin moves.
 *
 * Show dates inside `schedules/{seasonUid}` are deliberately NOT re-pinned:
 * scoring matches a director's selected shows to a day's schedule by event name
 * (helpers/scoring.js is explicit that dates carry type mismatches), and the
 * day's shows are selected by `comp.day`. Nothing in the scoring path reads
 * those dates, so leaving them fixed keeps the seeded schedule stable.
 */

const admin = require("firebase-admin");
const { getCompletedGameDayET } = require("../src/helpers/gameDay");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Re-pin the season so `competitionDay` is the day that just ended.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {number} competitionDay - 1-49.
 * @param {{springTrainingDays: number}} world
 * @returns {Promise<Date>} the season start date now stored.
 */
async function pinToCompletedDay(db, competitionDay, world) {
  const calendarDay = world.springTrainingDays + competitionDay;
  const completed = getCompletedGameDayET(new Date());
  const startDate = new Date(completed.getTime() - (calendarDay - 1) * MS_PER_DAY);
  await db.doc("game-settings/season").update({
    "schedule.startDate": admin.firestore.Timestamp.fromDate(startDate),
  });
  return startDate;
}

/**
 * Move the season's end date into the past so the season scheduler treats it as
 * finished. This is the condition rollover actually waits on
 * (scheduled/seasonScheduler.js: `now < seasonEndDate` means no action), so the
 * rehearsal reproduces it rather than calling the rollover blind.
 *
 * @param {FirebaseFirestore.Firestore} db
 */
async function expireSeason(db) {
  const endDate = new Date(Date.now() - MS_PER_DAY);
  await db.doc("game-settings/season").update({
    "schedule.endDate": admin.firestore.Timestamp.fromDate(endDate),
  });
  return endDate;
}

module.exports = { pinToCompletedDay, expireSeason, MS_PER_DAY };
