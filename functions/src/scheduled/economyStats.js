// Weekly economy instrumentation: refresh the mint-vs-sink stats doc the
// Admin > Jobs tab renders (helpers/economyStats.js). Monday 04:00 ET, after
// the Sunday-night scoring/matchup cycle has fully landed.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { updateEconomyStats } = require("../helpers/economyStats");

exports.economyStatsJob = onSchedule(
  {
    schedule: "0 4 * * 1", // Monday 4:00 AM
    timeZone: "America/New_York",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    logger.info("Running weekly economy stats aggregation");
    try {
      await updateEconomyStats(getDb());
    } catch (error) {
      logger.error("Economy stats aggregation failed:", error);
      throw error;
    }
  }
);
