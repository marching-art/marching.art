const { logger } = require("firebase-functions/v2");
const { getDb, dataNamespaceParam } = require("../config");
const { Timestamp } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const {
  TRANSACTION_TYPES,
  addCoinHistoryEntryToBatch,
  getSeasonBonusAmount,
} = require("../callable/economy");
const { calculateXPUpdates, getSeasonCompletionXP } = require("./xpCalculations");
const { updateSeasonBestRecords } = require("./gameRecords");
const {
  applyEnrichment,
  brandEventName,
  scraperInvokeKey,
  writeScheduleToSubcollection,
  writeScheduleToCollection,
  getScheduleDay,
  getScheduleDays,
  getAllScheduleDays,
  updateScheduleDay,
  addShowToDay,
  shuffleArray,
} = require("./seasonSchedule");
const {
  generateLiveSeasonSchedule,
  generateOffSeasonSchedule,
  calculateOffSeasonDay,
  getThematicOffSeasonName,
  getNextOffSeasonWindow,
} = require("./scheduleGeneration");
const {
  showMatchKey,
  mergeScheduleRefresh,
  refreshLiveSeasonSchedule,
} = require("./scheduleRefresh");



/**
 * Archive every active profile's season, pay season-finish rewards, and reset
 * corps for the new season. Shared by startNewLiveSeason and startNewOffSeason
 * (the two previously carried identical copies of this loop).
 *
 * For each corps that was active this season (has a lineup or a score):
 * - placement within its class is computed and archived to seasonHistory
 * - a CorpsCoin finish bonus is paid per SEASON_FINISH_BONUSES (top 25;
 *   SoundSport is non-competitive so it earns no rank-based coin)
 * - season-completion XP is awarded per getSeasonCompletionXP
 * - a pendingSeasonRecap summary is written to the profile so the client can
 *   show a "Season Complete" recap modal (client clears the field on dismiss)
 */
