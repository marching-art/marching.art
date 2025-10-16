const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { PubSub } = require("@google-cloud/pubsub");
const { CloudTasksClient } = require("@google-cloud/tasks");
const axios = require("axios");
const cheerio = require("cheerio");
const { getDb, appId } = require("./_config");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const { Timestamp, getFirestore, getDoc, serverTimestamp } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

const pubsubClient = new PubSub();
const tasksClient = new CloudTasksClient();
const PAGINATION_TOPIC = "dci-pagination-topic";
const LIVE_SCORES_TOPIC = "live-scores-topic";

// ================================================================= //
//                      EXPORTED CLOUD FUNCTIONS                     //
// ================================================================= //

exports.helloWorld = onRequest({ cors: true }, (req, res) => {
  logger.info("Hello Logs!", { structuredData: true });
  res.send("Hello from Firebase! Check your Cloud Function logs.");
});

exports.setUserRole = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied",
      "You must be an admin to perform this action.");
  }

  const { email, makeAdmin } = request.data;
  logger.info(`Admin ${request.auth.uid} attempting to set role for ${email} to admin: ${makeAdmin}`);

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { admin: makeAdmin });

    const action = makeAdmin ? "granted" : "revoked";
    return {
      success: true,
      message: `Admin privileges have been ${action} for ${email}. User must re-login to see changes.`
    };
  } catch (error) {
    logger.error(`Error setting user role for ${email}:`, error);
    if (error.code === "auth/user-not-found") {
      throw new HttpsError("not-found", `User with email ${email} was not found.`);
    }
    throw new HttpsError("internal", "An error occurred while setting the user role.");
  }
});

exports.checkUsername = onCall({ cors: true }, async (request) => {
  const { username } = request.data;
  if (!username || username.length < 3 || username.length > 15) {
    throw new HttpsError("invalid-argument",
      "Username must be between 3 and 15 characters.");
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new HttpsError("invalid-argument",
      "Username can only contain letters, numbers, and underscores.");
  }

  const usernameRef = getDb().doc(`usernames/${username.toLowerCase()}`);
  const usernameDoc = await usernameRef.get();

  if (usernameDoc.exists) {
    throw new HttpsError("already-exists", "This username is already taken.");
  }

  return { success: true, message: "Username is available." };
});

exports.startNewOffSeason = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
  }
  try {
    logger.info(`Manual override triggered by admin: ${request.auth.uid}. Starting new off-season.`);
    await startNewOffSeason();
    return { success: true, message: "A new off-season has been started successfully." };
  } catch (error) {
    logger.error("Error manually starting new off-season:", error);
    throw new HttpsError("internal", "An error occurred while starting the season.");
  }
});

exports.startNewLiveSeason = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
  }
  try {
    logger.info(`Manual override triggered by admin: ${request.auth.uid}. Starting new live-season.`);
    await startNewLiveSeason();
    return { success: true, message: "A new live-season has been started successfully." };
  } catch (error) {
    logger.error("Error manually starting new live-season:", error);
    throw new HttpsError("internal", `An error occurred while starting the live season: ${error.message}`);
  }
});

