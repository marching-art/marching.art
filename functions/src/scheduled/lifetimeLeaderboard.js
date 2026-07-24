const { onCall } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { assertAdmin } = require("../helpers/callableGuards");
const { computeDirectorRating } = require("../helpers/directorRating");
const { processAllInPages } = require("../helpers/firestorePaging");
const { sumSeasonScore, computeSeasonRankings } = require("../helpers/seasonRankings");
const {
  collectRegistrationsFromProfile,
  buildEventDocs,
} = require("../helpers/showRegistrations");

/**
 * Manually callable function to update lifetime leaderboard
 * Can be called by admins or scheduled
 */
exports.updateLifetimeLeaderboard = onCall({ cors: true }, async (request) => {
  // Admin custom claim, like every other privileged callable. This used to
  // gate on profile.role — a profile field, i.e. a client-adjacent input —
  // instead of the claim only the Admin SDK can set.
  assertAdmin(request);

  await updateLifetimeLeaderboardLogic({ forceLifetime: true });
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
    // The lifetime rebuild scans every profile with lifetime stats; the
    // default 60s scheduler timeout would cut that off (and retry from zero)
    // as the player base grows. Same headroom the email/push scans use.
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    logger.info("Starting scheduled lifetime leaderboard update");
    await updateLifetimeLeaderboardLogic();
    logger.info("Completed scheduled lifetime leaderboard update");
  }
);

/**
 * Fetch profile docs via a paged, projected collection-group query.
 *
 * The users/{uid} parent docs are "missing ancestors" (createUserProfile only
 * writes the profile/ and private/ subcollection docs), so a plain collection
 * query over users/ sees nothing — but the profile docs themselves are real
 * documents, and a collectionGroup("profile") query reaches them directly.
 * The select() projection keeps only the fields the caller needs, and the
 * path-prefix filter drops profile docs from other data namespaces.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string[]} fields - Fields to project.
 * @param {string|null} activeSeasonId - When set, only profiles registered in
 *   that season (the indexed activeSeasonId equality scoring already uses);
 *   when null, every profile.
 * @returns {Promise<Array<{userId: string, data: Object}>>}
 */
async function fetchProfiles(db, fields, activeSeasonId) {
  /** @type {FirebaseFirestore.Query} */
  let profilesQuery = db.collectionGroup("profile");
  if (activeSeasonId) {
    profilesQuery = profilesQuery.where("activeSeasonId", "==", activeSeasonId);
  }
  profilesQuery = profilesQuery.select(...fields);
  const docs = await processAllInPages(profilesQuery, 1000, async (doc) => doc);
  const usersPrefix = `${paths.users()}/`;
  return docs
    .filter((doc) => doc.ref.path.startsWith(usersPrefix))
    .map((doc) => ({ userId: doc.ref.parent.parent.id, data: doc.data() }));
}

// The lifetime leaderboards only move when a season is archived (that's the
// only writer of lifetimeStats / seasonHistory placements), so rebuilding
// them nightly re-read every profile to produce identical output. The meta
// doc records which season the last rebuild saw; a rollover (seasonUid
// change) triggers a rebuild, and MAX_LIFETIME_AGE_MS forces a weekly one so
// cosmetic fields (username, userTitle) in the entries can't go stale for
// months. The current-season rankings + registration index are still
// materialized nightly from the (much cheaper) active-season scan.
const MAX_LIFETIME_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Core logic to update the lifetime leaderboard + current-season rankings.
 *
 * @param {Object} [options]
 * @param {boolean} [options.forceLifetime] - Rebuild the lifetime leaderboards
 *   even if no season rollover happened (admin callable always forces).
 */