async function archiveAndResetProfiles(db, oldSeasonUid, newSeasonUid) {
  const profilesQuery = db.collectionGroup("profile").where("activeSeasonId", "==", oldSeasonUid);
  const profilesSnapshot = await profilesQuery.get();

  if (profilesSnapshot.empty) return;

  logger.info(`Resetting ${profilesSnapshot.size} user profiles from season ${oldSeasonUid}...`);

  // Build class rankings from all profiles before archiving.
  // Keyed by the user's uid (doc.ref.parent.parent.id) — every profile doc in
  // the collectionGroup has the same doc.id ("data"), so keying by doc.id
  // made findIndex match the first entry and archived placement 1 for everyone.
  const classRankings = {}; // Map<classKey, Array<{uid, totalSeasonScore, corpsName, displayName}>>
  for (const doc of profilesSnapshot.docs) {
    const uid = doc.ref.parent.parent.id;
    const profileData = doc.data();
    const corpsData = profileData.corps || {};
    Object.keys(corpsData).forEach((corpsClass) => {
      const corps = corpsData[corpsClass];
      if (corps.lineup || corps.totalSeasonScore > 0) {
        if (!classRankings[corpsClass]) {
          classRankings[corpsClass] = [];
        }
        classRankings[corpsClass].push({
          uid,
          totalSeasonScore: corps.totalSeasonScore || 0,
          corpsName: corps.corpsName || null,
          displayName: profileData.username || profileData.displayName || null,
        });
      }
    });
  }
  // Sort each class by score descending to determine rankings
  Object.keys(classRankings).forEach((classKey) => {
    classRankings[classKey].sort((a, b) => b.totalSeasonScore - a.totalSeasonScore);
  });
  logger.info(`Computed rankings for ${Object.keys(classRankings).length} classes`);

  let batch = db.batch();
  let opCount = 0; // counts every write in the batch (profile + coin history)

  for (const doc of profilesSnapshot.docs) {
    const uid = doc.ref.parent.parent.id;
    const profileData = doc.data();
    const corpsData = profileData.corps || {};
    const lifetimeStats = profileData.lifetimeStats || {
      totalSeasons: 0,
      totalShows: 0,
      totalPoints: 0,
      bestSeasonScore: 0,
      bestWeeklyScore: 0,
      leagueChampionships: 0,
    };

    // Archive current season data and reset corps
    const resetCorps = {};
    let seasonShowCount = 0;
    let seasonPointsTotal = 0;
    const seasonAwards = []; // one entry per active corps: recap + payout data

    Object.keys(corpsData).forEach((corpsClass) => {
      const corps = corpsData[corpsClass];
      const seasonHistory = corps.seasonHistory || [];

      // Only archive if this corps was active this season
      if (corps.lineup || corps.totalSeasonScore > 0) {
        const showsAttended = Object.keys(corps.selectedShows || {}).length;
        const highestWeeklyScore = Math.max(...Object.values(corps.weeklyScores || {}), 0);

        // Find placement for this corps in its class
        const classRanking = classRankings[corpsClass] || [];
        const rankIndex = classRanking.findIndex((r) => r.uid === uid);
        const placement = rankIndex >= 0 ? rankIndex + 1 : null;

        // Season-finish rewards. SoundSport is deliberately non-competitive
        // (medals, no numeric standings), so it earns completion XP but no
        // rank-based coin bonus.
        const coinBonus =
          corpsClass === "soundSport" ? 0 : getSeasonBonusAmount(placement).amount;
        const xpBonus = getSeasonCompletionXP(placement, classRanking.length);
        seasonAwards.push({
          corpsClass,
          corpsName: corps.corpsName || null,
          placement,
          totalInClass: classRanking.length,
          totalSeasonScore: corps.totalSeasonScore || 0,
          coinBonus,
          xpBonus,
        });

        // Archive this season's performance. The show concept (title +
        // theme/music/drill) is part of the historical record — the corps
        // history a director looks back on — even though the live field
        // resets for the new season.
        seasonHistory.push({
          seasonId: oldSeasonUid,
          seasonName: oldSeasonUid,
          corpsClass,
          corpsName: corps.corpsName || null,
          location: corps.location || null,
          showConcept: corps.showConcept?.theme ? corps.showConcept : null,
          lineup: corps.lineup || null,
          selectedShows: corps.selectedShows || {},
          weeklyScores: corps.weeklyScores || {},
          totalSeasonScore: corps.totalSeasonScore || 0,
          showsAttended,
          highestWeeklyScore,
          placement,
          archivedAt: new Date(),
        });

        seasonShowCount += showsAttended;
        seasonPointsTotal += corps.totalSeasonScore || 0;

        // Update lifetime stats
        lifetimeStats.bestSeasonScore = Math.max(
          lifetimeStats.bestSeasonScore,
          corps.totalSeasonScore || 0
        );
        lifetimeStats.bestWeeklyScore = Math.max(lifetimeStats.bestWeeklyScore, highestWeeklyScore);
      }

      resetCorps[corpsClass] = {
        // PRESERVE: Historical data
        corpsName: corps.corpsName || null,
        location: corps.location || null,
        seasonHistory,
        // PRESERVE: Director-designed branding and ensemble identity across seasons
        uniformDesign: corps.uniformDesign || null,
        avatarUrl: corps.avatarUrl || null,
        avatarGeneratedAt: corps.avatarGeneratedAt || null,
        ensembleInfo: corps.ensembleInfo || null,
        // RESET: Season-specific data (including weeklyTrades so users can set up corps)
        weeklyTrades: null,
        lineup: null,
        lineupKey: null,
        selectedShows: {},
        weeklyScores: {},
        totalSeasonScore: 0,
      };
    });

    // Update lifetime stats
    if (seasonShowCount > 0 || seasonPointsTotal > 0) {
      lifetimeStats.totalSeasons = (lifetimeStats.totalSeasons || 0) + 1;
      lifetimeStats.totalShows = (lifetimeStats.totalShows || 0) + seasonShowCount;
      lifetimeStats.totalPoints = (lifetimeStats.totalPoints || 0) + seasonPointsTotal;
    }

    // Reset corps data for new season but DON'T update activeSeasonId yet.
    // This allows the SeasonSetupWizard to detect the season mismatch and show
    // the corps verification step (Step 0) where users can choose to continue,
    // retire, or start a new corps. activeSeasonId gets updated by processCorpsDecisions
    // after the user makes their decisions.
    const updateData = {
      corps: resetCorps,
      lifetimeStats,
      retiredCorps: profileData.retiredCorps || [], // Preserve retired corps list
    };

    // Season-finish payouts (coin + XP) and the recap the client shows once.
    const totalCoin = seasonAwards.reduce((sum, a) => sum + a.coinBonus, 0);
    const totalXP = seasonAwards.reduce((sum, a) => sum + a.xpBonus, 0);
    if (totalXP > 0) {
      Object.assign(updateData, calculateXPUpdates(profileData, totalXP).updates);
    }

    // Reset the seasonal reward ladder: new baseline is the post-award XP
    // total, and tier claims reset with the new seasonUid.
    updateData.xpAtSeasonStart = (profileData.xp || 0) + totalXP;
    updateData.seasonLadder = null;
    if (totalCoin > 0) {
      updateData.corpsCoin = admin.firestore.FieldValue.increment(totalCoin);
    }
    if (seasonAwards.length > 0) {
      updateData.pendingSeasonRecap = {
        seasonId: oldSeasonUid,
        seasonName: oldSeasonUid,
        results: seasonAwards,
        totalCoin,
        totalXP,
        awardedAt: new Date(),
      };
    }

    batch.update(doc.ref, updateData);
    opCount++;

    for (const award of seasonAwards) {
      if (award.coinBonus > 0) {
        const { rankDescription } = getSeasonBonusAmount(award.placement);
        addCoinHistoryEntryToBatch(batch, db, uid, {
          type: TRANSACTION_TYPES.SEASON_BONUS,
          amount: award.coinBonus,
          description: `${rankDescription} in ${oldSeasonUid} (${award.corpsClass})`,
          finalRank: award.placement,
          corpsClass: award.corpsClass,
          timestamp: new Date(),
        });
        opCount++;
      }
    }

    if (opCount >= 400) {
      logger.info(`Committing batch of ${opCount} season-archival writes...`);
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  // Records Book: each class's top season total is a best-season candidate.
  const topFinishers = Object.entries(classRankings)
    .filter(([, ranking]) => ranking.length > 0)
    .map(([corpsClass, ranking]) => ({
      corpsClass,
      value: ranking[0].totalSeasonScore,
      corpsName: ranking[0].corpsName,
      displayName: ranking[0].displayName,
      uid: ranking[0].uid,
    }));
  await updateSeasonBestRecords(db, topFinishers, oldSeasonUid);

  logger.info(`Successfully auto-continued all user corps into new season: ${newSeasonUid}`);
}

/**
 * Delete every activeLineups doc belonging to the finished season.
 * Shared by startNewLiveSeason and startNewOffSeason.
 */
async function clearActiveLineups(db, oldSeasonUid) {
  logger.info(`Clearing active lineups from season ${oldSeasonUid}...`);
  const activeLineupsQuery = db.collection("activeLineups").where("seasonId", "==", oldSeasonUid);
  const lineupSnapshot = await activeLineupsQuery.get();

  if (lineupSnapshot.empty) {
    logger.info("No active lineups found to clear");
    return;
  }

  logger.info(`Found ${lineupSnapshot.size} active lineups to clear...`);

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of lineupSnapshot.docs) {
    batch.delete(doc.ref);
    batchCount++;

    if (batchCount >= 400) {
      logger.info(`Committing batch of ${batchCount} lineup deletions...`);
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  logger.info(`Successfully cleared ${lineupSnapshot.size} active lineups from previous season`);
}

async function startNewLiveSeason() {
  logger.info("Generating new live season...");
  const db = getDb();
  const today = new Date();
  const year = today.getFullYear();
  const previousYear = (year - 1).toString();

  let oldSeasonUid = null;
  const oldSeasonDoc = await db.doc("game-settings/season").get();
  if (oldSeasonDoc.exists) {
    oldSeasonUid = oldSeasonDoc.data().seasonUid;
  }

  const rankingsDocRef = db.doc(`final_rankings/${previousYear}`);
  const rankingsDoc = await rankingsDocRef.get();
  if (!rankingsDoc.exists) {
    throw new Error(`Cannot start live season: Final rankings for ${previousYear} not found.`);
  }
  const corpsValues = rankingsDoc.data().data.map((c) => ({
    corpsName: c.corps,
    sourceYear: previousYear,
    points: c.points,
  }));

  // Calculate finals date (2nd Saturday of August)
  const augustFirst = new Date(year, 7, 1);
  const dayOfWeek = augustFirst.getDay();
  const daysToAdd = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
  const millisInDay = 24 * 60 * 60 * 1000;
  const firstSaturday = new Date(augustFirst.getTime() + daysToAdd * millisInDay);
  const finalsDate = new Date(firstSaturday.getTime() + 7 * millisInDay);

  // Season is 70 days total: 21 days spring training + 49 days competition
  // Start date is 69 days before finals (day 70 = finals)
  const startDate = new Date(finalsDate.getTime() - 69 * millisInDay);

  // Season naming
  const startYear = startDate.getFullYear();
  const endYear = finalsDate.getFullYear();
  const seasonYearSuffix = `${startYear}-${endYear.toString().slice(-2)}`;
  const seasonName = `live_${seasonYearSuffix}`;

  const dataDocId = seasonName;
  await db.doc(`dci-data/${dataDocId}`).set({ corpsValues: corpsValues });

  // Generate schedule with offSeasonDay structure (1-49 competition days)
  // Pass startDate and finalsDate so we can map scraped events to the correct days
  const schedule = await generateLiveSeasonSchedule(49, 1, year, startDate, finalsDate);

  // Write schedule to schedules collection (competitions array format)
  await writeScheduleToCollection(dataDocId, schedule);

  // endDate is the first moment of the day AFTER finals, so finals day is fully included
  // This prevents the scheduler (which runs at 3 AM) from triggering on finals day
  const seasonEndDate = new Date(finalsDate.getTime() + millisInDay);

  const newSeasonData = {
    name: seasonName,
    status: "live-season",
    seasonUid: dataDocId,
    seasonYear: year,
    currentPointCap: 150,
    dataDocId: dataDocId,
    schedule: {
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(seasonEndDate),
      springTrainingDays: 21, // First 21 calendar days are spring training
    },
  };

  await db.doc("game-settings/season").set(newSeasonData);
  logger.info(`Successfully started the ${newSeasonData.name}.`);

  if (oldSeasonUid) {
    await archiveAndResetProfiles(db, oldSeasonUid, dataDocId);
    await clearActiveLineups(db, oldSeasonUid);
  }
}

async function startNewOffSeason() {
  logger.info("Generating new themed off-season...");
  const db = getDb();
  const seasonSettingsRef = db.doc("game-settings/season");

  let oldSeasonUid = null;
  const oldSeasonDoc = await seasonSettingsRef.get();
  if (oldSeasonDoc.exists) {
    oldSeasonUid = oldSeasonDoc.data().seasonUid;
  }

  const { startDate, endDate, seasonType, finalsYear } = getNextOffSeasonWindow();
  const seasonLength = 49;
  const rankingsSnapshot = await db.collection("final_rankings").get();
  if (rankingsSnapshot.empty) {
    throw new Error("Cannot start off-season: No final rankings found.");
  }
  const pointsMap = new Map();
  const allCorpsList = [];
  rankingsSnapshot.forEach((doc) => {
    const year = doc.id;
    const corpsData = doc.data().data || [];
    corpsData.forEach((corps) => {
      const pointValue = corps.points;
      if (pointValue) {
        const entry = { corpsName: corps.corps, sourceYear: year, points: pointValue };
        if (!pointsMap.has(pointValue)) pointsMap.set(pointValue, []);
        pointsMap.get(pointValue).push(entry);
        allCorpsList.push(entry);
      }
    });
  });
  const offSeasonCorpsData = [];
  const usedCorpsNames = new Set();
  const shuffledAllCorps = shuffleArray(allCorpsList);
  for (let points = 25; points >= 1; points--) {
    let candidates = pointsMap.get(points) || [];
    let chosenCorps = null;
    if (candidates.length > 0) {
      const shuffledCandidates = shuffleArray([...candidates]);
      chosenCorps = shuffledCandidates.find((c) => !usedCorpsNames.has(c.corpsName));
      if (!chosenCorps) chosenCorps = shuffledCandidates[0];
    }
    if (!chosenCorps) {
      const fallback = shuffledAllCorps.find((c) => !usedCorpsNames.has(c.corpsName));
      if (fallback) chosenCorps = { ...fallback, points: points };
    }
    if (chosenCorps) {
      const { corpsName, sourceYear, points: chosenPoints } = chosenCorps;
      offSeasonCorpsData.push({ corpsName, sourceYear, points: chosenPoints });
      usedCorpsNames.add(chosenCorps.corpsName);
    }
  }
  const schedule = await generateOffSeasonSchedule(seasonLength, 1);
  const seasonName = getThematicOffSeasonName(seasonType, finalsYear);
  const dataDocId = seasonName;

  await db.doc(`dci-data/${dataDocId}`).set({ corpsValues: offSeasonCorpsData });

  // Write schedule to schedules collection (competitions array format)
  await writeScheduleToCollection(dataDocId, schedule);

  const newSeasonSettings = {
    name: seasonName,
    status: "off-season",
    seasonUid: dataDocId,
    currentPointCap: 150,
    dataDocId: dataDocId,
    schedule: { startDate: Timestamp.fromDate(startDate), endDate: Timestamp.fromDate(endDate) },
  };

  await seasonSettingsRef.set(newSeasonSettings);
  logger.info(`Successfully started ${seasonName}.`);

  if (oldSeasonUid) {
    await archiveAndResetProfiles(db, oldSeasonUid, dataDocId);
    await clearActiveLineups(db, oldSeasonUid);
  }
}


async function archiveSeasonResultsLogic() {
  logger.info("Starting end-of-season archival process...");
  const db = getDb();

  const seasonSettingsRef = db.doc("game-settings/season");
  const seasonDoc = await seasonSettingsRef.get();
  if (!seasonDoc.exists) {
    logger.error("No season document found. Cannot archive results.");
    throw new Error("No active season document found.");
  }
  const seasonData = seasonDoc.data();
  const seasonId = seasonData.seasonUid;
  const seasonName = seasonData.name;

  // Leagues live under the data namespace (see callable/leagues.js) — this
  // path must stay in sync with that writer or archival silently processes
  // zero leagues.
  const leaguesSnapshot = await db
    .collection(`artifacts/${dataNamespaceParam.value()}/leagues`)
    .get();
  if (leaguesSnapshot.empty) {
    logger.info("No leagues found to archive.");
    return;
  }

  const batch = db.batch();

  for (const leagueDoc of leaguesSnapshot.docs) {
    const league = leagueDoc.data();
    const leagueId = leagueDoc.id;
    const members = league.members || [];

    if (members.length === 0) continue;

    let leagueWinner = { userId: null, username: "Unknown", finalScore: -1, corpsName: "Unknown" };

    const profilePromises = members.map((uid) => db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`).get());
    const profileDocs = await Promise.all(profilePromises);

    profileDocs.forEach((profileDoc) => {
      if (profileDoc.exists) {
        const profileData = profileDoc.data();
        if (profileData.activeSeasonId === seasonId) {
          const userCorps = profileData.corps || {};
          if (profileData.corpsName && !userCorps.worldClass) {
            userCorps.worldClass = { totalSeasonScore: profileData.totalSeasonScore || 0 };
          }
          const totalScore = Object.values(userCorps)
            .reduce((sum, corps) => sum + (corps.totalSeasonScore || 0), 0);

          if (totalScore > leagueWinner.finalScore) {
            leagueWinner = {
              userId: profileDoc.ref.parent.parent.id,
              username: profileData.username,
              finalScore: totalScore,
              corpsName: userCorps.worldClass?.corpsName || profileData.corpsName || "Unnamed Corps",
            };
          }
        }
      }
    });

    if (leagueWinner.userId) {
      const leagueRef = leagueDoc.ref;
      const championEntry = {
        seasonName: seasonName,
        winnerId: leagueWinner.userId,
        winnerUsername: leagueWinner.username,
        winnerCorpsName: leagueWinner.corpsName,
        score: leagueWinner.finalScore,
        archivedAt: new Date(),
      };
      batch.update(leagueRef, {
        champions: admin.firestore.FieldValue.arrayUnion(championEntry),
      });
      logger.info(`Archived winner for league '${league.name}': ${leagueWinner.username}`);

      // --- ACHIEVEMENT LOGIC ---
      const winnerProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${leagueWinner.userId}/profile/data`);
      const championAchievement = {
        id: `league_champion_${seasonId}`, // Unique ID for this achievement
        name: `League Champion: ${seasonName}`,
        description: `Finished 1st in the ${league.name} league during the ${seasonName}.`,
        earnedAt: new Date(),
        icon: "trophy", // An identifier for the frontend to use
      };
      batch.update(winnerProfileRef, {
        achievements: admin.firestore.FieldValue.arrayUnion(championAchievement),
      });
      logger.info(`Granted 'League Champion' achievement to ${leagueWinner.username}.`);

      // --- PRIZE POOL PAYOUT ---
      // Pay the CorpsCoin prize pool shown on the league's settings tab.
      const prizePool = league.settings?.prizePool || 0;
      if (prizePool > 0) {
        batch.update(winnerProfileRef, {
          corpsCoin: admin.firestore.FieldValue.increment(prizePool),
        });
        addCoinHistoryEntryToBatch(batch, db, leagueWinner.userId, {
          type: TRANSACTION_TYPES.LEAGUE_WIN,
          amount: prizePool,
          description: `${seasonName} champion prize pool — ${league.name}`,
          timestamp: new Date(),
        });
        logger.info(
          `Paid ${prizePool} CC prize pool to ${leagueWinner.username} for winning '${league.name}'.`
        );
      }

      // --- NEW NOTIFICATION LOGIC ---
      const notificationMessage = `🏆 ${leagueWinner.username} has won the ${seasonName} ` +
        `championship in your league, ${league.name}!`;
      members.forEach((memberUid) => {
        const notificationRef = db.collection(`artifacts/${dataNamespaceParam.value()}/users/${memberUid}/notifications`).doc();
        batch.set(notificationRef, {
          type: "new_champion",
          message: notificationMessage,
          link: `/leagues/${leagueId}`, // This will be used for client-side routing
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          isRead: false,
        });
      });
      logger.info(`Created notifications for all ${members.length} members of league '${league.name}'.`);
    }
  }

  await batch.commit();
  logger.info("End-of-season archival process complete.");
}


module.exports = {
  // Core season functions
  shuffleArray,
  startNewLiveSeason,
  startNewOffSeason,
  generateLiveSeasonSchedule,
  generateOffSeasonSchedule,
  calculateOffSeasonDay,
  getThematicOffSeasonName,
  getNextOffSeasonWindow,
  archiveSeasonResultsLogic,
  refreshLiveSeasonSchedule,
  mergeScheduleRefresh,
  showMatchKey,
  applyEnrichment,
  brandEventName,
  // Schedule helpers
  writeScheduleToCollection,
  writeScheduleToSubcollection,
  getScheduleDay,
  getScheduleDays,
  getAllScheduleDays,
  updateScheduleDay,
  addShowToDay,
  // Secrets
  scraperInvokeKey,
};