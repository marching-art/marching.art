// Nightly retention instrumentation: refresh the DAU/WAU/MAU, cohort-retention
// and streak-distribution doc the Admin > Jobs tab renders
// (helpers/retentionStats.js).
//
// 05:00 ET, deliberately after the whole nightly chain has landed: scoring
// commits ~2 AM, the score-drop push goes out in the morning, and the
// lifetime-leaderboard rebuild runs at 03:00 UTC. Reading profiles before those
// finish would sample activity mid-flight.
//
// Nightly rather than weekly (economyStats' cadence) because this is a projected
// three-field scan with no per-user subcollection queries, and because a daily
// series is the point — a weekly snapshot cannot show whether a change to the
// notification schedule moved next-day return.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { updateRetentionStats } = require("../helpers/retentionStats");

exports.retentionStatsJob = onSchedule(
  {
    schedule: "0 5 * * *", // every day, 5:00 AM ET
    timeZone: "America/New_York",
    // Scans every profile doc; the default 60s scheduler timeout would cut it
    // off (and retry from zero) as the roster grows. Same headroom as the
    // lifetime-leaderboard and email/push scans.
    memory: "512MiB",
    timeoutSeconds: 540,
    cpu: 1,
  },
  async () => {
    logger.info("Running nightly retention stats aggregation");
    try {
      await updateRetentionStats(getDb());
    } catch (error) {
      logger.error("Retention stats aggregation failed:", error);
      throw error;
    }
  }
);
