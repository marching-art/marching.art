/**
 * Play the season through the real pipeline.
 *
 * Every call in here is a production entry point — the nightly live-season
 * scorer, the nightly Podium stage, the daily matchup generator, the Monday
 * recap and rivalry jobs, and the season scheduler's rollover. The rehearsal's
 * only liberties are the clock (clock.js) and the fact that a day is played the
 * moment the one before it finishes instead of 24 hours later.
 *
 * Ordering within a day mirrors production: the 2 AM scorer settles the day that
 * just ended, then the Podium stage runs after it (isolated, as
 * scheduled/dailyProcessors.js runs it), then the 6 AM generator ensures
 * matchups for the day now in progress. Getting that backwards would hide
 * exactly the class of bug the rehearsal is looking for, since week 1 pairs off
 * an empty table.
 *
 * A live season is 70 calendar days, not 49: the first 21 are spring training,
 * which the fantasy scorer skips entirely and the Podium stage does NOT — camp
 * economics, recovery and assistant-director autoplay all happen there, and
 * they are what a corps' budget has spent by the time the season starts. The
 * league jobs stay on competition days, where they already were.
 *
 * The season does not end at day 49. Podium's careers, divisions, champion,
 * Fan Favorite and budget refunds are all settled by the FIRST NIGHTLY STAGE OF
 * THE NEXT SEASON, so the rehearsal keeps playing past the rollover: it
 * re-registers part of the field, runs the archival night, and re-registers the
 * rest. That ordering is the point — a director who signs up before the sweep
 * and one who signs up after must both end the night paid exactly once.
 */

const functionsTest = require("firebase-functions-test")();
const { pinToCompletedDay, pinToCompletedCalendarDay, expireSeason } = require("./clock");
const podiumWorld = require("./podiumWorld");

/**
 * Competition days after which a Fan Favorite ballot round is cast.
 *
 * The Eastern round is cast after day 42, not 41: the Eastern Classic is one
 * major over two nights, and `candidatesForMajor` reads both nights' recaps —
 * so a ballot cast the morning after night 1 can only name half the field.
 * (That asymmetry is real and the checks report it; the harness votes once the
 * whole field has performed so the ballot itself is a clean test.)
 */
const PRELIMS_VOTE_DAYS = [28, 35, 42];
const FINALS_VOTE_DAY = 45;

/**
 * Run every competition day, then roll the season over and settle it.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} world - the seeded world (world.js seedWorld return value).
 * @param {{onDay?: (day: number, result: Object) => void, log?: Function}} [hooks]
 * @returns {Promise<{days: Array<Object>, rollover: Object, podium: Object}>}
 */
