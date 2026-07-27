/**
 * Play the season through the real pipeline.
 *
 * Every call in here is a production entry point — the nightly live-season
 * scorer, the daily matchup generator, the Monday recap and rivalry jobs, and
 * the season scheduler's rollover. The rehearsal's only liberties are the clock
 * (clock.js) and the fact that a day is played the moment the one before it
 * finishes instead of 24 hours later.
 *
 * Ordering within a day mirrors production: the 2 AM scorer settles the day that
 * just ended, then the 6 AM generator ensures matchups for the day now in
 * progress. Getting that backwards would hide exactly the class of bug the
 * rehearsal is looking for, since week 1 pairs off an empty table.
 */

const functionsTest = require("firebase-functions-test")();
const { pinToCompletedDay, expireSeason } = require("./clock");

/**
 * Run every competition day, then roll the season over.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} world - the seeded world (world.js seedWorld return value).
 * @param {{onDay?: (day: number, result: Object) => void, log?: Function}} [hooks]
 * @returns {Promise<{days: Array<Object>, rollover: Object}>}
 */
async function playSeason(db, world, { onDay = () => {}, log = () => {} } = {}) {
  const scoring = require("../src/helpers/scoring");
  const leagueAutomation = require("../src/scheduled/leagueAutomation");
  const generateMatchups = functionsTest.wrap(leagueAutomation.generateWeeklyMatchups);
  const generateRecaps = functionsTest.wrap(leagueAutomation.generateWeeklyRecaps);
  const updateRivalries = functionsTest.wrap(leagueAutomation.updateLeagueRivalries);

  const days = [];

  for (let day = 1; day <= 49; day++) {
    await pinToCompletedDay(db, day, world);
    const seasonData = (await db.doc("game-settings/season").get()).data();

    const result = await scoring.processAndScoreLiveSeasonDayLogic(day, seasonData);
    days.push({ day, ...result });
    onDay(day, result);

    // The 6 AM generator, ensuring the week now in progress and the next one.
    await generateMatchups({});

    // Monday's league jobs, on the day after a week resolves.
    if (day % 7 === 0) {
      await generateRecaps({});
      await updateRivalries({});
    }
  }

  log("season played; expiring it so the scheduler rolls over");

  // The rollover the season scheduler performs once the end date passes. Called
  // through the same helper the scheduler calls, with the same precondition
  // (an expired season doc) established first.
  await expireSeason(db);
  const season = require("../src/helpers/season");
  const before = (await db.doc("game-settings/season").get()).data();
  await season.startNewOffSeason();
  const after = (await db.doc("game-settings/season").get()).data();

  return {
    days,
    rollover: {
      oldSeasonUid: before.seasonUid,
      newSeasonUid: after.seasonUid,
      newSeasonStatus: after.status,
    },
  };
}

/**
 * Re-run the rollover a second time.
 *
 * Scheduler redelivery is normal, and the whole archival path is built to be
 * idempotent per league (champions[]) and per season (the season_rollovers
 * lease). This is what proves it: a second rollover must not re-pay a prize
 * pool, re-mint the champion achievement, or re-increment totalSeasons.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{seasonUid: string, seasonName: string}} oldSeason
 */
async function replayRollover(db, oldSeason) {
  const season = require("../src/helpers/season");
  const newSeasonUid = (await db.doc("game-settings/season").get()).data().seasonUid;
  await season.rolloverFromOldSeason(db, oldSeason, newSeasonUid);
}

module.exports = { playSeason, replayRollover };