exports.validateAndSaveLineup = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to save a lineup.");
  }
  const { lineup, corpsName, corpsClass } = request.data;
  const uid = request.auth.uid;

  // Validate corpsClass
  const validClasses = ["worldClass", "openClass", "aClass"];
  if (!validClasses.includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Invalid corps class specified.");
  }

  // Set point caps based on class
  const pointCaps = {
    worldClass: 150,
    openClass: 120,
    aClass: 60
  };
  const pointCap = pointCaps[corpsClass];

  if (!lineup || Object.keys(lineup).length !== 8) {
    throw new HttpsError("invalid-argument", "A complete 8-caption lineup is required.");
  }

  // Calculate total points and validate
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
      const userProfileRef = getDb().doc(`artifacts/${appId}/users/${uid}/profile/data`);
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

      // Initialize corps structure if it doesn't exist
      if (!userProfileData.corps) {
        userProfileData.corps = {};
      }

      const isNewSeasonSignup = userProfileData.activeSeasonId !== activeSeasonId;
      const currentCorpsData = userProfileData.corps[corpsClass] || {};
      const isNewCorps = !currentCorpsData.corpsName; // This specific corps class doesn't exist yet
      const oldLineupKey = currentCorpsData.lineupKey;

      // Remove old lineup from activeLineups if it exists and is different
      if (oldLineupKey && oldLineupKey !== lineupKey) {
        transaction.delete(getDb().collection("activeLineups").doc(oldLineupKey));
      }

      // Set new lineup in activeLineups
      transaction.set(newActiveLineupRef, {
        uid: uid,
        seasonId: activeSeasonId,
        corpsClass: corpsClass
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
            lastScoredDay: 0
          }
        };
      } else {
        // Handle trades and existing season logic
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
        Object.keys(lineup).forEach(caption => {
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
            used: tradesAlreadyUsed + newTrades
          };
        }

        profileUpdateData[`corps.${corpsClass}.lineup`] = lineup;
        profileUpdateData[`corps.${corpsClass}.lineupKey`] = lineupKey;

        // Update corps name if provided
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

exports.processDciScores = onMessagePublished("dci-scores-topic", async (message) => {
  logger.info("Received new historical scores to process.");
  try {
    const payloadBuffer = Buffer.from(message.data.message.data, "base64").toString("utf-8");
    const { eventName, scores, eventLocation, eventDate, year } = JSON.parse(payloadBuffer);

    if (!scores || scores.length === 0 || !year) {
      logger.warn("Payload was missing scores or year. Exiting function.", { eventName, year });
      return;
    }

    const docId = year.toString();
    const yearDocRef = getDb().collection("historical_scores").doc(docId);

    const parsedEventDate = new Date(eventDate);
    const offSeasonDay = calculateOffSeasonDay(parsedEventDate, year);

    const newEventData = {
      eventName: eventName,
      date: eventDate,
      location: eventLocation,
      scores: scores,
      headerMap: {},
      offSeasonDay: offSeasonDay
    };

    await getDb().runTransaction(async (transaction) => {
      const yearDoc = await transaction.get(yearDocRef);

      if (!yearDoc.exists) {
        logger.info(`Creating new document for year ${year}.`);
        transaction.set(yearDocRef, { data: [newEventData] });
      } else {
        let existingData = yearDoc.data().data || [];
        const eventIndex = existingData.findIndex(event =>
          event.eventName === newEventData.eventName &&
          new Date(event.date).getTime() === new Date(newEventData.date).getTime()
        );

        // === UPDATED LOGIC TO MERGE MISSING SCORES ===
        if (eventIndex > -1) {
          logger.info(`Event "${newEventData.eventName}" already exists. Checking for missing scores to merge.`);
          let eventToUpdate = existingData[eventIndex];
          let hasBeenUpdated = false;

          for (const newScore of newEventData.scores) {
            const existingScoreIndex = eventToUpdate.scores.findIndex(s => s.corps === newScore.corps);

            if (existingScoreIndex === -1) {
              // This corps was not in the original scrape, add it.
              eventToUpdate.scores.push(newScore);
              hasBeenUpdated = true;
              logger.info(`Adding missing corps entry for ${newScore.corps}.`);
            } else {
              // The corps exists, check for missing captions.
              let existingScore = eventToUpdate.scores[existingScoreIndex];
              let captionsUpdated = false;
              for (const caption in newScore.captions) {
                if (newScore.captions[caption] > 0 &&
                  (!existingScore.captions[caption] || existingScore.captions[caption] === 0)) {
                  existingScore.captions[caption] = newScore.captions[caption];
                  captionsUpdated = true;
                }
              }
              if (captionsUpdated) {
                hasBeenUpdated = true;
                logger.info(`Updated captions for ${newScore.corps}.`);
              }
            }
          }

          if (hasBeenUpdated) {
            existingData[eventIndex] = eventToUpdate;
            transaction.update(yearDocRef, { data: existingData });
            logger.info(`Successfully merged new scores into event: ${newEventData.eventName}`);
          } else {
            logger.info(`No new scores to merge for event: ${newEventData.eventName}. Skipping.`);
          }
        } else {
          // Event does not exist, add it to the array.
          const updatedData = [...existingData, newEventData];
          const logMsg = `Appending new event to document for year ${year}. Total events: ${updatedData.length}`;
          logger.info(logMsg);
          transaction.update(yearDocRef, { data: updatedData });
        }
      }
    });

    logger.info(
      `Successfully processed and archived scores to historical_scores/${docId} ` +
      `with offSeasonDay: ${offSeasonDay}`,
    );

  } catch (error) {
    logger.error("Error processing and archiving historical scores:", error);
  }
});

exports.scrapeDciScores = onSchedule({
  schedule: "every 15 minutes from 19:00 to 01:50",
  timeZone: "America/New_York",
}, async () => {
  logger.info("Running live score scraper...");
  const db = getDb();
  const seasonDoc = await db.doc("game-settings/season").get();

  if (!seasonDoc.exists || seasonDoc.data().status !== "live-season") {
    logger.info("No active live season. Scraper will not run.");
    return;
  }

  try {
    const urlToScrape = "https://www.dci.org/scores?pageno=1";
    const { data } = await axios.get(urlToScrape);
    const $ = cheerio.load(data);
    const recapLinkSelector = "a.arrow-btn[href*=\"/scores/recap/\"]";
    const latestRecapLink = $(recapLinkSelector).first().attr("href");

    if (latestRecapLink) {
      const fullUrl = new URL(latestRecapLink, "https://www.dci.org").href;
      await scrapeDciScoresLogic(fullUrl, LIVE_SCORES_TOPIC);
    } else {
      logger.info("No new recap links found on scores page 1.");
    }
  } catch (error) {
    logger.error("Error during live score scraping:", error);
  }
});

exports.seasonScheduler = onSchedule({
  schedule: "every day 03:00",
  timeZone: "America/New_York",
}, async () => {
  logger.info("Running daily season scheduler...");
  const now = new Date();
  const seasonSettingsRef = getDb().doc("game-settings/season");
  const seasonDoc = await seasonSettingsRef.get();

  if (!seasonDoc.exists) {
    logger.info("No season document found. Starting first off-season.");
    await startNewOffSeason();
    return;
  }

  const seasonData = seasonDoc.data();
  if (!seasonData.schedule || !seasonData.schedule.endDate) {
    logger.warn("Season doc is malformed. Starting new off-season to correct.");
    await startNewOffSeason();
    return;
  }

  const seasonEndDate = seasonData.schedule.endDate.toDate();
  if (now < seasonEndDate) {
    logger.info(`Current season (${seasonData.name}) is active. No action taken.`);
    return;
  }

  logger.info(`Season ${seasonData.name} has ended. Starting next season.`);
  const today = new Date();
  const currentYear = today.getFullYear();
  const liveSeasonStartDate = new Date(currentYear, 5, 15);

  if (seasonData.status === "off-season" && today >= liveSeasonStartDate) {
    logger.info("It's time for the live season! Starting now.");
    await startNewLiveSeason();
  } else {
    logger.info("Starting a new off-season.");
    await startNewOffSeason();
  }
});

exports.dailyOffSeasonProcessor = onSchedule({
  schedule: "every day 02:00",
  timeZone: "America/New_York",
}, async () => {
  await processAndArchiveOffSeasonScoresLogic();
});

exports.processDailyLiveScores = onSchedule({
  schedule: "every day 02:00",
  timeZone: "America/New_York",
}, async () => { // Removed unused `_context` parameter to satisfy linter
  const db = getDb();
  logger.info("Running Daily Live Season Score Processor...");

  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists() || seasonDoc.data().status !== "live-season") {
    logger.info("No active live season found. Exiting processor.");
    return;
  }

  const seasonData = seasonDoc.data();
  const seasonStartDate = seasonData.schedule.startDate.toDate();

  const now = new Date();
  const diffInMillis = now.getTime() - seasonStartDate.getTime();
  const millisInDay = 1000 * 60 * 60 * 24;
  const currentDay = Math.floor(diffInMillis / millisInDay) + 1;

  if (currentDay < 1) {
    return;
  }

  logger.info(`Processing live season predicted scores for Day: ${currentDay}`);

  const historicalData = await fetchHistoricalData(seasonData.dataDocId);

  // Get shows happening today that have actual scores posted
  const showsToday = [];
  const liveScoresTodayRef = db.collection(`live_scores/${seasonData.seasonUid}/scores`).where("day", "==", currentDay);
  const liveScoresTodaySnap = await liveScoresTodayRef.get();
  liveScoresTodaySnap.forEach((doc) => {
    const eventName = doc.data().eventName;
    if (!showsToday.includes(eventName)) {
      showsToday.push(eventName);
    }
  });

  const profilesQuery = db.collectionGroup("profile").where("activeSeasonId", "==", seasonData.seasonUid);
  const profilesSnapshot = await profilesQuery.get();
  if (profilesSnapshot.empty) {
    return;
  }

  const batch = db.batch();
  const showResult = {
    eventName: `Predicted Scores - Day ${currentDay}`,
    location: "Cloud Arena",
    results: [],
  };

  for (const userDoc of profilesSnapshot.docs) {
    const userProfile = userDoc.data();

    // Handle both old and new profile structures
    const userCorps = userProfile.corps || {};
    if (userProfile.corpsName && !userCorps.worldClass) {
      userCorps.worldClass = {
        corpsName: userProfile.corpsName,
        lineup: userProfile.lineup,
        selectedShows: userProfile.selectedShows,
        totalSeasonScore: userProfile.totalSeasonScore || 0,
      };
    }

    // BUG FIX: Replaced a .forEach loop with a for...of loop to correctly handle async operations.
    for (const corpsClass of Object.keys(userCorps)) {
      const corps = userCorps[corpsClass];
      if (!corps || !corps.corpsName || !corps.lineup) {
        continue; // Use continue for loops
      }

      const userShows = Object.values(corps.selectedShows || {}).flat();
      const attendedRealShowToday = userShows.some((s) => showsToday.includes(s.eventName));

      if (attendedRealShowToday) {
        logger.info("User attended a real show today, skipping prediction.");
        continue;
      }

      // Calculate predicted scores for this corps
      let geScore = 0;
      let rawVisualScore = 0;
      let rawMusicScore = 0;
      for (const caption in corps.lineup) {
        const [selectedCorps, , sourceYear] = corps.lineup[caption].split("|");
        const captionScore = await getLiveCaptionScore(selectedCorps, sourceYear, caption, currentDay, historicalData);
        if (["GE1", "GE2"].includes(caption)) {
          geScore += captionScore;
        } else if (["VP", "VA", "CG"].includes(caption)) {
          rawVisualScore += captionScore;
        } else if (["B", "MA", "P"].includes(caption)) {
          rawMusicScore += captionScore;
        }
      }

      const visualScore = rawVisualScore / 2;
      const musicScore = rawMusicScore / 2;
      const totalScore = geScore + visualScore + musicScore;

      if (totalScore > 0) {
        // Update user's score for the leaderboard
        batch.update(userDoc.ref, {
          [`corps.${corpsClass}.totalSeasonScore`]: totalScore,
        });

        // Add result to the recap object
        showResult.results.push({
          uid: userDoc.ref.parent.parent.id,
          corpsClass: corpsClass,
          corpsName: corps.corpsName,
          totalScore,
          geScore,
          visualScore,
          musicScore,
        });
      }
    }
  }

  // Save the recap document
  const recapDocRef = db.doc(`fantasy_recaps/${seasonData.seasonUid}`);
  const recapDoc = await recapDocRef.get();
  const dailyRecap = { offSeasonDay: currentDay, date: new Date(), shows: [showResult] };

  if (!recapDoc.exists) {
    batch.set(recapDocRef, { seasonName: seasonData.name, recaps: [dailyRecap] });
  } else {
    const existingRecaps = recapDoc.data().recaps || [];
    const updatedRecaps = existingRecaps.filter((r) => r.offSeasonDay !== currentDay);
    updatedRecaps.push(dailyRecap);
    batch.update(recapDocRef, { recaps: updatedRecaps });
  }

  await batch.commit();
  logger.info("Daily Live Season Score Processor & Archiver finished.");
});

exports.getShowRegistrations = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");

  const { week, eventName, date } = request.data;
  if (!week || !eventName || !date) {
    throw new HttpsError("invalid-argument", "Missing required show data.");
  }

  const db = getDb();
  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) throw new HttpsError("not-found", "No active season.");

  const activeSeasonId = seasonDoc.data().seasonUid;
  if (!activeSeasonId) {
    throw new HttpsError("not-found", "Active season UID is not configured.");
  }

  const registrations = [];
  const q = db.collectionGroup("profile").where("activeSeasonId", "==", activeSeasonId);
  const querySnapshot = await q.get();

  querySnapshot.forEach(doc => {
    const profile = doc.data();
    const userCorps = profile.corps || {};

    // Iterate over each of the user's corps to check for registration
    for (const corpsClass in userCorps) {
      const corps = userCorps[corpsClass];
      const showsForWeek = corps.selectedShows ? corps.selectedShows[`week${week}`] : [];

      if (showsForWeek && showsForWeek.some(s => s.eventName === eventName && s.date === date)) {
        registrations.push({
          corpsName: corps.corpsName || "Unnamed Corps",
          corpsClass: corpsClass,
          username: profile.username,
        });
      }
    }
  });

  return { registrations: registrations };
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

  if (!corpsClass || !["worldClass", "openClass", "aClass"].includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Valid corps class is required.");
  }

  const userProfileRef = getDb().doc(`artifacts/${appId}/users/${uid}/profile/data`);

  try {
    await userProfileRef.update({
      [`corps.${corpsClass}.selectedShows.week${week}`]: shows
    });
    return { success: true, message: `Successfully saved selections for week ${week}.` };
  } catch (error) {
    logger.error(`Failed to save show selections for user ${uid}:`, error);
    throw new HttpsError("internal", "Could not save your show selections.");
  }
});

exports.createLeague = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to create a league.");
  }
  const { leagueName } = request.data;
  const uid = request.auth.uid;

  if (!leagueName || leagueName.trim().length < 3) {
    throw new HttpsError("invalid-argument", "League name must be at least 3 characters long.");
  }

  const db = getDb();
  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) throw new HttpsError("not-found", "No active season.");
  const activeSeasonId = seasonDoc.data().seasonUid;

  let inviteCode;
  let codeExists = true;
  while (codeExists) {
    inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const inviteDoc = await db.doc(`leagueInvites/${inviteCode}`).get();
    codeExists = inviteDoc.exists;
  }

  const leagueRef = db.collection("leagues").doc();
  const inviteRef = db.doc(`leagueInvites/${inviteCode}`);
  const userProfileRef = db.doc(`artifacts/${appId}/users/${uid}/profile/data`);

  await db.runTransaction(async (transaction) => {
    transaction.set(leagueRef, {
      name: leagueName.trim(),
      creatorUid: uid,
      seasonUid: activeSeasonId,
      members: [uid],
      inviteCode: inviteCode
    });
    transaction.set(inviteRef, { leagueId: leagueRef.id });
    transaction.update(userProfileRef, {
      leagueIds: admin.firestore.FieldValue.arrayUnion(leagueRef.id)
    });
  });

  return { success: true, message: "League created!", inviteCode: inviteCode, leagueId: leagueRef.id };
});

