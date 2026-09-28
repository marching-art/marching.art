/**
 * Per-night show-registration lock for the fantasy classes.
 *
 * Registration for a night's shows closes the moment that night's scores run
 * — NOT at the 2 AM ET game-day rollover. Off-season scores drop at 9 PM ET,
 * so keying the lock to the rollover left a five-hour window in which a
 * director could join or withdraw from a show that had already been scored
 * (selectUserShows only rejected past WEEKS). A night is locked when any of:
 *
 *   1. the 2 AM ET rollover has passed it (it is strictly before the active
 *      competition day — scored, or it had nothing to score);
 *   2. tonight's planned drop instant has arrived (helpers/dropPlanner.js —
 *      the same pure plan the dispatcher scores on and publishes to
 *      drop_plans/{date}: 9 PM ET off-season, the westernmost-show ladder in
 *      the live season). A night held past its drop waiting on dci.org stays
 *      locked — scoring has begun;
 *   3. its fantasy recap already exists (an admin/manual run, or any path
 *      that scored ahead of the plan).
 *
 * Mirrored on the client by src/utils/seasonClock.js
 * (getShowRegistrationLockTime) so the schedule greys a show out at the same
 * instant this starts rejecting it.
 */

const { getActiveCompetitionDay } = require("./gameDay");
const { planDrop } = require("./dropPlanner");

/**
 * Competition days in `week` whose show registration is locked.
 *
 * @param {{
 *   db: FirebaseFirestore.Firestore,
 *   seasonData: any,
 *   competitions: Array<Object>,
 *   week: number,
 *   now?: Date,
 * }} params
 * @returns {Promise<Set<number>>}
 */
async function getLockedRegistrationDays({ db, seasonData, competitions, week, now = new Date() }) {
  /** @type {Set<number>} */
  const locked = new Set();
  const activeDay = getActiveCompetitionDay(seasonData, now);
  if (activeDay == null) return locked;

  const weekStart = (week - 1) * 7 + 1;
  const weekEnd = week * 7;
  const inWeek = (/** @type {number} */ day) => day >= weekStart && day <= weekEnd;

  // 1. Every night the rollover has passed.
  for (let day = weekStart; day <= Math.min(weekEnd, activeDay - 1); day++) locked.add(day);

  // 2. Tonight, once its drop instant arrives.
  const plan = planDrop({ seasonData, competitions, now });
  if (plan && inWeek(plan.competitionDay) && now.getTime() >= plan.dropInstant.getTime()) {
    locked.add(plan.competitionDay);
  }

  // 3. Tonight, if it has already been scored by any path.
  if (inWeek(activeDay) && !locked.has(activeDay) && seasonData?.seasonUid) {
    const recap = await db.doc(`fantasy_recaps/${seasonData.seasonUid}/days/${activeDay}`).get();
    if (recap.exists) locked.add(activeDay);
  }

  return locked;
}

module.exports = { getLockedRegistrationDays };
