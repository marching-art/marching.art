const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb, dataNamespaceParam } = require("../config");
const { logger } = require("firebase-functions/v2");

/**
 * Task 2.7: Saves a user's 8-caption lineup for a specific corps class.
 */
// Add { cors: true } here
exports.saveLineup = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to save a lineup.");
  }
  const { lineup, corpsClass } = request.data;
  const uid = request.auth.uid;

  // 1. --- Validate Inputs ---
  const validClasses = ["worldClass", "openClass", "aClass", "soundSport"];
  if (!validClasses.includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Invalid corps class specified.");
  }

  if (!lineup || Object.keys(lineup).length !== 8) {
    throw new HttpsError("invalid-argument", "A complete 8-caption lineup is required.");
  }

  // 2. --- Validate Points Cap ---
  const pointCaps = {
    worldClass: 150,
    openClass: 120,
    aClass: 60,
    soundSport: 90,
  };
  const pointCap = pointCaps[corpsClass];

  const totalPoints = Object.values(lineup).reduce((sum, selection) => {
    if (!selection || typeof selection !== 'string') return sum;
    const parts = selection.split("|");
    // Use parts.length-1 to get the last part, which is the points
    return sum + (Number(parts[parts.length - 1]) || 0);
  }, 0);

  if (totalPoints > pointCap) {
    throw new HttpsError("invalid-argument", `Lineup exceeds ${pointCap} point limit for ${corpsClass}. Total: ${totalPoints}`);
  }

  // 3. --- Get Season & Profile Data ---
  const db = getDb();
  const seasonSettingsRef = db.doc("game-settings/season");
  const seasonDoc = await seasonSettingsRef.get();
  if (!seasonDoc.exists || !seasonDoc.data().seasonUid) {
    throw new HttpsError("failed-precondition", "There is no active season.");
  }
  const seasonData = seasonDoc.data();
  const activeSeasonId = seasonData.seasonUid;

  // 4. --- Create Unique Lineup Key ---
  const lineupKey = `${corpsClass}_${Object.values(lineup).sort().join("_")}`;

  try {
    await db.runTransaction(async (transaction) => {
      const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
      const userProfileDoc = await transaction.get(userProfileRef);
      if (!userProfileDoc.exists) {
        throw new HttpsError("not-found", "User profile does not exist.");
      }
      
      const userProfileData = userProfileDoc.data();
      const currentCorpsData = userProfileData.corps?.[corpsClass];

      if (!currentCorpsData) {
        throw new HttpsError("not-found", `You must register a ${corpsClass} corps before saving a lineup.`);
      }

      // 5. --- Check Lineup Uniqueness ---
      const newActiveLineupRef = db.collection("activeLineups").doc(lineupKey);
      const existingLineupDoc = await transaction.get(newActiveLineupRef);
      if (existingLineupDoc.exists && existingLineupDoc.data().uid !== uid) {
        throw new HttpsError("already-exists", "This exact lineup has already been claimed.");
      }

      // 6. --- Check Trade Limits ---
      const oldLineupKey = currentCorpsData.lineupKey;
      const originalLineup = currentCorpsData.lineup || {};
      let newTrades = 0;
      Object.keys(lineup).forEach((caption) => {
        if (originalLineup[caption] !== lineup[caption]) newTrades++;
      });

      const profileUpdateData = {};

      if (newTrades > 0) {
        const now = new Date();
        const seasonStartDate = seasonData.schedule.startDate.toDate();
        const diffInMillis = now.getTime() - seasonStartDate.getTime();
        const currentDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
        const currentWeek = Math.ceil(currentDay / 7);

        let tradeLimit = 3; // Default
        if (seasonData.status === "off-season" && currentWeek === 1) tradeLimit = Infinity;
        if (seasonData.status === "live-season" && [1, 2, 3].includes(currentWeek)) tradeLimit = Infinity;

        if (tradeLimit !== Infinity) {
          const weeklyTrades = currentCorpsData.weeklyTrades || { week: 0, used: 0 };
          let tradesAlreadyUsed = (weeklyTrades.seasonUid === activeSeasonId &&
            weeklyTrades.week === currentWeek) ? weeklyTrades.used : 0;

          if (tradesAlreadyUsed + newTrades > tradeLimit) {
            throw new HttpsError("failed-precondition",
              `Exceeds trade limit. You have ${tradeLimit - tradesAlreadyUsed} trades remaining this week.`);
          }

          profileUpdateData[`corps.${corpsClass}.weeklyTrades`] = {
            seasonUid: activeSeasonId,
            week: currentWeek,
            used: tradesAlreadyUsed + newTrades,
          };
        }
      }

      // 7. --- Commit Changes ---
      if (oldLineupKey && oldLineupKey !== lineupKey) {
        transaction.delete(db.collection("activeLineups").doc(oldLineupKey));
      }
      
      transaction.set(newActiveLineupRef, {
        uid: uid,
        seasonId: activeSeasonId,
        corpsClass: corpsClass,
      });

      profileUpdateData[`corps.${corpsClass}.lineup`] = lineup;
      profileUpdateData[`corps.${corpsClass}.lineupKey`] = lineupKey;
      profileUpdateData.activeSeasonId = activeSeasonId; 

      transaction.update(userProfileRef, profileUpdateData);
    });

    return { success: true, message: `${corpsClass} lineup saved successfully!` };
  } catch (error) {
    logger.error(`[saveLineup] Transaction FAILED for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An error occurred while saving your lineup.");
  }
});

/**
 * Task 3.3: Saves a user's selected shows for the week.
 */
// Add { cors: true } here
exports.selectUserShows = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const uid = request.auth.uid;
  const { week, shows, corpsClass } = request.data;

  //
  if (!week || !shows || !Array.isArray(shows) || shows.length > 4) {
    throw new HttpsError("invalid-argument",
      "Invalid data. A week number and a maximum of 4 shows are required.");
  }

  if (!corpsClass || !["worldClass", "openClass", "aClass", "soundSport"].includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Valid corps class is required.");
  }

  const db = getDb();

  // Validate that the week is not in the past
  const seasonRef = db.doc("game-settings/season");
  const seasonDoc = await seasonRef.get();

  if (!seasonDoc.exists) {
    throw new HttpsError("failed-precondition", "No active season found.");
  }

  const seasonData = seasonDoc.data();
  if (seasonData.schedule?.startDate) {
    const startDate = seasonData.schedule.startDate.toDate();
    const now = new Date();
    const diffInMillis = now.getTime() - startDate.getTime();
    const diffInDays = Math.floor(diffInMillis / (1000 * 60 * 60 * 24));
    const currentWeek = Math.max(1, Math.ceil((diffInDays + 1) / 7));

    if (week < currentWeek) {
      throw new HttpsError("failed-precondition",
        `Cannot select shows for week ${week}. The current week is ${currentWeek}. You can only modify the current or future weeks.`);
    }
  }

  const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    await userProfileRef.update({
      [`corps.${corpsClass}.selectedShows.week${week}`]: shows,
    });
    return { success: true, message: `Successfully saved selections for week ${week}.` };
  } catch (error) {
    logger.error(`Failed to save show selections for user ${uid}:`, error);
    throw new HttpsError("internal", "Could not save your show selections.");
  }
});

/**
 * Save show concept (theme, music source, drill style) for synergy bonuses
 */
exports.saveShowConcept = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { corpsClass, showConcept } = request.data;
  const uid = request.auth.uid;

  // Validate inputs
  const validClasses = ["worldClass", "openClass", "aClass", "soundSport"];
  if (!validClasses.includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Invalid corps class specified.");
  }

  if (!showConcept || !showConcept.theme || !showConcept.musicSource || !showConcept.drillStyle) {
    throw new HttpsError("invalid-argument", "Complete show concept required (theme, musicSource, drillStyle).");
  }

  const db = getDb();
  const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    await userProfileRef.update({
      [`corps.${corpsClass}.showConcept`]: {
        theme: showConcept.theme,
        musicSource: showConcept.musicSource,
        drillStyle: showConcept.drillStyle,
        updatedAt: new Date()
      }
    });

    logger.info(`User ${uid} saved show concept for ${corpsClass}`);
    return { success: true, message: "Show concept saved successfully!" };
  } catch (error) {
    logger.error(`Failed to save show concept for user ${uid}:`, error);
    throw new HttpsError("internal", "Could not save show concept.");
  }
});