exports.joinLeague = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to join a league.");
  }
  const { inviteCode } = request.data;
  const uid = request.auth.uid;

  if (!inviteCode) throw new HttpsError("invalid-argument", "An invite code is required.");

  const db = getDb();
  const inviteRef = db.doc(`leagueInvites/${inviteCode.toUpperCase()}`);
  const inviteDoc = await inviteRef.get();

  if (!inviteDoc.exists) {
    throw new HttpsError("not-found", "This invite code is invalid.");
  }
  const { leagueId } = inviteDoc.data();

  const leagueRef = db.doc(`leagues/${leagueId}`);
  const userProfileRef = db.doc(`artifacts/${appId}/users/${uid}/profile/data`);

  await db.runTransaction(async (transaction) => {
    const leagueDoc = await transaction.get(leagueRef);
    if (!leagueDoc.exists) throw new HttpsError("not-found", "The associated league no longer exists.");

    transaction.update(leagueRef, {
      members: admin.firestore.FieldValue.arrayUnion(uid)
    });
    transaction.update(userProfileRef, {
      leagueIds: admin.firestore.FieldValue.arrayUnion(leagueId)
    });
  });

  return { success: true, message: "Successfully joined league!" };
});

exports.leaveLeague = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to leave a league.");
  }
  const { leagueId } = request.data;
  const uid = request.auth.uid;

  if (!leagueId) {
    throw new HttpsError("invalid-argument", "A league ID is required.");
  }

  const db = getDb();
  const leagueRef = db.doc(`leagues/${leagueId}`);
  const userProfileRef = db.doc(`artifacts/${appId}/users/${uid}/profile/data`);

  try {
    await db.runTransaction(async (transaction) => {
      const leagueDoc = await transaction.get(leagueRef);
      if (!leagueDoc.exists) {
        throw new HttpsError("not-found", "This league does not exist.");
      }

      const leagueData = leagueDoc.data();

      if (leagueData.creatorUid === uid && leagueData.members.length === 1) {
        logger.info(`Creator ${uid} is the last member of league ${leagueId}. Deleting league.`);
        transaction.delete(leagueRef);
        if (leagueData.inviteCode) {
          const inviteRef = db.doc(`leagueInvites/${leagueData.inviteCode}`);
          transaction.delete(inviteRef);
        }
      } else {
        transaction.update(leagueRef, {
          members: admin.firestore.FieldValue.arrayRemove(uid)
        });
      }

      transaction.update(userProfileRef, {
        leagueIds: admin.firestore.FieldValue.arrayRemove(leagueId)
      });
    });

    return { success: true, message: "Successfully left the league." };

  } catch (error) {
    logger.error(`Failed to leave league ${leagueId} for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An error occurred while leaving the league.");
  }
});

exports.manualTrigger = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
  }

  const { jobName } = request.data;
  logger.info(`Admin ${request.auth.uid} is manually triggering job: ${jobName}`);

  try {
    switch (jobName) {
    case "calculateCorpsStatistics":
      await calculateCorpsStatisticsLogic();
      return { success: true, message: "Successfully calculated and saved corps statistics." };
    case "archiveSeasonResults":
      await archiveSeasonResultsLogic();
      return { success: true, message: "Season results and league champions have been archived." };
    case "processAndArchiveOffSeasonScores":
      await processAndArchiveOffSeasonScoresLogic();
      return { success: true, message: "Off-Season Score Processor & Archiver finished successfully." };
    default:
      throw new HttpsError("not-found", `Job named '${jobName}' was not found.`);
    }
  } catch (error) {
    logger.error(`Manual trigger for job '${jobName}' failed:`, error);
    throw new HttpsError("internal", `An error occurred while running ${jobName}.`);
  }
});

exports.sendCommentNotification = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to send a notification.");
  }
  const { recipientUid, commenterUsername } = request.data;
  const commenterUid = request.auth.uid;

  if (!recipientUid || !commenterUsername) {
    throw new HttpsError("invalid-argument", "Missing recipient UID or commenter username.");
  }

  // Prevent users from sending notifications to themselves
  if (recipientUid === commenterUid) {
    return { success: true, message: "Self-notification ignored." };
  }

  const db = getDb();
  const notificationRef = db.collection(`artifacts/${appId}/users/${recipientUid}/notifications`).doc();

  try {
    await notificationRef.set({
      type: "new_comment",
      message: `${commenterUsername} left a comment on your profile.`,
      link: `/profile/${commenterUid}`, // Link back to the commenter's profile
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      isRead: false,
      senderUid: commenterUid,
    });
    logger.info(`Notification sent from ${commenterUid} to ${recipientUid}`);
    return { success: true, message: "Notification sent." };
  } catch (error) {
    logger.error("Error sending comment notification:", error);
    throw new HttpsError("internal", "An error occurred while sending the notification.");
  }
});

exports.deleteComment = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to delete comments.");
  }

  const { profileOwnerId, commentId } = request.data;
  const callerUid = request.auth.uid;
  const isAdmin = request.auth.token.admin === true;

  if (!profileOwnerId || !commentId) {
    throw new HttpsError("invalid-argument", "Missing profile owner ID or comment ID.");
  }

  // Security Check: Only the profile owner or an admin can delete.
  if (callerUid !== profileOwnerId && !isAdmin) {
    throw new HttpsError("permission-denied", "You do not have permission to delete this comment.");
  }

  try {
    const commentRef = getDb().doc(`artifacts/${appId}/users/${profileOwnerId}/comments/${commentId}`);
    await commentRef.delete();
    return { success: true, message: "Comment deleted successfully." };
  } catch (error) {
    logger.error(`Error deleting comment ${commentId} by user ${callerUid}:`, error);
    throw new HttpsError("internal", "An error occurred while deleting the comment.");
  }
});

exports.reportComment = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to report comments.");
  }

  const { profileOwnerId, commentId, commentText, commentAuthorUid } = request.data;
  const reporterUid = request.auth.uid;

  if (!profileOwnerId || !commentId || !commentText || !commentAuthorUid) {
    throw new HttpsError("invalid-argument", "Missing required report data.");
  }

  try {
    const reportRef = getDb().collection("reports").doc();
    await reportRef.set({
      type: "comment",
      commentId,
      commentText,
      commentAuthorUid,
      reportedOnProfileUid: profileOwnerId,
      reporterUid,
      status: "new", // 'new', 'reviewed', 'resolved'
      createdAt: serverTimestamp(),
    });
    return { success: true, message: "Comment reported. Thank you for your feedback." };
  } catch (error) {
    logger.error(`Error reporting comment ${commentId} by user ${reporterUid}:`, error);
    throw new HttpsError("internal", "Could not submit report.");
  }
});

exports.generateWeeklyMatchups = onSchedule({
  schedule: "every monday 04:00",
  timeZone: "America/New_York",
}, async () => {
  logger.info("Starting class-based weekly matchup generation...");
  const db = getFirestore();
  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists()) {
    logger.error("No active season found. Aborting.");
    return;
  }
  const seasonData = seasonDoc.data();
  const now = new Date();
  const diffInMillis = now.getTime() - seasonData.schedule.startDate.toDate().getTime();
  const currentWeek = Math.ceil((Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1) / 7);

  const leaguesSnapshot = await db.collection("leagues").get();
  if (leaguesSnapshot.empty) return;

  const batch = db.batch();
  const corpsClasses = ["worldClass", "openClass", "aClass"];

  for (const leagueDoc of leaguesSnapshot.docs) {
    const league = leagueDoc.data();
    const members = league.members || [];
    if (members.length < 2) continue;

    const weeklyMatchupData = {
      week: currentWeek,
      seasonUid: seasonData.seasonUid
    };

    // Fetch all member profiles at once for efficiency
    const profilePromises = members.map(uid => db.doc(`artifacts/${appId}/users/${uid}/profile/data`).get());
    const profileDocs = await Promise.all(profilePromises);

    for (const corpsClass of corpsClasses) {
      // Find all members in the league who have a corps of the current class
      const eligibleMembers = profileDocs
        .filter(pDoc => pDoc.exists() && pDoc.data().corps && pDoc.data().corps[corpsClass])
        .map(pDoc => pDoc.ref.parent.parent.id); // Get the UID

      if (eligibleMembers.length < 2) continue; // Not enough players for a matchup in this class

      const shuffledMembers = [...eligibleMembers].sort(() => 0.5 - Math.random());
      const matchups = [];
      while (shuffledMembers.length > 1) {
        const p1 = shuffledMembers.pop();
        const p2 = shuffledMembers.pop();
        matchups.push({ pair: [p1, p2], scores: { [p1]: 0, [p2]: 0 }, winner: null });
      }
      if (shuffledMembers.length === 1) {
        const p = shuffledMembers.pop();
        matchups.push({ pair: [p, "BYE"], scores: { [p]: 0 }, winner: p });
      }

      // Store matchups in a class-specific field
      weeklyMatchupData[`${corpsClass}Matchups`] = matchups;
    }

    const matchupDocRef = db.doc(`leagues/${leagueDoc.id}/matchups/week${currentWeek}`);
    batch.set(matchupDocRef, weeklyMatchupData);
    logger.info(`Generated matchups for league ${league.name} for week ${currentWeek}.`);
  }

  await batch.commit();
  logger.info("Weekly matchup generation complete.");
  return null;
});

exports.processLiveScoreRecap = onMessagePublished(LIVE_SCORES_TOPIC, async (message) => {
  logger.info("Received new live score recap to process.");
  const db = getDb();

  try {
    const payloadBuffer = Buffer.from(message.data.message.data, "base64").toString("utf-8");
    const { eventName, scores, eventDate, location } = JSON.parse(payloadBuffer);

    const seasonDoc = await db.doc("game-settings/season").get();
    if (!seasonDoc.exists || seasonDoc.data().status !== "live-season") return;

    const seasonData = seasonDoc.data();
    const activeSeasonId = seasonData.seasonUid;
    const seasonStartDate = seasonData.schedule.startDate.toDate();

    const parsedEventDate = new Date(eventDate);
    const diffInMillis = parsedEventDate.getTime() - seasonStartDate.getTime();
    const eventDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;

    // Store individual corps scores
    const batch = db.batch();
    for (const scoreData of scores) {
      const docId = `${scoreData.corps.replace(/ /g, "_")}-${eventDay}`;
      const scoreDocRef = db.doc(`live_scores/${activeSeasonId}/scores/${docId}`);
      batch.set(scoreDocRef, {
        corpsName: scoreData.corps,
        day: eventDay,
        eventName: eventName,
        captions: scoreData.captions
      });
    }

    const profilesQuery = db.collectionGroup("profile").where("activeSeasonId", "==", activeSeasonId);
    const profilesSnapshot = await profilesQuery.get();
    if (profilesSnapshot.empty) {
      await batch.commit();
      return;
    }

    // Build recap object with results from all corps classes
    const showResult = {
      eventName: eventName,
      location: location || "Unknown Location",
      results: [],
    };

    for (const userDoc of profilesSnapshot.docs) {
      const userProfile = userDoc.data();
      const uid = userDoc.ref.parent.parent.id;

      // Handle both old and new profile structures
      const userCorps = userProfile.corps || {};
      if (userProfile.corpsName && !userCorps.worldClass) {
        userCorps.worldClass = {
          corpsName: userProfile.corpsName,
          lineup: userProfile.lineup,
          selectedShows: userProfile.selectedShows,
          totalSeasonScore: userProfile.totalSeasonScore || 0
        };
      }

      // Check each corps class for attendance at this show
      Object.keys(userCorps).forEach(corpsClass => {
        const corps = userCorps[corpsClass];
        if (!corps || !corps.corpsName || !corps.lineup) return;

        const userShows = Object.values(corps.selectedShows || {}).flat();
        const attendedShow = userShows.some(s => s.eventName === eventName);

        if (attendedShow) {
          let geScore = 0, rawVisualScore = 0, rawMusicScore = 0;

          // Calculate scores based on actual results
          for (const caption in corps.lineup) {
            const [selectedCorps, ,] = corps.lineup[caption].split("|");
            const corpsResult = scores.find(s => s.corps === selectedCorps);
            if (corpsResult && corpsResult.captions[caption]) {
              const captionScore = corpsResult.captions[caption];
              if (["GE1", "GE2"].includes(caption)) geScore += captionScore;
              else if (["VP", "VA", "CG"].includes(caption)) rawVisualScore += captionScore;
              else if (["B", "MA", "P"].includes(caption)) rawMusicScore += captionScore;
            }
          }

          const visualScore = rawVisualScore / 2;
          const musicScore = rawMusicScore / 2;
          const totalScore = geScore + visualScore + musicScore;

          if (totalScore > 0) {
            // Update this corps' score
            batch.update(userDoc.ref, {
              [`corps.${corpsClass}.totalSeasonScore`]: totalScore
            });

            // Add result to recap
            showResult.results.push({
              uid: uid,
              corpsClass: corpsClass,
              corpsName: corps.corpsName,
              totalScore, geScore, visualScore, musicScore
            });
          }
        }
      });
    }

    // Save the recap document
    const recapDocRef = db.doc(`fantasy_recaps/${activeSeasonId}`);
    const recapDoc = await recapDocRef.get();
    const dailyRecap = { offSeasonDay: eventDay, date: new Date(), shows: [showResult] };

    if (!recapDoc.exists) {
      batch.set(recapDocRef, { seasonName: seasonData.name, recaps: [dailyRecap] });
    } else {
      const existingRecaps = recapDoc.data().recaps || [];
      const updatedRecaps = existingRecaps.filter(r => r.offSeasonDay !== eventDay);
      updatedRecaps.push(dailyRecap);
      batch.update(recapDocRef, { recaps: updatedRecaps });
    }

    await batch.commit();
    logger.info(`Processed, scored, and archived recap for live event: ${eventName}.`);

  } catch (error) {
    logger.error("Error processing live score recap:", error);
  }
});

exports.getUserRankings = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to perform this action.");
  }
  const uid = request.auth.uid;
  const db = getDb();

  // 1. Get current season ID
  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) {
    throw new HttpsError("not-found", "No active season found.");
  }
  const activeSeasonId = seasonDoc.data().seasonUid;

  // 2. Query all profiles participating in the current season
  const profilesQuery = db.collectionGroup("profile").where("activeSeasonId", "==", activeSeasonId);
  const profilesSnapshot = await profilesQuery.get();

  if (profilesSnapshot.empty) {
    return { globalRank: 1, totalPlayers: 1 };
  }

  // 3. Process scores and find the user's rank
  const allPlayerScores = [];
  let myTotalScore = 0;

  profilesSnapshot.docs.forEach(doc => {
    const profile = doc.data();
    const userId = doc.ref.parent.parent.id;

    const userCorps = profile.corps || {};
    if (profile.corpsName && !userCorps.worldClass) {
      userCorps.worldClass = { totalSeasonScore: profile.totalSeasonScore || 0 };
    }
    const totalScore = Object.values(userCorps).reduce((sum, corps) => sum + (corps.totalSeasonScore || 0), 0);

    allPlayerScores.push(totalScore);
    if (userId === uid) {
      myTotalScore = totalScore;
    }
  });

  // 4. Calculate rank
  allPlayerScores.sort((a, b) => b - a);
  const rank = allPlayerScores.findIndex(score => score === myTotalScore) + 1;

  return {
    globalRank: rank > 0 ? rank : allPlayerScores.length,
    totalPlayers: allPlayerScores.length,
    totalScore: myTotalScore
  };
});

// ================================================================= //
//                      INTERNAL HELPER LOGIC                        //
// ================================================================= //

async function fetchHistoricalData(dataDocId) {
  const db = getDb();
  const corpsDataRef = db.doc(`dci-data/${dataDocId}`);
  const corpsDataSnap = await corpsDataRef.get();
  if (!corpsDataSnap.exists) {
    logger.error(`dci-data document ${dataDocId} not found.`);
    return {};
  }

  const seasonCorpsList = corpsDataSnap.data().corpsValues || [];
  const yearsToFetch = [...new Set(seasonCorpsList.map(c => c.sourceYear))];
  const historicalDocs = await Promise.all(
    yearsToFetch.map(year => db.doc(`historical_scores/${year}`).get())
  );

  const historicalData = {};
  historicalDocs.forEach(doc => {
    if (doc.exists) {
      historicalData[doc.id] = doc.data().data;
    }
  });
  return historicalData;
}


function simpleLinearRegression(data) {
  const n = data.length;
  if (n < 2) {
    return { m: 0, c: data.length > 0 ? data[0][1] : 0 };
  }

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const [x, y] of data) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const c = (sumY - m * sumX) / n;

  return { m, c };
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function calculateCorpsStatisticsLogic() {
  logger.info("Starting corps statistics calculation...");
  const db = getDb();

  // 1. Get the current season to identify the active corps list
  const seasonSettingsRef = db.doc("game-settings/season");
  const seasonDoc = await seasonSettingsRef.get();
  if (!seasonDoc.exists) {
    throw new HttpsError("not-found", "No active season document found.");
  }
  const seasonData = seasonDoc.data();
  const seasonId = seasonData.seasonUid;

  const corpsDataRef = db.doc(`dci-data/${seasonData.dataDocId}`);
  const corpsSnap = await getDoc(corpsDataRef);
  if (!corpsSnap.exists()) {
    throw new HttpsError("not-found", `Corps data document not found: ${seasonData.dataDocId}`);
  }
  const corpsInSeason = corpsSnap.data().corpsValues || [];
  const yearsToFetch = [...new Set(corpsInSeason.map(c => c.sourceYear))];

  // 2. Fetch all necessary historical score documents
  const historicalPromises = yearsToFetch.map(year => db.doc(`historical_scores/${year}`).get());
  const historicalDocs = await Promise.all(historicalPromises);
  const historicalData = {};
  historicalDocs.forEach(doc => {
    if (doc.exists) { historicalData[doc.id] = doc.data().data; }
  });

  // 3. Process the data for each corps
  const allCorpsStats = [];
  for (const corps of corpsInSeason) {
    const uniqueId = `${corps.corpsName}|${corps.sourceYear}`;
    const corpsEvents = (historicalData[corps.sourceYear] || []).filter(event =>
      event.scores.some(s => s.corps === corps.corpsName)
    );

    const captionScores = { GE1: [], GE2: [], VP: [], VA: [], CG: [], B: [], MA: [], P: [] };

    corpsEvents.forEach(event => {
      const scoreData = event.scores.find(s => s.corps === corps.corpsName);
      if (scoreData) {
        for (const caption in captionScores) {
          if (scoreData.captions[caption] > 0) {
            captionScores[caption].push(scoreData.captions[caption]);
          }
        }
      }
    });

    const calculatedStats = {};
    for (const caption in captionScores) {
      const scores = captionScores[caption];
      if (scores.length > 0) {
        const sum = scores.reduce((a, b) => a + b, 0);
        calculatedStats[caption] = {
          avg: parseFloat((sum / scores.length).toFixed(3)),
          max: Math.max(...scores),
          min: Math.min(...scores),
          count: scores.length
        };
      } else {
        calculatedStats[caption] = { avg: 0, max: 0, min: 0, count: 0 };
      }
    }

    allCorpsStats.push({
      id: uniqueId,
      corpsName: corps.corpsName,
      sourceYear: corps.sourceYear,
      points: corps.points,
      stats: calculatedStats
    });
  }

  // 4. Save the aggregated data to a new document
  const statsDocRef = db.doc(`dci-stats/${seasonId}`);
  await statsDocRef.set({
    seasonName: seasonData.name,
    lastUpdated: new Date(),
    data: allCorpsStats
  });

  logger.info(`Successfully processed and saved stats for ${allCorpsStats.length} corps.`);
}
async function processAndArchiveOffSeasonScoresLogic() {
  const db = getDb();
  logger.info("Running Daily Off-Season Score Processor & Archiver...");

  const seasonSettingsRef = db.doc("game-settings/season");
  const seasonDoc = await seasonSettingsRef.get();

  if (!seasonDoc.exists || seasonDoc.data().status !== "off-season") {
    logger.info("No active off-season found. Exiting.");
    return;
  }

  const seasonData = seasonDoc.data();
  const seasonStartDate = seasonData.schedule.startDate.toDate();

  // Use yesterday's date to determine which day to score
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const diffInMillis = yesterday.getTime() - seasonStartDate.getTime();
  const scoredDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;

  if (scoredDay < 1 || scoredDay > 49) {
    logger.info(`Scored day (${scoredDay}) is outside the 1-49 range. Exiting.`);
    return;
  }

  logger.info(`Processing and archiving scores for Off-Season Day: ${scoredDay}`);

  const historicalData = await fetchHistoricalData(seasonData.dataDocId);
  const dayEventData = seasonData.events.find(e => e.offSeasonDay === scoredDay);
  if (!dayEventData || !dayEventData.shows || dayEventData.shows.length === 0) {
    logger.info(`No shows for day ${scoredDay}. Nothing to process.`);
    return;
  }

  const profilesQuery = db.collectionGroup("profile").where("activeSeasonId", "==", seasonData.seasonUid);
  const profilesSnapshot = await profilesQuery.get();
  if (profilesSnapshot.empty) return;

  const week = Math.ceil(scoredDay / 7);
  const dailyRecap = {
    offSeasonDay: scoredDay,
    date: new Date(),
    shows: [],
  };
  const batch = db.batch();
  const dailyScores = new Map(); // To hold the total daily score for each user

  for (const show of dayEventData.shows) {
    const showResult = {
      eventName: show.eventName,
      location: show.location,
      results: [],
    };

    for (const userDoc of profilesSnapshot.docs) {
      const userProfile = userDoc.data();
      const uid = userDoc.ref.parent.parent.id;

      // Handle both old and new profile structures
      const userCorps = userProfile.corps || {};
      if (userProfile.corpsName && !userCorps.worldClass) {
        userCorps.worldClass = {
          corpsName: userProfile.corpsName,
          lineup: userProfile.lineup,
          selectedShows: userProfile.selectedShows
        };
      }

      // Check each corps class for attendance
      Object.keys(userCorps).forEach(corpsClass => {
        const corps = userCorps[corpsClass];
        if (!corps || !corps.corpsName) return;

        const userShows = corps.selectedShows ? corps.selectedShows[`week${week}`] : [];
        const attended = userShows.some(s => s.eventName === show.eventName && s.date === show.date);

        if (attended) {
          // Score calculation using corps lineup
          let geScore = 0, rawVisualScore = 0, rawMusicScore = 0;
          for (const caption in corps.lineup) {
            const [corpsName, , year] = corps.lineup[caption].split("|");
            const captionScore = getRealisticCaptionScore(corpsName, year, caption, scoredDay, historicalData);

            if (["GE1", "GE2"].includes(caption)) geScore += captionScore;
            else if (["VP", "VA", "CG"].includes(caption)) rawVisualScore += captionScore;
            else if (["B", "MA", "P"].includes(caption)) rawMusicScore += captionScore;
          }
          const visualScore = rawVisualScore / 2;
          const musicScore = rawMusicScore / 2;
          const totalShowScore = geScore + visualScore + musicScore;

          // Add to daily totals
          const currentDailyTotal = dailyScores.get(`${uid}_${corpsClass}`) || 0;
          dailyScores.set(`${uid}_${corpsClass}`, currentDailyTotal + totalShowScore);

          showResult.results.push({
            uid: uid,
            corpsClass: corpsClass,
            corpsName: corps.corpsName,
            totalScore: totalShowScore,
            geScore, visualScore, musicScore,
          });
        }
      });
    }
    dailyRecap.shows.push(showResult);
  }

  // Action 1: Update user profiles with their total daily score for the leaderboard
  for (const [uidAndClass, totalDailyScore] of dailyScores.entries()) {
    const [uid, corpsClass] = uidAndClass.split("_");
    const userProfileRef = db.doc(`artifacts/${appId}/users/${uid}/profile/data`);
    batch.update(userProfileRef, {
      [`corps.${corpsClass}.totalSeasonScore`]: totalDailyScore,
      [`corps.${corpsClass}.lastScoredDay`]: scoredDay
    });
  }

  // Action 2: Save the completed recap document
  const recapDocRef = db.doc(`fantasy_recaps/${seasonData.seasonUid}`);
  const recapDoc = await recapDocRef.get();
  if (!recapDoc.exists) {
    batch.set(recapDocRef, {
      seasonName: seasonData.name,
      recaps: [dailyRecap],
    });
  } else {
    const existingRecaps = recapDoc.data().recaps || [];
    const updatedRecaps = existingRecaps.filter(r => r.offSeasonDay !== scoredDay);
    updatedRecaps.push(dailyRecap);
    batch.update(recapDocRef, { recaps: updatedRecaps });
  }

  // Commit all database writes at once
  await batch.commit();
  logger.info(`Successfully processed and archived scores for day ${scoredDay}.`);

  if (scoredDay % 7 === 0) {
    const week = scoredDay / 7;
    logger.info(`End of week ${week}. Determining class-based matchup winners...`);

    const leaguesSnapshot = await db.collection("leagues").get();
    const winnerBatch = db.batch();
    const corpsClasses = ["worldClass", "openClass", "aClass"];

    for (const leagueDoc of leaguesSnapshot.docs) {
      const matchupDocRef = db.doc(`leagues/${leagueDoc.id}/matchups/week${week}`);
      const matchupDoc = await matchupDocRef.get();

      if (matchupDoc.exists) {
        const matchupData = matchupDoc.data();
        let hasUpdates = false;

        for (const corpsClass of corpsClasses) {
          const matchupArrayKey = `${corpsClass}Matchups`;
          const matchups = matchupData[matchupArrayKey] || [];
          if (matchups.length === 0) continue;

          const updatedMatchupsForClass = [];

          for (const matchup of matchups) {
            if (matchup.winner) {
              updatedMatchupsForClass.push(matchup);
              continue;
            }

            const [p1_uid, p2_uid] = matchup.pair;
            const p1_profileDoc = await db.doc(`artifacts/${appId}/users/${p1_uid}/profile/data`).get();
            const p2_profileDoc = await db.doc(`artifacts/${appId}/users/${p2_uid}/profile/data`).get();

            // IMPORTANT: Get score for the SPECIFIC corps class, not total score
            const p1_score = p1_profileDoc.data()?.corps?.[corpsClass]?.totalSeasonScore || 0;
            const p2_score = p2_profileDoc.data()?.corps?.[corpsClass]?.totalSeasonScore || 0;

            let winnerUid = null;
            if (p1_score > p2_score) winnerUid = p1_uid;
            if (p2_score > p1_score) winnerUid = p2_uid;

            // Path to the new, class-specific record
            const seasonRecordPath = () => `seasons.${seasonData.seasonUid}.records.${corpsClass}`;
            const increment = admin.firestore.FieldValue.increment(1);

            if (winnerUid === p1_uid) {
              winnerBatch.set(p1_profileDoc.ref, { [seasonRecordPath()]: { w: increment } }, { merge: true });
              winnerBatch.set(p2_profileDoc.ref, { [seasonRecordPath()]: { l: increment } }, { merge: true });
            } else if (winnerUid === p2_uid) {
              winnerBatch.set(p1_profileDoc.ref, { [seasonRecordPath()]: { l: increment } }, { merge: true });
              winnerBatch.set(p2_profileDoc.ref, { [seasonRecordPath()]: { w: increment } }, { merge: true });
            } else { // Tie
              winnerBatch.set(p1_profileDoc.ref, { [seasonRecordPath()]: { t: increment } }, { merge: true });
              winnerBatch.set(p2_profileDoc.ref, { [seasonRecordPath()]: { t: increment } }, { merge: true });
            }

            const newMatchup = {
              ...matchup,
              scores: { [p1_uid]: p1_score, [p2_uid]: p2_score },
              winner: winnerUid,
            };
            updatedMatchupsForClass.push(newMatchup);
          }
          matchupData[matchupArrayKey] = updatedMatchupsForClass;
          hasUpdates = true;
        }
        if (hasUpdates) {
          winnerBatch.update(matchupDocRef, matchupData);
        }
      }
    }
    await winnerBatch.commit();
    logger.info(`Matchup winner determination for week ${week} complete.`);
  }
}

async function archiveSeasonResultsLogic() {
  logger.info("Starting end-of-season archival process...");
  const db = getDb();

  const seasonSettingsRef = db.doc("game-settings/season");
  const seasonDoc = await seasonSettingsRef.get();
  if (!seasonDoc.exists) {
    logger.error("No season document found. Cannot archive results.");
    throw new HttpsError("not-found", "No active season document found.");
  }
  const seasonData = seasonDoc.data();
  const seasonId = seasonData.seasonUid;
  const seasonName = seasonData.name;

  const leaguesSnapshot = await db.collection("leagues").get();
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

    const profilePromises = members.map(uid => db.doc(`artifacts/${appId}/users/${uid}/profile/data`).get());
    const profileDocs = await Promise.all(profilePromises);

    profileDocs.forEach(profileDoc => {
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
      const leagueRef = db.doc(`leagues/${leagueId}`);
      const championEntry = {
        seasonName: seasonName,
        winnerId: leagueWinner.userId,
        winnerUsername: leagueWinner.username,
        winnerCorpsName: leagueWinner.corpsName,
        score: leagueWinner.finalScore,
        archivedAt: new Date(),
      };
      batch.update(leagueRef, {
        champions: admin.firestore.FieldValue.arrayUnion(championEntry)
      });
      logger.info(`Archived winner for league '${league.name}': ${leagueWinner.username}`);

      // --- ACHIEVEMENT LOGIC ---
      const winnerProfileRef = db.doc(`artifacts/${appId}/users/${leagueWinner.userId}/profile/data`);
      const championAchievement = {
        id: `league_champion_${seasonId}`, // Unique ID for this achievement
        name: `League Champion: ${seasonName}`,
        description: `Finished 1st in the ${league.name} league during the ${seasonName}.`,
        earnedAt: new Date(),
        icon: "trophy" // An identifier for the frontend to use
      };
      batch.update(winnerProfileRef, {
        achievements: admin.firestore.FieldValue.arrayUnion(championAchievement)
      });
      logger.info(`Granted 'League Champion' achievement to ${leagueWinner.username}.`);

      // --- NEW NOTIFICATION LOGIC ---
      const notificationMessage = `🏆 ${leagueWinner.username} has won the ${seasonName} ` +
        `championship in your league, ${league.name}!`;
      members.forEach(memberUid => {
        const notificationRef = db.collection(`artifacts/${appId}/users/${memberUid}/notifications`).doc();
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

async function scrapeDciScoresLogic(urlToScrape, topic = "dci-scores-topic") {
  logger.info(`[scrapeDciScoresLogic] Starting for URL: ${urlToScrape}`);
  if (!urlToScrape) {
    logger.error("[scrapeDciScoresLogic] Critical error: No URL provided.");
    throw new Error("A URL is required to scrape.");
  }

  try {
    const { data } = await axios.get(urlToScrape);
    const $ = cheerio.load(data);
    const scoresData = [];

    const eventNameSelector = "div[data-widget_type=\"theme-post-title.default\"] h1.elementor-heading-title";
    const eventName = $(eventNameSelector).text().trim() || "Unknown DCI Event";
    const dateLocationDiv = $("div[data-widget_type=\"shortcode.default\"] div.score-date-location");
    const dateText = dateLocationDiv.find("p").eq(0).text().trim();
    const locationText = dateLocationDiv.find("p").eq(1).text().trim();

    let eventDate = new Date();
    let eventLocation = locationText || "Unknown Location";
    let year = new Date().getFullYear();

    if (dateText) {
      const parsedDate = new Date(dateText);
      if (!isNaN(parsedDate.getTime())) {
        eventDate = parsedDate;
        year = eventDate.getFullYear();
      }
    }

    const logMsg = `PARSED DATA --> Name: '${eventName}', Date: '${eventDate.toISOString()}', ` +
      `Location: '${eventLocation}', Year: '${year}'`;
    logger.info(logMsg);

    const headerSelector = "table#effect-table-0 > tbody > tr.table-top";
    const headerRow = $(headerSelector);
    const orderedCaptionTitles = [];
    headerRow.find("td.type").each((_i, el) => {
      orderedCaptionTitles.push($(el).text().trim());
    });

    $("table#effect-table-0 > tbody > tr").not(".table-top").each((i, row) => {
      const corpsName = $(row).find("td.sticky-td").first().text().trim();
      if (!corpsName) return;

      const totalScore = parseFloat($(row).find("td.data-total").last().find("span").first().text().trim());

      const tempScores = {
        "General Effect 1": [], "General Effect 2": [],
        "Visual Proficiency": [], "Visual Analysis": [], "Color Guard": [],
        "Music Brass": [], "Music Analysis": [], "Music Percussion": [],
      };

      const mapCaptionTitleToKey = (title) => {
        const normalized = title.replace(/\s-\s/g, " ").trim();
        return Object.prototype.hasOwnProperty.call(tempScores, normalized) ? normalized : null;
      };

      const scoreTables = $(row).find("table.data");

      scoreTables.each((index, table) => {
        const captionTitle = orderedCaptionTitles[index];
        const mappedTitle = mapCaptionTitleToKey(captionTitle);

        if (mappedTitle) {
          const score = parseFloat($(table).find("td").eq(2).text().trim());
          if (!isNaN(score)) {
            tempScores[mappedTitle].push(score);
          }
        }
      });

      const processCaption = (captionName) => {
        const scores = tempScores[captionName];
        if (!scores || scores.length === 0) return 0;
        if (scores.length === 1) return scores[0];
        const sum = scores.reduce((a, b) => a + b, 0);
        return parseFloat((sum / scores.length).toFixed(3));
      };

      const captions = {
        GE1: processCaption("General Effect 1"), 
        GE2: processCaption("General Effect 2"),
        VP: processCaption("Visual Proficiency"), 
        VA: processCaption("Visual Analysis"), 
        CG: processCaption("Color Guard"),
        B: processCaption("Music Brass"), 
        MA: processCaption("Music Analysis"), 
        P: processCaption("Music Percussion"),
      };

      const scoreObject = { corps: corpsName, score: totalScore, captions: captions };
      scoresData.push(scoreObject);
    });

    if (scoresData.length === 0) {
      logger.warn(`No scores found on ${urlToScrape}.`);
      return;
    }

    const payload = { scores: scoresData, eventName, eventLocation, eventDate: eventDate.toISOString(), year };
    const dataBuffer = Buffer.from(JSON.stringify(payload));
    await pubsubClient.topic(topic).publishMessage({ data: dataBuffer });
    logger.info(`Successfully published ${scoresData.length} corps scores from ${eventName}.`);

  } catch (error) {
    logger.error(`[scrapeDciScoresLogic] CRITICAL ERROR for URL ${urlToScrape}:`, error);
  }
}

async function startNewLiveSeason() {
  logger.info("Generating new live season...");
  const db = getDb();
  const today = new Date();
  const year = today.getFullYear();
  const previousYear = (year - 1).toString();

  const rankingsDocRef = db.doc(`final_rankings/${previousYear}`);
  const rankingsDoc = await rankingsDocRef.get();
  if (!rankingsDoc.exists) {
    throw new Error(`Cannot start live season: Final rankings for ${previousYear} not found.`);
  }
  const corpsValues = rankingsDoc.data().data.map(c => ({
    corpsName: c.corps,
    sourceYear: previousYear,
    points: c.points
  }));

  const dataDocId = `live-season-${year}`;
  await db.doc(`dci-data/${dataDocId}`).set({ corpsValues: corpsValues });

  const scheduleTemplateRef = db.doc("schedules/live_season_template");
  const scheduleTemplateDoc = await scheduleTemplateRef.get();
  const events = scheduleTemplateDoc.exists ? scheduleTemplateDoc.data().events : [];

  const augustFirst = new Date(year, 7, 1);
  const dayOfWeek = augustFirst.getDay();
  const daysToAdd = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
  const millisInDay = 24 * 60 * 60 * 1000;
  const firstSaturday = new Date(augustFirst.getTime() + daysToAdd * millisInDay);
  const finalsDate = new Date(firstSaturday.getTime() + 7 * millisInDay);
  const startDate = new Date(finalsDate.getTime() - 69 * millisInDay);

  const newSeasonData = {
    name: `DCI ${year} Live Season`, status: "live-season", seasonUid: dataDocId,
    seasonYear: year, currentPointCap: 150, dataDocId: dataDocId,
    schedule: {
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(finalsDate),
    },
    events: events
  };

  await db.doc("game-settings/season").set(newSeasonData);
  logger.info(`Successfully started the ${newSeasonData.name}.`);
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
  rankingsSnapshot.forEach(doc => {
    const year = doc.id;
    const corpsData = doc.data().data || [];
    corpsData.forEach(corps => {
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
      chosenCorps = shuffledCandidates.find(c => !usedCorpsNames.has(c.corpsName));
      if (!chosenCorps) chosenCorps = shuffledCandidates[0];
    }
    if (!chosenCorps) {
      const fallback = shuffledAllCorps.find(c => !usedCorpsNames.has(c.corpsName));
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
  const dataDocId = `off-season-${startDate.getTime()}`;
  await db.doc(`dci-data/${dataDocId}`).set({ corpsValues: offSeasonCorpsData });
  const newSeasonSettings = {
    name: seasonName, status: "off-season", seasonUid: dataDocId,
    currentPointCap: 150, dataDocId: dataDocId,
    schedule: { startDate: Timestamp.fromDate(startDate), endDate: Timestamp.fromDate(endDate) },
    events: schedule
  };

  await seasonSettingsRef.set(newSeasonSettings);
  logger.info(`Successfully started ${seasonName}.`);

  if (oldSeasonUid) {
    const profilesQuery = db.collectionGroup("profile").where("activeSeasonId", "==", oldSeasonUid);
    const profilesSnapshot = await profilesQuery.get();

    if (!profilesSnapshot.empty) {
      const batch = db.batch();
      profilesSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { activeSeasonId: null });
      });
      await batch.commit();
      const logMsg = `Invalidated activeSeasonId for ${profilesSnapshot.size} users ` +
        `from previous season: ${oldSeasonUid}`;
      logger.info(logMsg);
    }
  }
}

async function generateOffSeasonSchedule(seasonLength, startDay) {
  logger.info(`Generating schedule for a ${seasonLength}-day season, starting on day ${startDay}.`);
  const db = getDb();
  const scoresSnapshot = await db.collection("historical_scores").get();

  const showsByDay = new Map();
  let allShows = [];
  scoresSnapshot.forEach(yearDoc => {
    const yearData = yearDoc.data().data || [];
    yearData.forEach(event => {
      if (event.eventName && event.offSeasonDay && !event.eventName.toLowerCase().includes("open class")) {
        const showData = {
          eventName: event.eventName, date: event.date, location: event.location,
          scores: event.scores, offSeasonDay: event.offSeasonDay
        };
        if (!showsByDay.has(event.offSeasonDay)) showsByDay.set(event.offSeasonDay, []);
        showsByDay.get(event.offSeasonDay).push(showData);
        allShows.push(showData);
      }
    });
  });

  const schedule = Array.from({ length: seasonLength }, (_, i) => ({ offSeasonDay: startDay + i, shows: [] }));
  const usedEventNames = new Set();
  const usedLocations = new Set();

  const placeExclusiveShow = (day, showNamePattern, mandatory) => {
    const dayObject = schedule.find(d => d.offSeasonDay === day);
    if (!dayObject) return;

    const showsForThisDay = showsByDay.get(day) || [];
    const candidates = showsForThisDay.filter(s => {
      const nameMatches = s.eventName.toLowerCase().includes(showNamePattern.toLowerCase());
      const isUnused = !usedEventNames.has(s.eventName);
      return nameMatches && isUnused;
    });

    const showToPlace = shuffleArray(candidates)[0];

    if (showToPlace) {
      dayObject.shows = [{ ...showToPlace, mandatory }];
      usedEventNames.add(showToPlace.eventName);
      usedLocations.add(showToPlace.location);
    } else {
      logger.warn(`Could not find an unused show for Day ${day} matching "${showNamePattern}". Day will be empty.`);
      dayObject.shows = [];
    }
  };

  placeExclusiveShow(49, "DCI World Championship Finals", true);
  placeExclusiveShow(48, "DCI World Championship Semifinals", true);
  placeExclusiveShow(47, "DCI World Championship Prelims", true);
  placeExclusiveShow(28, "DCI Southwestern Championship", true);
  placeExclusiveShow(35, "championship", false);

  const showsForDay41 = showsByDay.get(41) || [];
  const showsForDay42 = showsByDay.get(42) || [];

  const ecCandidates = [...showsForDay41, ...showsForDay42];
  const easternClassicCandidates = ecCandidates.filter(s => {
    const nameMatches = s.eventName.includes("DCI Eastern Classic");
    const isUnused = !usedEventNames.has(s.eventName);
    return nameMatches && isUnused;
  });

  const dciEastShow = shuffleArray(easternClassicCandidates)[0];

  if (dciEastShow) {
    const day41 = schedule.find(d => d.offSeasonDay === 41);
    const day42 = schedule.find(d => d.offSeasonDay === 42);

    if (day41) day41.shows = [{ ...dciEastShow, mandatory: false }];
    if (day42) day42.shows = [{ ...dciEastShow, mandatory: false }];

    if (day41 || day42) {
      usedEventNames.add(dciEastShow.eventName);
      usedLocations.add(dciEastShow.location);
    }
  } else {
    const warnMsg = "Could not find \"DCI Eastern Classic\" on days 41 or 42. " +
      "These days will be filled randomly if available.";
    logger.warn(warnMsg);
  }

  const remainingDays = schedule.filter(d => d.shows.length === 0);
  const twoShowDayCount = Math.floor(remainingDays.length * 0.2);
  const dayCounts = shuffleArray(
    [...Array(twoShowDayCount).fill(2), ...Array(remainingDays.length - twoShowDayCount).fill(3)]
  );

  for (const day of remainingDays) {
    const numShowsToPick = dayCounts.pop() || 3;
    const potentialShows = shuffleArray(showsByDay.get(day.offSeasonDay) || []);
    const pickedShows = [];

    for (const show of potentialShows) {
      if (pickedShows.length >= numShowsToPick) break;
      if (!usedEventNames.has(show.eventName) && !usedLocations.has(show.location)) {
        pickedShows.push(show);
        usedEventNames.add(show.eventName);
        usedLocations.add(show.location);
      }
    }
    day.shows = pickedShows;
  }

  const day45 = schedule.find(d => d.offSeasonDay === 45);
  if (day45) day45.shows = [];
  const day46 = schedule.find(d => d.offSeasonDay === 46);
  if (day46) day46.shows = [];

  logger.info("Advanced schedule generated successfully.");
  return schedule;
}

function calculateOffSeasonDay(eventDate, year) {
  if (!eventDate || isNaN(eventDate.getTime())) return null;

  const firstOfAugust = new Date(Date.UTC(year, 7, 1));
  const dayOfWeek = firstOfAugust.getUTCDay();
  const daysUntilFirstSaturday = (6 - dayOfWeek + 7) % 7;
  const firstSaturdayDate = 1 + daysUntilFirstSaturday;
  const finalsDay = firstSaturdayDate + 7;
  const finalsDateUTC = new Date(Date.UTC(year, 7, finalsDay));

  const seasonEndDate = new Date(finalsDateUTC);
  const millisIn48Days = 48 * 24 * 60 * 60 * 1000;
  const seasonStartDate = new Date(finalsDateUTC.getTime() - millisIn48Days);
  const eventDateUTC = new Date(Date.UTC(eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate()));

  if (eventDateUTC < seasonStartDate || eventDateUTC > seasonEndDate) return null;

  const diffInMillis = eventDateUTC.getTime() - seasonStartDate.getTime();
  const millisInDay = 1000 * 60 * 60 * 24;
  const diffInDays = Math.round(diffInMillis / millisInDay);

  return diffInDays + 1;
}

function getThematicOffSeasonName(seasonType, finalsYear) {
  const startYear = finalsYear - 1;
  return `${seasonType} Season ${startYear}-${finalsYear.toString().slice(-2)}`;
}

function getNextOffSeasonWindow() {
  const now = new Date();
  const currentYear = now.getFullYear();

  const findSecondSaturday = (year) => {
    const firstOfAugust = new Date(Date.UTC(year, 7, 1));
    const dayOfWeek = firstOfAugust.getUTCDay();
    const daysToAdd = (6 - dayOfWeek + 7) % 7;
    const firstSaturday = 1 + daysToAdd;
    return new Date(Date.UTC(year, 7, firstSaturday + 7));
  };

  let nextFinalsDate = findSecondSaturday(currentYear);
  if (now >= nextFinalsDate) {
    nextFinalsDate = findSecondSaturday(currentYear + 1);
  }

  const millisInDay = 24 * 60 * 60 * 1000;
  const liveSeasonStartDate = new Date(nextFinalsDate.getTime() - 69 * millisInDay);
  const seasonTypes = ["Finale", "Crescendo", "Scherzo", "Adagio", "Allegro", "Overture"];
  const seasonWindows = [];

  for (let i = 0; i < seasonTypes.length; i++) {
    const seasonEndDate = new Date(liveSeasonStartDate.getTime() - (i * 49 * millisInDay) - (1 * millisInDay));
    const seasonStartDate = new Date(seasonEndDate.getTime() - 48 * millisInDay);
    seasonWindows.push({
      startDate: seasonStartDate,
      endDate: seasonEndDate,
      seasonType: seasonTypes[i]
    });
  }

  seasonWindows.reverse();
  const nextWindow = seasonWindows.find(window => now < window.endDate);

  if (nextWindow) {
    return { ...nextWindow, finalsYear: nextFinalsDate.getFullYear() };
  }

  const overtureStartDate = new Date(nextFinalsDate.getTime() + 1 * millisInDay);
  const overtureEndDate = new Date(overtureStartDate.getTime() + 48 * millisInDay);

  return {
    startDate: overtureStartDate,
    endDate: overtureEndDate,
    seasonType: "Overture",
    finalsYear: nextFinalsDate.getFullYear()
  };
}

function getRealisticCaptionScore(corpsName, sourceYear, caption, currentDay, historicalData) {
  const actualScore = getScoreForDay(currentDay, corpsName, sourceYear, caption, historicalData);
  if (actualScore !== null) {
    return actualScore; // Always use the real score if it exists.
  }

  const allDataPoints = [];
  const yearData = historicalData[sourceYear] || [];
  for (const event of yearData) {
    const score = getScoreForDay(event.offSeasonDay, corpsName, sourceYear, caption, historicalData);
    if (score !== null) {
      if (!allDataPoints.some(p => p[0] === event.offSeasonDay)) {
        allDataPoints.push([event.offSeasonDay, score]);
      }
    }
  }

  const maxScore = 20;

  if (allDataPoints.length >= 2) {
    const regression = logarithmicRegression(allDataPoints);
    const predictedScore = regression.predict(currentDay);
    const jitter = (Math.random() - 0.5) * 0.5;
    const finalScore = predictedScore + jitter;
    const roundedScore = parseFloat(finalScore.toFixed(3));
    return Math.max(0, Math.min(maxScore, roundedScore));

  } else if (allDataPoints.length === 1) {
    return allDataPoints[0][1];
  } else {
    logger.warn(`No historical scores found for ${corpsName} (${sourceYear}), caption ${caption}. Returning 0.`);
    return 0;
  }
}

function getScoreForDay(day, corps, year, caption, historicalData) {
  const events = historicalData[year]?.filter(e => e.offSeasonDay === day);
  if (!events || events.length === 0) return null;

  for (const event of events) {
    const scoreData = event.scores.find(s => s.corps === corps);
    if (scoreData && scoreData.captions[caption] > 0) {
      return scoreData.captions[caption]; // Return the first one found
    }
  }
  return null;
}

function logarithmicRegression(data) {
  const transformedData = data.map(([x, y]) => [x, y > 0 ? Math.log(y) : 0]);

  const { m, c } = simpleLinearRegression(transformedData);

  return {
    predict: (x) => {
      const logPrediction = m * x + c;
      // Use Math.exp() to reverse the Math.log() transformation.
      return Math.exp(logPrediction);
    }
  };
}

function mapLiveDayToOffSeasonDay(liveDay) {
  const liveSeasonStartDay = 22;
  const dayOffset = 21;
  if (liveDay < liveSeasonStartDay) {
    return 1;
  } else {
    return liveDay - dayOffset;
  }
}

async function getLiveCaptionScore(corpsName, sourceYear, caption, currentDay, historicalData) {
  const db = getDb();
  const seasonDoc = await db.doc("game-settings/season").get();
  const activeSeasonId = seasonDoc.data().seasonUid;

  const liveScoresRef = db.collection(`live_scores/${activeSeasonId}/scores`).where("corpsName", "==", corpsName);
  const liveScoresSnap = await liveScoresRef.get();

  const currentSeasonScores = [];
  liveScoresSnap.forEach(doc => {
    const data = doc.data();
    if (data.captions && data.captions[caption]) {
      currentSeasonScores.push([data.day, data.captions[caption]]);
    }
  });

  if (currentSeasonScores.length >= 3) {
    const regression = logarithmicRegression(currentSeasonScores);
    const predictedScore = regression.predict(currentDay);
    const jitter = (Math.random() - 0.5) * 0.5;
    const finalScore = predictedScore + jitter;
    return Math.max(0, Math.min(20, parseFloat(finalScore.toFixed(3))));

  } else {
    const equivalentOffSeasonDay = mapLiveDayToOffSeasonDay(currentDay);
    return getRealisticCaptionScore(corpsName, sourceYear, caption, equivalentOffSeasonDay, historicalData);
  }
}

// ================================================================= //
//                        CRAWLER & WORKER FUNCTIONS                 //
// ================================================================= //

exports.discoverAndQueueUrls = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
  }

  logger.info("Kicking off asynchronous discovery process...");

  const dataBuffer = Buffer.from(JSON.stringify({ pageno: 1 }));
  await pubsubClient.topic(PAGINATION_TOPIC).publishMessage({ data: dataBuffer });

  return { success: true, message: "Asynchronous scraper process initiated. See logs for progress." };
});

exports.scrapeSingleRecap = onRequest({ cors: true }, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      logger.error("Worker received a task with no URL.");
      res.status(400).send("Bad Request: Missing URL in payload.");
      return;
    }

    await scrapeDciScoresLogic(url);
    res.status(200).send("Successfully processed recap URL.");
  } catch (error) {
    logger.error(`Worker failed to process URL: ${req.body.url}`, error);
    res.status(500).send("Internal Server Error");
  }
});

exports.processPaginationPage = onMessagePublished({
  topic: PAGINATION_TOPIC,
  memory: "2GiB",
  timeoutSeconds: 540,
}, async (message) => {
  const payloadBuffer = Buffer.from(message.data.message.data, "base64").toString("utf-8");
  const { pageno } = JSON.parse(payloadBuffer);
  const baseUrl = "https://www.dci.org";
  const currentUrl = `${baseUrl}/scores?pageno=${pageno}`;
  logger.info(`[Paginator] Processing page: ${currentUrl}`);

  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();
    await page.goto(currentUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

    const finalScoresSelector = "a.arrow-btn[href*=\"/scores/final-scores/\"]";
    const linksOnPage = await page.$$eval(finalScoresSelector, anchors => anchors.map(a => a.href));

    if (linksOnPage.length === 0) {
      logger.info(`[Paginator] Found no more 'final-scores' links on pageno=${pageno}. Ending discovery chain.`);
      return;
    }

    const logMsg = `[Paginator] Found ${linksOnPage.length} 'final-scores' links. Queueing them for recap search.`;
    logger.info(logMsg);

    for (const finalScoresUrl of linksOnPage) {
      try {
        const { data } = await axios.get(finalScoresUrl, { timeout: 15000 });
        const $ = cheerio.load(data);

        $("a.arrow-btn[href*=\"/scores/recap/\"]").each((_idx, el) => {
          const recapLink = $(el).attr("href");
          if (recapLink) {
            const fullUrl = new URL(recapLink, baseUrl).href;
            queueRecapUrlForScraping(fullUrl);
          }
        });
      } catch (error) {
        logger.warn(`[Paginator] Could not process ${finalScoresUrl}. Skipping. Message: ${error.message}`);
      }
    }

    const nextDataBuffer = Buffer.from(JSON.stringify({ pageno: pageno + 1 }));
    await pubsubClient.topic(PAGINATION_TOPIC).publishMessage({ data: nextDataBuffer });

  } catch (error) {
    logger.error(`[Paginator] Failed to process page ${pageno}:`, error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

async function queueRecapUrlForScraping(url) {
  try {
    const project = "marching-art";
    const location = "us-central1";
    const queue = "recap-scraper-queue";
    const workerUrl = `https://us-central1-${project}.cloudfunctions.net/scrapeSingleRecap`;
    const queuePath = tasksClient.queuePath(project, location, queue);

    const task = {
      httpRequest: {
        httpMethod: "POST",
        url: workerUrl,
        body: Buffer.from(JSON.stringify({ url })).toString("base64"),
        headers: { "Content-Type": "application/json" },
      },
    };

    await tasksClient.createTask({ parent: queuePath, task: task });
    logger.info(`[Queuer] Successfully queued task for URL: ${url}`);
  } catch (error) {
    logger.error(`[Queuer] Failed to queue task for URL: ${url}`, error);
  }
}