async function playSeason(db, world, { onDay = () => {}, log = () => {} } = {}) {
  const scoring = require("../src/helpers/scoring");
  const leagueAutomation = require("../src/scheduled/leagueAutomation");
  const generateMatchups = functionsTest.wrap(leagueAutomation.generateWeeklyMatchups);
  const generateRecaps = functionsTest.wrap(leagueAutomation.generateWeeklyRecaps);
  const updateRivalries = functionsTest.wrap(leagueAutomation.updateLeagueRivalries);

  const days = [];
  const podium = {
    registered: [],
    springNights: [],
    nights: [],
    rejectedVotes: [],
    lateRegistration: null,
  };

  // Registration happens on the eve of day 1, before any night has run.
  podium.registered = await podiumWorld.registerField(db);
  log(`${podium.registered.length} Podium corps registered`);

  // Spring training (calendar days 1-21): no fantasy scoring, but the Podium
  // stage runs — this is where camp days are paid for and the corps is built.
  for (let calendarDay = 1; calendarDay <= world.springTrainingDays; calendarDay++) {
    await pinToCompletedCalendarDay(db, calendarDay);
    podium.springNights.push({ calendarDay, ...(await podiumWorld.runPodiumNight(db)) });
  }
  log(`spring training played (${world.springTrainingDays} camp days)`);

  for (let day = 1; day <= 49; day++) {
    await pinToCompletedDay(db, day, world);
    const seasonData = (await db.doc("game-settings/season").get()).data();

    const result = await scoring.processAndScoreLiveSeasonDayLogic(day, seasonData);
    days.push({ day, ...result });
    onDay(day, result);

    // The Podium stage, after fantasy scoring and isolated from it.
    podium.nights.push({ day, ...(await podiumWorld.runPodiumNight(db)) });

    // The 6 AM generator, ensuring the week now in progress and the next one.
    await generateMatchups({});

    // Monday's league jobs, on the day after a week resolves.
    if (day % 7 === 0) {
      await generateRecaps({});
      await updateRivalries({});
    }

    // The Fan Favorite ballots, cast while each window is open. The clock is
    // pinned to `day` as completed, so the callables see day+1 as active —
    // inside the prelims window that opened tonight, and inside championship
    // week for the finals round.
    if (PRELIMS_VOTE_DAYS.includes(day)) {
      podium.rejectedVotes.push(
        ...(await podiumWorld.castVotes(db, podiumWorld.PRELIMS_VOTES)).map((r) => ({ day, ...r }))
      );
    }
    if (day === FINALS_VOTE_DAY) {
      podium.rejectedVotes.push(
        ...(await podiumWorld.castVotes(db, podiumWorld.FINALS_VOTES)).map((r) => ({ day, ...r }))
      );
    }
  }

  // Rostered, never performed: the corps that signs up after the last show.
  const late = podiumWorld.PODIUM_DIRECTORS.find((d) => d.late);
  podium.lateRegistration = { uid: late.uid, ...(await podiumWorld.registerCorps(db, late)) };

  log("season played; expiring it so the scheduler rolls over");

  // The rollover the season scheduler performs once the end date passes. Called
  // through the same helper the scheduler calls, with the same precondition
  // (an expired season doc) established first.
  await expireSeason(db);
  const season = require("../src/helpers/season");
  const before = (await db.doc("game-settings/season").get()).data();
  await season.startNewOffSeason();
  const after = (await db.doc("game-settings/season").get()).data();

  const rollover = {
    oldSeasonUid: before.seasonUid,
    newSeasonUid: after.seasonUid,
    newSeasonStatus: after.status,
  };

  Object.assign(podium, await settlePodiumBoundary(db, log));

  return { days, rollover, podium };
}

/**
 * The Podium season boundary, in the order production will meet it.
 *
 * `archivePodiumSeason` does not run at rollover — it runs on the first nightly
 * stage of the NEW season, which is a night AFTER directors can already have
 * re-registered. Both sides of that race settle the same money (the previous
 * season's unspent Corps Budget) and both are written to be once-only, so the
 * rehearsal deliberately puts a director on each side of it:
 *
 *   1. `pd_early` registers first, and is refunded by registration's own lazy
 *      self-archival.
 *   2. The archival night runs, sweeping everybody else.
 *   3. The rest re-register afterwards, and must be told they are owed nothing.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Function} log
 */
async function settlePodiumBoundary(db, log) {
  const cast = Object.fromEntries(podiumWorld.PODIUM_DIRECTORS.map((d) => [d.uid, d]));

  // Day 0 of the new season: registration is open, no night has run.
  await pinToCompletedCalendarDay(db, 0);
  const beforeSweep = {
    pd_early: { uid: "pd_early", ...(await podiumWorld.registerCorps(db, cast.pd_early)) },
  };
  log("pd_early re-registered before the archival sweep");

  // The first night of the new season: the sweep.
  await pinToCompletedCalendarDay(db, 1);
  const archivalNight = await podiumWorld.runPodiumNight(db);
  log(`archival night: ${JSON.stringify(archivalNight)}`);

  // Everyone else comes back after the sweep has settled them.
  const afterSweep = {};
  afterSweep.pd_ace = { uid: "pd_ace", ...(await podiumWorld.registerCorps(db, cast.pd_ace)) };
  afterSweep.pd_broke = { uid: "pd_broke", ...(await podiumWorld.registerCorps(db, cast.pd_broke)) };
  afterSweep.pd_fresh = {
    uid: "pd_fresh",
    ...(await podiumWorld.registerCorps(db, cast.pd_fresh, { freshStart: true })),
  };
  afterSweep.pd_vet = {
    uid: "pd_vet",
    ...(await podiumWorld.registerCorps(db, podiumWorld.PODIUM_VETERAN)),
  };
  log("the rest of the field re-registered after the sweep");

  return { beforeSweep, archivalNight, afterSweep };
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