async function updateLifetimeLeaderboardLogic({ forceLifetime = false } = {}) {
  const db = getDb();
  logger.info("Updating lifetime leaderboard...");

  try {
    // Current active season — profiles registered in it feed the current-season
    // ranking snapshot materialized alongside the lifetime leaderboard below.
    const seasonDoc = await db.doc("game-settings/season").get();
    const activeSeasonId = seasonDoc.exists ? seasonDoc.data().seasonUid : null;
    const seasonRankEntries = [];
    const registrationPairs = [];

    if (activeSeasonId) {
      const activeProfiles = await fetchProfiles(db, ["corps", "username"], activeSeasonId);
      for (const { userId, data } of activeProfiles) {
        seasonRankEntries.push({ uid: userId, totalScore: sumSeasonScore(data) });
        registrationPairs.push(...collectRegistrationsFromProfile(userId, data));
      }
    }

    // Decide whether the full-population lifetime rebuild needs to run.
    const metaRef = db.doc(paths.lifetimeLeaderboard("meta"));
    const metaDoc = await metaRef.get();
    const meta = metaDoc.exists ? metaDoc.data() : null;
    const lifetimeStale =
      forceLifetime ||
      !meta ||
      meta.seasonUid !== (activeSeasonId || null) ||
      !meta.rebuiltAtMs ||
      Date.now() - meta.rebuiltAtMs > MAX_LIFETIME_AGE_MS;

    const lifetimeData = [];
    if (lifetimeStale) {
      // corps is projected for computeDirectorRating (seasonHistory placements).
      const allProfiles = await fetchProfiles(
        db,
        ["lifetimeStats", "username", "userTitle", "corps"],
        null
      );
      for (const { userId, data } of allProfiles) {
        if (data.lifetimeStats && data.username) {
          lifetimeData.push({
            userId,
            username: data.username,
            userTitle: data.userTitle || "Rookie",
            lifetimeStats: {
              ...data.lifetimeStats,
              // Director Rating (Phase 7.5): lifetime, placements-only,
              // cross-class — derived here on rebuild, never stored on profiles.
              directorRating: computeDirectorRating(data),
            },
            updatedAt: new Date()
          });
        }
      }
    } else {
      logger.info(
        "Lifetime leaderboards up to date (no season rollover, refreshed within a week); skipping rebuild."
      );
    }

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

    // Rebuild the show-registrations index from the same profile pass (zero
    // extra reads — profiles are the source of truth). Full replace: delete
    // every existing event doc, then write the freshly derived set, so
    // entries removed since the last rebuild (or missed by the best-effort
    // selectUserShows write-through) never linger.
    if (activeSeasonId) {
      const eventsRef = db.collection(paths.showRegistrationEvents(activeSeasonId));
      const existingRefs = await eventsRef.listDocuments();
      const eventDocs = buildEventDocs(registrationPairs);

      let regBatch = db.batch();
      let regBatchCount = 0;
      const flushIfFull = async () => {
        regBatchCount++;
        if (regBatchCount >= 400) {
          await regBatch.commit();
          regBatch = db.batch();
          regBatchCount = 0;
        }
      };
      for (const ref of existingRefs) {
        if (!eventDocs.has(ref.id)) {
          regBatch.delete(ref);
          await flushIfFull();
        }
      }
      for (const [eventKey, docData] of eventDocs) {
        regBatch.set(eventsRef.doc(eventKey), { ...docData, rebuiltAt: new Date() });
        await flushIfFull();
      }
      if (regBatchCount > 0) {
        await regBatch.commit();
      }
      logger.info(
        `Rebuilt show-registration index: ${eventDocs.size} events from ` +
          `${registrationPairs.length} registrations`
      );
    }

    if (!lifetimeStale) {
      return;
    }

    if (lifetimeData.length === 0) {
      logger.info("No lifetime stats found to update");
      // Still stamp the meta doc so the empty result isn't re-scanned nightly.
      await metaRef.set({ seasonUid: activeSeasonId || null, rebuiltAtMs: Date.now() });
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

      // Store in leaderboard collection. NOTE: this preserves the historical
      // path byte-for-byte, including the trailing `/data` segment. That
      // makes it a 5-segment (odd) path, which db.doc() rejects — and the
      // frontend reads the 4-segment doc paths.lifetimeLeaderboard(view)
      // directly. Pre-existing divergence; do not silently "fix" here.
      const leaderboardRef = db.doc(
        `${paths.lifetimeLeaderboard(metric.id)}/data`
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

    // Record what this rebuild saw so the nightly run can skip until the next
    // season rollover (or until the weekly cosmetic refresh comes due).
    await metaRef.set({ seasonUid: activeSeasonId || null, rebuiltAtMs: Date.now() });

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