exports.migrateUserProfiles = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
  }

  const db = getDb();
  let migratedCount = 0;
  let errorCount = 0;

  try {
    const profilesQuery = db.collectionGroup("profile")
      .where("corpsName", "!=", null);

    const profilesSnapshot = await profilesQuery.get();

    if (profilesSnapshot.empty) {
      return { success: true, message: "No profiles need migration." };
    }

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of profilesSnapshot.docs) {
      const oldProfile = doc.data();

      if (oldProfile.corps) continue; // Already migrated

      try {
        const newProfileData = {
          corps: {
            worldClass: {
              corpsName: oldProfile.corpsName,
              lineup: oldProfile.lineup || {},
              totalSeasonScore: oldProfile.totalSeasonScore || 0,
              selectedShows: oldProfile.selectedShows || {},
              weeklyTrades: oldProfile.weeklyTrades || { used: 0 },
              lastScoredDay: oldProfile.lastScoredDay || 0,
              lineupKey: oldProfile.lineupKey
            }
          },
          migratedAt: new Date()
        };

        batch.update(doc.ref, newProfileData);
        migratedCount++;
        batchCount++;

        if (batchCount >= 400) {
          await batch.commit();
          batchCount = 0;
        }
      } catch (error) {
        logger.error(`Error migrating profile ${doc.id}:`, error);
        errorCount++;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    return {
      success: true,
      message: `Migration completed: ${migratedCount} profiles migrated, ${errorCount} errors`,
    };
  } catch (error) {
    logger.error("Migration failed:", error);
    throw new HttpsError("internal", "Migration failed: " + error.message);
  }
});