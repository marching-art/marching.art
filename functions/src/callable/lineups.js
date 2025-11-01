const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb, dataNamespaceParam } = require("../config");
const { logger } = require("firebase-functions/v2");

exports.validateAndSaveLineup = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to save a lineup.");
  }
  const { lineup, corpsName, corpsClass } = request.data;
  const uid = request.auth.uid;

  const validClasses = ["worldClass", "openClass", "aClass", "soundSport"];
  if (!validClasses.includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Invalid corps class specified.");
  }

  const pointCaps = {
    worldClass: 150,
    openClass: 120,
    aClass: 60,
    soundSport: 90,
  };
  const pointCap = pointCaps[corpsClass];

  if (!lineup || Object.keys(lineup).length !== 8) {
    throw new HttpsError("invalid-argument", "A complete 8-caption lineup is required.");
  }

  const totalPoints = Object.values(lineup).reduce((sum, selection) => {
    const [, points] = selection.split("|");
    return sum + (Number(points) || 0);
  }, 0);

  if (totalPoints > pointCap) {
    throw new HttpsError("invalid-argument", `Lineup exceeds ${pointCap} point limit for ${corpsClass}.`);
  }

  const lineupKey = `${corpsClass}_${Object.values(lineup).sort().join("_")}`;

  const seasonSettingsRef = getDb().doc("game-settings/season");
  const seasonDoc = await seasonSettingsRef.get();
  if (!seasonDoc.exists || !seasonDoc.data().seasonUid) {
    throw new HttpsError("failed-precondition", "There is no active season.");
  }
  const seasonData = seasonDoc.data();
  const activeSeasonId = seasonData.seasonUid;

  try {
    await getDb().runTransaction(async (transaction) => {
      const userProfileRef = getDb().doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
      const userProfileDoc = await transaction.get(userProfileRef);
      if (!userProfileDoc.exists) {
        throw new HttpsError("not-found", "User profile does not exist.");
      }

      const newActiveLineupRef = getDb().collection("activeLineups").doc(lineupKey);
      const existingLineupDoc = await transaction.get(newActiveLineupRef);
      if (existingLineupDoc.exists && existingLineupDoc.data().uid !== uid) {
        throw new HttpsError("already-exists", "This exact lineup has already been claimed.");
      }

      const userProfileData = userProfileDoc.data();

      if (!userProfileData.corps) {
        userProfileData.corps = {};
      }

      const isNewSeasonSignup = userProfileData.activeSeasonId !== activeSeasonId;
      const currentCorpsData = userProfileData.corps[corpsClass] || {};
      const isNewCorps = !currentCorpsData.corpsName;
      const oldLineupKey = currentCorpsData.lineupKey;

      if (oldLineupKey && oldLineupKey !== lineupKey) {
        transaction.delete(getDb().collection("activeLineups").doc(oldLineupKey));
      }

      transaction.set(newActiveLineupRef, {
        uid: uid,
        seasonId: activeSeasonId,
        corpsClass: corpsClass,
      });

      let profileUpdateData = {};

      if (isNewSeasonSignup || isNewCorps) {
        if (!corpsName) throw new HttpsError("invalid-argument", "A corps name is required.");

        profileUpdateData = {
          activeSeasonId: activeSeasonId,
          [`corps.${corpsClass}`]: {
            corpsName: corpsName,
            lineup: lineup,
            lineupKey: lineupKey,
            totalSeasonScore: 0,
            selectedShows: {},
            weeklyTrades: { seasonUid: activeSeasonId, week: 1, used: 0 },
            lastScoredDay: 0,
          },
        };
      } else {
        const now = new Date();
        const seasonStartDate = seasonData.schedule.startDate.toDate();
        const diffInMillis = now.getTime() - seasonStartDate.getTime();
        const currentDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
        const currentWeek = Math.ceil(currentDay / 7);

        let tradeLimit = 3;
        if (seasonData.status === "off-season" && currentWeek === 1) tradeLimit = Infinity;
        if (seasonData.status === "live-season" && [1, 2, 3].includes(currentWeek)) tradeLimit = Infinity;

        const originalLineup = currentCorpsData.lineup || {};
        let newTrades = 0;
        Object.keys(lineup).forEach((caption) => {
          if (originalLineup[caption] !== lineup[caption]) newTrades++;
        });

        if (newTrades > 0 && tradeLimit !== Infinity) {
          const weeklyTrades = currentCorpsData.weeklyTrades || { week: 0, used: 0 };
          let tradesAlreadyUsed = (weeklyTrades.seasonUid === activeSeasonId &&
            weeklyTrades.week === currentWeek) ? weeklyTrades.used : 0;

          if (tradesAlreadyUsed + newTrades > tradeLimit) {
            throw new HttpsError("failed-precondition",
              `Exceeds trade limit. You have ${tradeLimit - tradesAlreadyUsed} trades remaining.`);
          }

          profileUpdateData[`corps.${corpsClass}.weeklyTrades`] = {
            seasonUid: activeSeasonId,
            week: currentWeek,
            used: tradesAlreadyUsed + newTrades,
          };
        }

        profileUpdateData[`corps.${corpsClass}.lineup`] = lineup;
        profileUpdateData[`corps.${corpsClass}.lineupKey`] = lineupKey;

        if (corpsName) {
          profileUpdateData[`corps.${corpsClass}.corpsName`] = corpsName;
        }
      }

      transaction.update(userProfileRef, profileUpdateData);
    });
    return { success: true, message: `${corpsClass} lineup saved successfully!` };
  } catch (error) {
    logger.error(`[validateAndSaveLineup] Transaction FAILED for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An error occurred while saving your lineup.");
  }
});

exports.selectUserShows = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const uid = request.auth.uid;
  const { week, shows, corpsClass } = request.data;

  if (!week || !shows || !Array.isArray(shows) || shows.length > 4) {
    throw new HttpsError("invalid-argument",
      "Invalid data. A week number and a maximum of 4 shows are required.");
  }

  if (!corpsClass || !["worldClass", "openClass", "aClass", "soundSport"].includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Valid corps class is required.");
  }

  const userProfileRef = getDb().doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

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