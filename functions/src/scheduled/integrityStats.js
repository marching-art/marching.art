// Weekly account-integrity instrumentation: refresh the alt/multi-account
// signal doc the Admin > Jobs tab renders (helpers/integrityStats.js).
//
// 06:00 ET Monday, after economyStats (04:00 Mon) and the nightly retention
// scan (05:00 daily), so the three operator dashboards refresh in a tidy block
// and this heavier cross-account correlation never contends with scoring.
//
// Weekly, not nightly: like economyStats this pairs a full profile scan with a
// full Auth-user scan, and an alt ring does not need same-night detection the
// way a scoring failure does. Detection only — it never acts on an account.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { updateIntegrityStats } = require("../helpers/integrityStats");

exports.integrityStatsJob = onSchedule(
  {
    schedule: "0 6 * * 1", // every Monday, 6:00 AM ET
    timeZone: "America/New_York",
    // Scans every profile doc AND pages every Auth user; the default 60s
    // scheduler timeout would cut it off as the roster grows. Same headroom as
    // the retention and lifetime-leaderboard scans.
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    logger.info("Running weekly account-integrity signal aggregation");
    try {
      await updateIntegrityStats(getDb());
    } catch (error) {
      logger.error("Integrity stats aggregation failed:", error);
      throw error;
    }
  }
);
