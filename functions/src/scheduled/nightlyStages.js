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
 * (PODIUM.md §5.9, §14.2.3).
 *
 * Phase 1 ships the stage as a structural no-op behind the
 * game-settings/features.podiumClass flag; Phase 2 lands processPodiumDay
 * with its own scoringRunGuard lease (`{seasonUid}_podium_{day}`) so podium
 * idempotency never contends with the fantasy lease.
 *
 * The Discord stage posts the nightly score drop to the community server's
 * scores channel (helpers/scoreDrop.js). It only runs on scored competition
 * days and is disabled entirely when the DISCORD_SCORES_WEBHOOK_URL secret
 * is unset/empty.
 */

const { logger } = require("firebase-functions/v2");
const { isPodiumEnabled } = require("../helpers/features");
const { getCompletedCalendarDay, toCompetitionDay } = require("../helpers/gameDay");

const SPRING_TRAINING_DAYS_DEFAULT = 21;

/**
 * Run the nightly Podium stage. Self-contained: reads the season doc and
 * derives day context; no arguments besides the db so both schedulers
 * (off-season and live) can call it identically.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} [options]
 * @param {number} [options.calendarDay] - Explicit calendar day to process.
 *   The legacy 2 AM callers omit it (derived via the 2 AM game-day reset);
 *   the 9 PM ET Podium job (scheduled/dropDispatcher.js) passes the show
 *   date's day, where the 2 AM derivation would be off by one.
 * @returns {Promise<{status: string, [key: string]: unknown}>}
 */
async function runPodiumStage(db, { calendarDay: calendarDayOverride = null } = {}) {
  if (!(await isPodiumEnabled(db))) {
    return { status: "disabled" };
  }

  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) return { status: "no-season" };
  const seasonData = seasonDoc.data();
  if (!seasonData.schedule || !seasonData.schedule.startDate) return { status: "no-schedule" };

  const calendarDay =
    calendarDayOverride ?? getCompletedCalendarDay(seasonData.schedule.startDate.toDate());
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

/**
 * Run the nightly Discord score-drop stage. Self-contained like the Podium
 * stage: reads the season doc, derives the scored day (with the live-season
 * spring-training offset), and hands off to runDiscordScoreDrop, whose
 * `{seasonUid}_discord` lease guarantees at-most-one post per day even when
 * the scheduler retries a completed scoring run.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} webhookUrl - Discord webhook URL; falsy disables the stage.
 * @param {typeof fetch} [fetchImpl] - Injectable for tests.
 * @param {Object} [options]
 * @param {number} [options.scoredDay] - Explicit competition day whose drop to
 *   post. The legacy 2 AM callers omit it (derived via the 2 AM reset); the
 *   drop dispatcher passes the planner's day, since it posts at the drop
 *   instant (as early as 9/11 PM ET) where the 2 AM derivation is off by one.
 * @returns {Promise<{status: string, [key: string]: unknown}>}
 */
async function runDiscordStage(db, webhookUrl, fetchImpl, { scoredDay: scoredDayOverride = null } = {}) {
  if (!webhookUrl) return { status: "disabled" };

  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) return { status: "no-season" };
  const seasonData = seasonDoc.data();
  if (!seasonData.schedule || !seasonData.schedule.startDate) return { status: "no-schedule" };

  const scoredDay = scoredDayOverride ?? toCompetitionDay(
    getCompletedCalendarDay(seasonData.schedule.startDate.toDate()), seasonData);

  if (scoredDay < 1 || scoredDay > 49) return { status: "out-of-season", scoredDay };

  const { runDiscordScoreDrop } = require("../helpers/scoreDrop");
  return runDiscordScoreDrop(db, {
    seasonUid: seasonData.seasonUid,
    seasonName: seasonData.name || seasonData.seasonUid,
    scoredDay,
    webhookUrl,
    fetchImpl,
  });
}

module.exports = { runPodiumStage, runDiscordStage };
