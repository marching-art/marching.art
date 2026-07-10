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

  // Season rollover (Phase 5): bump the global Podium season index and, the
  // first night of a new season, archive the previous season's corps into
  // careers under a dedicated lease.
  const career = require("../helpers/podium/career");
  const { claimScoringRun, markScoringRunCompleted } = require("../helpers/scoringRunGuard");
  const seasonIndex = await career.ensureSeasonIndex(db, seasonData);
  // Rollover night reports `previous` directly; on later nights re-derive it
  // from the index history so a failed archival sweep self-heals (the lease
  // claim below is a no-op once the sweep has completed).
  const previousSeason = seasonIndex.previous || (await career.latestPreviousSeason(db));
  if (previousSeason) {
    const archiveKey = `${previousSeason.seasonUid}_podium_archive`;
    const lease = await claimScoringRun(db, archiveKey, 0);
    if (lease.claimed) {
      // Isolated + retryable: a transient archival failure marks the lease
      // failed (so tomorrow's run re-claims and re-sweeps — the sweep is
      // idempotent per corps) and never blocks tonight's day processing.
      try {
        const archived = await career.archivePodiumSeason(db, previousSeason);
        await markScoringRunCompleted(db, archiveKey, 0, { archived });
      } catch (error) {
        logger.error(`[podium-stage] season archival failed (will retry): ${error.message}`);
        const { markScoringRunFailed } = require("../helpers/scoringRunGuard");
        await markScoringRunFailed(db, archiveKey, 0, error);
      }
    }
  }

  const { processPodiumDay } = require("../helpers/podium/processor");
  const result = await processPodiumDay(db, seasonData, { calendarDay, competitionDay });

  // Hosted-event payouts ride the once-per-day completion (idempotent: a
  // skipped/leased rerun never reaches this branch, and paid events are
  // marked paidOut). Isolated: payout failures never fail the stage.
  if (result.status === "completed" && competitionDay >= 1) {
    try {
      const { payoutHostedEvents } = require("../helpers/podium/hostedEvents");
      result.hostedEvents = await payoutHostedEvents(db, seasonData, competitionDay);
    } catch (error) {
      logger.error(`[hosted-events] payout failed (stage unaffected): ${error.message}`);
    }
  }
  return result;
}

module.exports = { runPodiumStage };
