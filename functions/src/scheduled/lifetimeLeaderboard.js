const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb, dataNamespaceParam } = require("../config");
const { assertAuth } = require("../helpers/callableGuards");
const { computeDirectorRating } = require("../helpers/directorRating");
const { sumSeasonScore, computeSeasonRankings } = require("../helpers/seasonRankings");

/**
 * Manually callable function to update lifetime leaderboard
 * Can be called by admins or scheduled
 */
exports.updateLifetimeLeaderboard = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  // Check if user is admin - only fetch the role field
  const db = getDb();
  const userDoc = await db.doc(paths.userProfile(request.auth.uid)).get();
  // Note: Single doc reads don't support select() in Admin SDK, but this is a small doc read for auth

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
    // Current active season — profiles registered in it feed the current-season
    // ranking snapshot materialized alongside the lifetime leaderboard below.
    const seasonDoc = await db.doc("game-settings/season").get();
    const activeSeasonId = seasonDoc.exists ? seasonDoc.data().seasonUid : null;
    const seasonRankEntries = [];

    // Get all user document references.
    // The users/{uid} docs are "missing ancestors": createUserProfile only
    // writes the profile/ and private/ subcollection docs, never the parent
    // users/{uid} doc, so those docs have no fields of their own. A collection
    // query (.get()/.select()) returns only documents that exist and therefore
    // skips every one of them, reporting the collection as empty even when
    // profiles are present. listDocuments() enumerates every document reference
    // INCLUDING implicit ancestors of subcollections.
    const usersRef = db.collection(paths.users());
    const userDocRefs = await usersRef.listDocuments();

    const lifetimeData = [];

    // Build array of profile document references for batch fetch
    const profileRefs = userDocRefs.map(ref =>
      ref.collection("profile").doc("data")
    );

    // Batch fetch all profiles in chunks of 500 (Admin SDK getAll limit)
    const profileDocs = [];
    for (let i = 0; i < profileRefs.length; i += 500) {
      const chunk = profileRefs.slice(i, i + 500);
      const chunkDocs = await db.getAll(...chunk);
      profileDocs.push(...chunkDocs);
    }

    // Process all profiles
    profileDocs.forEach((profileDoc, index) => {
      if (profileDoc.exists) {
        const profileData = profileDoc.data();
        const userId = userDocRefs[index].id;

        if (profileData.lifetimeStats && profileData.username) {
          lifetimeData.push({
            userId,
            username: profileData.username,
            userTitle: profileData.userTitle || "Rookie",
            lifetimeStats: {
              ...profileData.lifetimeStats,
              // Director Rating (Phase 7.5): lifetime, placements-only,
              // cross-class — derived here nightly, never stored on profiles.
              directorRating: computeDirectorRating(profileData),
            },
            updatedAt: new Date()
          });
        }

        // Current-season ranking snapshot: include every profile registered in
        // the active season (mirrors the getUserRankings scan filter). Uses the
        // full profileData already fetched here, so no extra reads.
        if (activeSeasonId && profileData.activeSeasonId === activeSeasonId) {
          seasonRankEntries.push({ uid: userId, totalScore: sumSeasonScore(profileData) });
        }
      }
    });

    // Materialize the current-season rankings into a single doc so
    // getUserRankings reads one document instead of scanning all profiles.
    if (activeSeasonId && seasonRankEntries.length > 0) {
      const { ranks, totalPlayers } = computeSeasonRankings(seasonRankEntries);
      await db.doc(paths.seasonRankings()).set({
        seasonUid: activeSeasonId,
        totalPlayers,
        ranks,
        updatedAt: new Date(),
      });
      logger.info(`Materialized season rankings for ${totalPlayers} players`);
    }

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
      { id: "leagueChampionships", field: "leagueChampionships" },
      { id: "directorRating", field: "directorRating" }
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
