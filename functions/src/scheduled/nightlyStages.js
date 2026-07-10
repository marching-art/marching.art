/**
 * Nightly pipeline stages beyond the fantasy scorers (Phase 1.2).
 *
 * The fantasy scoring logic (helpers/scoring.js) is untouched and always
 * runs first from dailyProcessors. Additional per-system stages run AFTER
 * it, each fully self-contained (reads its own season/day context) and each
 * wrapped by the caller in try/catch so a stage failure can never block or
 * corrupt fantasy scoring.
 *
 * The Podium stage differs from the fantasy path in one important way: it
 * also runs during live-season spring training (calendar days 1-21), which
 * the fantasy processor skips entirely — recovery, decay, camp economics and
 * assistant-director autoplay happen on days with no scoring
 * (PODIUM_CLASS_DESIGN.md §5.9, §14.2.3).
 *
 * Phase 1 ships the stage as a structural no-op behind the
 * game-settings/features.podiumClass flag; Phase 2 lands processPodiumDay
 * with its own scoringRunGuard lease (`{seasonUid}_podium_{day}`) so podium
 * idempotency never contends with the fantasy lease.
 */

const { logger } = require("firebase-functions/v2");
const { isPodiumEnabled } = require("../helpers/features");
const { getCompletedCalendarDay } = require("../helpers/gameDay");

const SPRING_TRAINING_DAYS_DEFAULT = 21;

/**
 * Run the nightly Podium stage. Self-contained: reads the season doc and
 * derives day context; no arguments besides the db so both schedulers
 * (off-season and live) can call it identically.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<{status: string, [key: string]: unknown}>}
 */
async function runPodiumStage(db) {
  if (!(await isPodiumEnabled(db))) {
    return { status: "disabled" };
  }

  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) return { status: "no-season" };
  const seasonData = seasonDoc.data();
  if (!seasonData.schedule || !seasonData.schedule.startDate) return { status: "no-schedule" };

  const calendarDay = getCompletedCalendarDay(seasonData.schedule.startDate.toDate());
  const springTrainingDays =
    seasonData.status === "live-season"
      ? seasonData.schedule.springTrainingDays || SPRING_TRAINING_DAYS_DEFAULT
      : 0;
  const competitionDay = calendarDay - springTrainingDays;

  if (calendarDay < 1) return { status: "before-season" };
  if (competitionDay > 49) return { status: "season-over" };

  logger.info(
    `[podium-stage] calendarDay=${calendarDay} competitionDay=${competitionDay} ` +
      `(${competitionDay < 1 ? "spring training" : "competition"})`
  );
  const { processPodiumDay } = require("../helpers/podium/processor");
  return processPodiumDay(db, seasonData, { calendarDay, competitionDay });
}

module.exports = { runPodiumStage };
