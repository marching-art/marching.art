const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb } = require("../config");
const { generateSeasonRewards, BATTLE_PASS_CONFIG } = require("../callable/battlePass");

/**
 * Battle Pass Season Rotation Scheduler
 *
 * Runs daily at 2 AM UTC to check if a new season needs to be created
 * Creates seasons automatically based on DCI off-season schedule
 *
 * Schedule: 0 2 * * * (every day at 2 AM UTC)
 */
exports.battlePassSeasonRotation = onSchedule(
  {
    schedule: "0 2 * * *", // Daily at 2 AM UTC
    timeZone: "UTC",
    retryCount: 3,
  },
  async (event) => {
    logger.info("Running battle pass season rotation check...");

    const db = getDb();

    try {
      // Get current battle pass season
      const seasonDocRef = db.doc("game-settings/battlePassSeason");
      const seasonDoc = await seasonDocRef.get();

      const now = new Date();
      let shouldCreateNewSeason = false;

      if (!seasonDoc.exists) {
        // No season exists, create the first one
        logger.info("No battle pass season exists, creating first season...");
        shouldCreateNewSeason = true;
      } else {
        const currentSeason = seasonDoc.data();
        const endDate = currentSeason.endDate.toDate();

        // Check if season has ended
        if (now >= endDate) {
          logger.info(`Current season "${currentSeason.name}" has ended. Creating new season...`);
          shouldCreateNewSeason = true;

          // Archive the old season
          await archiveCompletedSeason(currentSeason);
        } else {
          logger.info(`Current season "${currentSeason.name}" is still active until ${endDate.toISOString()}`);
        }
      }

      if (shouldCreateNewSeason) {
        await createNewBattlePassSeason();
      }

    } catch (error) {
      logger.error("Error in battle pass season rotation:", error);
      throw error; // Re-throw to trigger retry
    }
  }
);

/**
 * Create a new battle pass season
 */
async function createNewBattlePassSeason() {
  const db = getDb();

  try {
    // Get the current game season to align with
    const gameSeasonDoc = await db.doc("game-settings/season").get();
    const gameSeason = gameSeasonDoc.exists ? gameSeasonDoc.data() : null;

    // Generate season name based on current year
    const now = new Date();
    const year = now.getFullYear();
    const seasonNumber = Math.floor((now.getMonth() + 1) / 2); // ~6 seasons per year
    const seasonName = gameSeason?.name || `Season ${year}-${seasonNumber}`;

    // Calculate start and end dates
    const startDate = now;
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + BATTLE_PASS_CONFIG.seasonDuration);

    // Generate rewards for this season
    const rewards = generateSeasonRewards();

    // Create season ID
    const seasonId = `bp_${year}_${seasonNumber}_${Date.now()}`;

    // Create the new season
    const newSeason = {
      seasonId,
      name: `Battle Pass - ${seasonName}`,
      startDate: admin.firestore.Timestamp.fromDate(startDate),
      endDate: admin.firestore.Timestamp.fromDate(endDate),
      rewards,
      levelCap: BATTLE_PASS_CONFIG.levelCap,
      xpPerLevel: BATTLE_PASS_CONFIG.xpPerLevel,
      price: BATTLE_PASS_CONFIG.price,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active',
    };

    // Save to database
    await db.doc("game-settings/battlePassSeason").set(newSeason);

    logger.info(`Created new battle pass season: ${seasonName} (${seasonId})`);
    logger.info(`Season runs from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Send analytics event
    await db.collection('analytics_events').add({
      type: 'battle_pass_season_created',
      seasonId,
      seasonName: newSeason.name,
      startDate: newSeason.startDate,
      endDate: newSeason.endDate,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return newSeason;
  } catch (error) {
    logger.error("Error creating new battle pass season:", error);
    throw error;
  }
}

/**
 * Archive a completed season
 * Moves season data to archive and calculates statistics
 */
async function archiveCompletedSeason(season) {
  const db = getDb();

  try {
    // Query all users who participated in this season
    const usersSnapshot = await db.collectionGroup("profile")
      .where("battlePass.seasonId", "==", season.seasonId)
      .get();

    const statistics = {
      totalParticipants: usersSnapshot.size,
      premiumPurchases: 0,
      totalXPEarned: 0,
      averageLevel: 0,
      maxLevel: 0,
      revenueGenerated: 0,
      completionRate: 0, // % who reached max level
    };

    let totalLevels = 0;
    let maxLevelReached = 0;

    usersSnapshot.forEach((doc) => {
      const battlePass = doc.data().battlePass;
      if (!battlePass) return;

      totalLevels += battlePass.level || 1;
      statistics.totalXPEarned += battlePass.xp || 0;

      if (battlePass.level > maxLevelReached) {
        maxLevelReached = battlePass.level;
      }

      if (battlePass.isPremium) {
        statistics.premiumPurchases++;
        statistics.revenueGenerated += battlePass.amount || BATTLE_PASS_CONFIG.price;
      }

      if (battlePass.level >= BATTLE_PASS_CONFIG.levelCap) {
        statistics.completionRate++;
      }
    });

    statistics.averageLevel = usersSnapshot.size > 0 ? totalLevels / usersSnapshot.size : 0;
    statistics.maxLevel = maxLevelReached;
    statistics.completionRate = usersSnapshot.size > 0
      ? (statistics.completionRate / usersSnapshot.size) * 100
      : 0;

    // Archive the season
    const archiveDoc = {
      ...season,
      statistics,
      archivedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'completed',
    };

    await db.collection('battle_pass_seasons_archive').doc(season.seasonId).set(archiveDoc);

    logger.info(`Archived season ${season.name}:`, statistics);

    // Send analytics event
    await db.collection('analytics_events').add({
      type: 'battle_pass_season_archived',
      seasonId: season.seasonId,
      seasonName: season.name,
      statistics,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

  } catch (error) {
    logger.error(`Error archiving season ${season.seasonId}:`, error);
    // Don't throw - archiving failure shouldn't prevent new season creation
  }
}

/**
 * Manual trigger to create a new season (for testing/admin use)
 */
exports.createBattlePassSeasonManual = async () => {
  logger.info("Manually creating new battle pass season...");
  return await createNewBattlePassSeason();
};

module.exports = {
  battlePassSeasonRotation: exports.battlePassSeasonRotation,
  createBattlePassSeasonManual: exports.createBattlePassSeasonManual,
};
