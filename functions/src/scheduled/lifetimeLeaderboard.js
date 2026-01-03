const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb, dataNamespaceParam } = require("../config");

/**
 * Manually callable function to update lifetime leaderboard
 * Can be called by admins or scheduled
 */
exports.updateLifetimeLeaderboard = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  // Check if user is admin
  const db = getDb();
  const userDoc = await db.doc(`artifacts/${dataNamespaceParam.value()}/users/${request.auth.uid}/profile/data`).get();

  if (!userDoc.exists || userDoc.data().role !== 'admin') {
    throw new HttpsError("permission-denied", "Admin access required");
  }

  await updateLifetimeLeaderboardLogic();
  return { success: true, message: "Lifetime leaderboard updated" };
});

/**
 * Scheduled function to update lifetime leaderboard daily
 * Runs at 3 AM UTC every day
 */
exports.scheduledLifetimeLeaderboardUpdate = onSchedule(
  {
    schedule: "0 3 * * *", // 3 AM UTC daily
    timeZone: "UTC",
  },
  async () => {
    logger.info("Starting scheduled lifetime leaderboard update");
    await updateLifetimeLeaderboardLogic();
    logger.info("Completed scheduled lifetime leaderboard update");
  }
);

/**
 * Core logic to update lifetime leaderboard
 * Optimized: Uses db.getAll() for batch fetching instead of sequential reads
 * Previous: N+1 queries (1001 reads for 1000 users)
 * Now: 2 reads total (1 for users collection, 1 batch for all profiles)
 */
async function updateLifetimeLeaderboardLogic() {
  const db = getDb();
  logger.info("Updating lifetime leaderboard...");

  try {
    // Get all user documents
    const usersRef = db.collection(`artifacts/${dataNamespaceParam.value()}/users`);
    const usersSnapshot = await usersRef.get();

    const lifetimeData = [];

    // Build array of profile document references for batch fetch
    const profileRefs = usersSnapshot.docs.map(userDoc =>
      userDoc.ref.collection("profile").doc("data")
    );

    // Batch fetch all profiles in a single operation (eliminates N+1 query)
    const profileDocs = profileRefs.length > 0 ? await db.getAll(...profileRefs) : [];

    // Process all profiles
    profileDocs.forEach((profileDoc, index) => {
      if (profileDoc.exists) {
        const profileData = profileDoc.data();
        const userId = usersSnapshot.docs[index].id;

        if (profileData.lifetimeStats && profileData.username) {
          lifetimeData.push({
            userId,
            username: profileData.username,
            userTitle: profileData.userTitle || "Rookie",
            lifetimeStats: profileData.lifetimeStats,
            updatedAt: new Date()
          });
        }
      }
    });

    if (lifetimeData.length === 0) {
      logger.info("No lifetime stats found to update");
      return;
    }

    // Create leaderboards for each metric
    const metrics = [
      { id: "totalPoints", field: "totalPoints" },
      { id: "totalSeasons", field: "totalSeasons" },
      { id: "totalShows", field: "totalShows" },
      { id: "bestSeasonScore", field: "bestSeasonScore" },
      { id: "leagueChampionships", field: "leagueChampionships" }
    ];

    let batch = db.batch();
    let batchCount = 0;

    for (const metric of metrics) {
      // Sort data by this metric
      const sorted = [...lifetimeData]
        .sort((a, b) => {
          const aVal = a.lifetimeStats[metric.field] || 0;
          const bVal = b.lifetimeStats[metric.field] || 0;
          return bVal - aVal;
        })
        .slice(0, 100); // Top 100

      // Store in leaderboard collection
      const leaderboardRef = db.doc(
        `artifacts/${dataNamespaceParam.value()}/leaderboard/lifetime_${metric.id}/data`
      );

      batch.set(leaderboardRef, {
        metric: metric.id,
        entries: sorted,
        updatedAt: new Date(),
        totalEntries: sorted.length
      });

      batchCount++;

      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
    }

    logger.info(`Successfully updated lifetime leaderboard with ${lifetimeData.length} entries across ${metrics.length} metrics`);

  } catch (error) {
    logger.error("Error updating lifetime leaderboard:", error);
    throw error;
  }
}

module.exports = {
  updateLifetimeLeaderboard: exports.updateLifetimeLeaderboard,
  scheduledLifetimeLeaderboardUpdate: exports.scheduledLifetimeLeaderboardUpdate
};
