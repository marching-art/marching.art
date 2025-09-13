const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { PubSub } = require("@google-cloud/pubsub");
const { CloudTasksClient } = require("@google-cloud/tasks");
const axios = require("axios");
const cheerio = require("cheerio");
const { getDb, appId } = require("./_config");
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { Timestamp } = require('firebase-admin/firestore');
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
        throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
    }
    const { email, makeAdmin } = request.data;
    logger.info(`Admin ${request.auth.uid} attempting to set role for ${email} to admin: ${makeAdmin}`);
    // TODO: Add logic to set custom claims using the Firebase Admin Auth SDK.
    return { success: true, message: `Role change for ${email} processed.` };
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

exports.validateAndSaveLineup = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in to save a lineup.");
    }
    const { lineup, corpsName } = request.data;
    const uid = request.auth.uid;
    
    if (!lineup || Object.keys(lineup).length !== 8) {
        throw new HttpsError("invalid-argument", "A complete 8-caption lineup is required.");
    }

    const lineupKey = Object.values(lineup).sort().join("_");
    
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
            const oldLineupKey = userProfileData.lineupKey;
            if (oldLineupKey && oldLineupKey !== lineupKey) {
                transaction.delete(getDb().collection("activeLineups").doc(oldLineupKey));
            }
            transaction.set(newActiveLineupRef, { uid: uid, seasonId: activeSeasonId });

            let profileUpdateData = {};
            
            const isNewSeasonSignup = userProfileData.activeSeasonId !== activeSeasonId;

            if (isNewSeasonSignup) {
                if (!corpsName) throw new HttpsError("invalid-argument", "A corps name is required.");
                
                profileUpdateData = {
                    corpsName: corpsName,
                    activeSeasonId: activeSeasonId,
                    totalSeasonScore: 0,
                    selectedShows: {},
                    weeklyTrades: { seasonUid: activeSeasonId, week: 1, used: 0 },
                    lastScoredDay: 0,
                    lineup: lineup,
                    lineupKey: lineupKey,
                };

            } else {
                const now = new Date();
                const seasonStartDate = seasonData.schedule.startDate.toDate();
                const diffInMillis = now.getTime() - seasonStartDate.getTime();
                const currentDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
                const currentWeek = Math.ceil(currentDay / 7);

                let tradeLimit = 3;
                if (seasonData.status === 'off-season' && currentWeek === 1) tradeLimit = Infinity;
                if (seasonData.status === 'live-season' && [1, 2, 3].includes(currentWeek)) tradeLimit = Infinity;
                
                const originalLineup = userProfileData.lineup || {};
                let newTrades = 0;
                Object.keys(lineup).forEach(caption => {
                    if (originalLineup[caption] !== lineup[caption]) newTrades++;
                });

                if (newTrades > 0 && tradeLimit !== Infinity) {
                    const weeklyTrades = userProfileData.weeklyTrades || { week: 0, used: 0 };
                    let tradesAlreadyUsed = (weeklyTrades.seasonUid === activeSeasonId && weeklyTrades.week === currentWeek) ? weeklyTrades.used : 0;

                    if (tradesAlreadyUsed + newTrades > tradeLimit) {
                        throw new HttpsError("failed-precondition", `Exceeds trade limit. You have ${tradeLimit - tradesAlreadyUsed} trades remaining.`);
                    }
                    
                    profileUpdateData.weeklyTrades = {
                        seasonUid: activeSeasonId,
                        week: currentWeek,
                        used: tradesAlreadyUsed + newTrades
                    };
                }
                
                profileUpdateData.lineup = lineup;
                profileUpdateData.lineupKey = lineupKey;
            }
            
            transaction.update(userProfileRef, profileUpdateData);
        });
        return { success: true, message: "Lineup saved successfully!" };
    } catch (error) {
        logger.error(`[validateAndSaveLineup] Transaction FAILED for user ${uid}:`, error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "An error occurred while saving your lineup.");
    }
});

exports.testScraper = onCall({ cors: true }, async (request) => {
    if (!request.auth || !request.auth.token.admin) {
        throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
    }
    try {
        const testUrl = 'https://www.dci.org/scores/recap/2023-dci-world-championships-finals';
        await scrapeDciScoresLogic(testUrl);
        return { success: true, message: `Scraper test triggered for ${testUrl}. Check logs for output.` };
    } catch (error) {
        logger.error("Error manually triggering scraper:", error);
        throw new HttpsError("internal", "An error occurred while triggering the scraper test.");
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
        const yearDocRef = getDb().collection('historical_scores').doc(docId);
        
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
                const existingData = yearDoc.data().data || [];
                const eventExists = existingData.some(event => 
                    event.eventName === newEventData.eventName && new Date(event.date).getTime() === new Date(newEventData.date).getTime()
                );

                if (eventExists) {
                    logger.warn(`Event "${newEventData.eventName}" on ${newEventData.date} already exists for year ${year}. Skipping.`);
                    return;
                }

                const updatedData = [...existingData, newEventData];
                logger.info(`Appending new event to document for year ${year}. Total events: ${updatedData.length}`);
                transaction.update(yearDocRef, { data: updatedData });
            }
        });

        logger.info(`Successfully processed and archived scores to historical_scores/${docId} with offSeasonDay: ${offSeasonDay}`);

    } catch (error) {
        logger.error("Error processing and archiving historical scores:", error);
    }
});

exports.scrapeDciScores = onSchedule({
    schedule: "every 15 minutes from 19:00 to 01:50",
    timeZone: "America/New_York",
}, async (_context) => {
    logger.info("Running live score scraper...");
    const db = getDb();
    const seasonDoc = await db.doc("game-settings/season").get();
    
    if (!seasonDoc.exists || seasonDoc.data().status !== 'live-season') {
        logger.info("No active live season. Scraper will not run.");
        return;
    }

    try {
        const urlToScrape = 'https://www.dci.org/scores?pageno=1';
        const { data } = await axios.get(urlToScrape);
        const $ = cheerio.load(data);
        const latestRecapLink = $('a.arrow-btn[href*="/scores/recap/"]').first().attr('href');
        
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
}, async (_context) => {
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

exports.processDailyScores = onSchedule({
    schedule: "every day 01:56",
    timeZone: "America/New_York",
}, async (_context) => {
    const db = getDb();
    logger.info("Running Daily Score Processor...");

    const seasonSettingsRef = db.doc("game-settings/season");
    const seasonDoc = await seasonSettingsRef.get();

    if (!seasonDoc.exists || seasonDoc.data().status !== 'off-season') {
        logger.info("No active off-season found. Exiting score processor.");
        return;
    }
    const seasonData = { id: seasonDoc.id, ...seasonDoc.data() };
    const seasonStartDate = seasonData.schedule.startDate.toDate();
    
    const now = new Date();
    const diffInMillis = now.getTime() - seasonStartDate.getTime();
    const currentOffSeasonDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;

    if (currentOffSeasonDay < 1 || currentOffSeasonDay > 49) {
        logger.info(`Current off-season day (${currentOffSeasonDay}) is outside the 1-49 range. Exiting.`);
        return;
    }

    logger.info(`Processing scores for Off-Season Day: ${currentOffSeasonDay}`);

    const dataDocId = seasonData.dataDocId;
    if (!dataDocId) {
        logger.error("Season settings are missing dataDocId. Aborting.");
        return;
    }
    const corpsDataRef = db.doc(`dci-data/${dataDocId}`);
    const corpsDataSnap = await corpsDataRef.get();
    if (!corpsDataSnap.exists) {
        logger.error(`dci-data document ${dataDocId} not found. Aborting.`);
        return;
    }
    const seasonCorpsList = corpsDataSnap.data().corpsValues || [];

    const yearsToFetch = [...new Set(seasonCorpsList.map(c => c.sourceYear))];
    const historicalPromises = yearsToFetch.map(year => db.doc(`historical_scores/${year}`).get());
    const historicalDocs = await Promise.all(historicalPromises);
    
    const historicalData = {};
    historicalDocs.forEach(docSnap => {
        if (docSnap.exists) {
            historicalData[docSnap.id] = docSnap.data().data;
        }
    });

    const todayEventData = seasonData.events.find(e => e.offSeasonDay === currentOffSeasonDay);
    if (!todayEventData || !todayEventData.shows || todayEventData.shows.length === 0) {
        logger.info(`No shows scheduled for day ${currentOffSeasonDay}. Nothing to score.`);
        return;
    }
    const todaysShows = todayEventData.shows;
    
    const profilesQuery = db.collectionGroup('profile').where('activeSeasonId', '==', seasonData.seasonUid);
    const profilesSnapshot = await profilesQuery.get();
    
    if (profilesSnapshot.empty) {
        logger.info("No users have joined the current season. Exiting.");
        return;
    }
    
    const week = Math.ceil(currentOffSeasonDay / 7);
    
    for (const userDoc of profilesSnapshot.docs) {
        const userProfile = userDoc.data();
        const uid = userDoc.ref.parent.parent.id;
        
        const userShowsForWeek = userProfile.selectedShows ? userProfile.selectedShows[`week${week}`] : [];
        if (!userShowsForWeek || userShowsForWeek.length === 0) continue;

        let dailyScore = 0;
        
        for (const show of todaysShows) {
            const attendedShow = userShowsForWeek.some(s => s.eventName === show.eventName && s.date === show.date);
            if (attendedShow) {
                let showScore = 0;
                for (const caption in userProfile.lineup) {
                    const selectedValue = userProfile.lineup[caption];
                    const [selectedCorps, _points, sourceYear] = selectedValue.split('|');
                    
                    const captionScore = getRealisticCaptionScore(
                        selectedCorps, 
                        sourceYear,
                        caption, 
                        currentOffSeasonDay, 
                        historicalData
                    );
                    showScore += captionScore;
                }
                dailyScore += showScore;
            }
        }
        
        if (dailyScore > 0) {
            const newTotal = (userProfile.totalSeasonScore || 0) + dailyScore;
            await userDoc.ref.update({
                totalSeasonScore: newTotal,
                lastScoredDay: currentOffSeasonDay
            });
            logger.info(`User ${uid} scored ${dailyScore.toFixed(3)} points today. New total: ${newTotal.toFixed(3)}`);
        }
    }
    logger.info("Daily Score Processor finished.");
});

exports.processDailyLiveScores = onSchedule({
    schedule: "every day 01:58",
    timeZone: "America/New_York",
}, async (_context) => {
    const db = getDb();
    logger.info("Running Daily Live Season Score Processor...");

    const seasonDoc = await db.doc("game-settings/season").get();
    if (!seasonDoc.exists || seasonDoc.data().status !== 'live-season') {
        logger.info("No active live season found. Exiting processor.");
        return;
    }

    const seasonData = seasonDoc.data();
    const seasonStartDate = seasonData.schedule.startDate.toDate();

    const now = new Date();
    const diffInMillis = now.getTime() - seasonStartDate.getTime();
    const currentDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;

    if (currentDay < 1) return;

    logger.info(`Processing live season scores for Day: ${currentDay}`);

    const corpsDataRef = db.doc(`dci-data/${seasonData.dataDocId}`);
    const corpsDataSnap = await corpsDataRef.get();
    if (!corpsDataSnap.exists) return;
    const seasonCorpsList = corpsDataSnap.data().corpsValues || [];
    const yearsToFetch = [...new Set(seasonCorpsList.map(c => c.sourceYear))];
    const historicalDocs = await Promise.all(yearsToFetch.map(year => db.doc(`historical_scores/${year}`).get()));
    const historicalData = {};
    historicalDocs.forEach(doc => { if (doc.exists) historicalData[doc.id] = doc.data().data; });

    const showsToday = [];
    const liveScoresTodayRef = db.collection(`live_scores/${seasonData.seasonUid}/scores`).where("day", "==", currentDay);
    const liveScoresTodaySnap = await liveScoresTodayRef.get();
    liveScoresTodaySnap.forEach(doc => {
        const eventName = doc.data().eventName;
        if (!showsToday.includes(eventName)) {
            showsToday.push(eventName);
        }
    });

    const profilesQuery = db.collectionGroup('profile').where('activeSeasonId', '==', seasonData.seasonUid);
    const profilesSnapshot = await profilesQuery.get();
    if (profilesSnapshot.empty) return;

    for (const userDoc of profilesSnapshot.docs) {
        const userProfile = userDoc.data();
        const uid = userDoc.ref.parent.parent.id;

        const userShows = Object.values(userProfile.selectedShows || {}).flat();
        const attendedRealShowToday = userShows.some(s => showsToday.includes(s.eventName));
        if (attendedRealShowToday) {
            logger.info(`User ${uid} attended a real show today, skipping prediction.`);
            continue;
        }

        let predictedDailyScore = 0;
        for (const caption in userProfile.lineup) {
            const [selectedCorps, , sourceYear] = userProfile.lineup[caption].split('|');
            const captionScore = await getLiveCaptionScore(selectedCorps, sourceYear, caption, currentDay, historicalData);
            predictedDailyScore += captionScore;
        }

        if (predictedDailyScore > 0) {
            const newTotal = (userProfile.totalSeasonScore || 0) + predictedDailyScore;
            await userDoc.ref.update({ totalSeasonScore: newTotal });
            logger.info(`User ${uid} scored ${predictedDailyScore.toFixed(3)} predicted points. New total: ${newTotal.toFixed(3)}`);
        }
    }
    logger.info("Daily Live Season Score Processor finished.");
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
    
    const weekKey = `selectedShows.week${week}`;

    const registrations = [];
    const q = db.collectionGroup('profile').where('activeSeasonId', '==', activeSeasonId);
    const querySnapshot = await q.get();

    querySnapshot.forEach(doc => {
        const profile = doc.data();
        const shows = profile.selectedShows ? profile.selectedShows[`week${week}`] : [];
        if (shows && shows.some(s => s.eventName === eventName && s.date === date)) {
            registrations.push(profile.corpsName || 'Unnamed Corps');
        }
    });

    return { corpsNames: registrations };
});

exports.selectUserShows = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }
    const uid = request.auth.uid;
    const { week, shows } = request.data;

    if (!week || !shows || !Array.isArray(shows) || shows.length > 4) {
        throw new HttpsError("invalid-argument", "Invalid data. A week number and a maximum of 4 shows are required.");
    }

    const userProfileRef = getDb().doc(`artifacts/${appId}/users/${uid}/profile/data`);

    try {
        await userProfileRef.update({
            [`selectedShows.week${week}`]: shows
        });
        return { success: true, message: `Successfully saved selections for week ${week}.`};
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

    const leagueRef = db.collection('leagues').doc();
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

exports.archiveDailyFantasyScores = onSchedule({
    schedule: "every day 02:00",
    timeZone: "America/New_York",
}, async (_context) => {
    const db = getDb();
    logger.info("Running Daily Fantasy Recap Archiver...");

    const seasonDoc = await db.doc("game-settings/season").get();
    if (!seasonDoc.exists || seasonDoc.data().status !== 'off-season') {
        logger.info("No active off-season found. Exiting archiver.");
        return;
    }
    const seasonData = seasonDoc.data();
    const seasonStartDate = seasonData.schedule.startDate.toDate();
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const diffInMillis = yesterday.getTime() - seasonStartDate.getTime();
    const scoredDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;

    if (scoredDay < 1 || scoredDay > 49) {
        logger.info(`Scored day (${scoredDay}) is outside the 1-49 range. Nothing to archive.`);
        return;
    }

    const corpsDataRef = db.doc(`dci-data/${seasonData.dataDocId}`);
    const corpsDataSnap = await corpsDataRef.get();
    if (!corpsDataSnap.exists) return;
    const seasonCorpsList = corpsDataSnap.data().corpsValues || [];
    const yearsToFetch = [...new Set(seasonCorpsList.map(c => c.sourceYear))];
    const historicalDocs = await Promise.all(yearsToFetch.map(year => db.doc(`historical_scores/${year}`).get()));
    const historicalData = {};
    historicalDocs.forEach(doc => { if (doc.exists) historicalData[doc.id] = doc.data().data; });

    const dayEventData = seasonData.events.find(e => e.offSeasonDay === scoredDay);
    if (!dayEventData || !dayEventData.shows || dayEventData.shows.length === 0) {
        logger.info(`No shows found for day ${scoredDay} to archive.`);
        return;
    }

    const profilesQuery = db.collectionGroup('profile').where('activeSeasonId', '==', seasonData.seasonUid);
    const profilesSnapshot = await profilesQuery.get();
    if (profilesSnapshot.empty) return;

    const week = Math.ceil(scoredDay / 7);
    const dailyRecap = {
        offSeasonDay: scoredDay,
        date: new Date(),
        shows: [],
    };

    for (const show of dayEventData.shows) {
        const showResult = {
            eventName: show.eventName,
            location: show.location,
            results: [],
        };

        for (const userDoc of profilesSnapshot.docs) {
            const userProfile = userDoc.data();
            const userShows = userProfile.selectedShows ? userProfile.selectedShows[`week${week}`] : [];
            const attended = userShows.some(s => s.eventName === show.eventName && s.date === show.date);

            if (attended) {
                let geScore = 0, rawVisualScore = 0, rawMusicScore = 0;
                
                for (const caption in userProfile.lineup) {
                    const [corps, , year] = userProfile.lineup[caption].split('|');
                    const captionScore = getRealisticCaptionScore(corps, year, caption, scoredDay, historicalData);
                    
                    if (['GE1', 'GE2'].includes(caption)) geScore += captionScore;
                    else if (['VP', 'VA', 'CG'].includes(caption)) rawVisualScore += captionScore;
                    else if (['B', 'MA', 'P'].includes(caption)) rawMusicScore += captionScore;
                }

                const visualScore = rawVisualScore / 2;
                const musicScore = rawMusicScore / 2;

                showResult.results.push({
                    uid: userDoc.ref.parent.parent.id,
                    corpsName: userProfile.corpsName,
                    totalScore: geScore + visualScore + musicScore,
                    geScore,
                    visualScore,
                    musicScore,
                });
            }
        }
        dailyRecap.shows.push(showResult);
    }
    
    const recapDocRef = db.doc(`fantasy_recaps/${seasonData.seasonUid}`);
    await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(recapDocRef);
        if (!doc.exists) {
            transaction.set(recapDocRef, {
                seasonName: seasonData.name,
                recaps: [dailyRecap],
            });
        } else {
            const existingRecaps = doc.data().recaps || [];
            const updatedRecaps = existingRecaps.filter(r => r.offSeasonDay !== scoredDay);
            updatedRecaps.push(dailyRecap);
            transaction.update(recapDocRef, { recaps: updatedRecaps });
        }
    });

    logger.info(`Successfully archived fantasy recaps for day ${scoredDay}.`);
});

exports.processLiveScoreRecap = onMessagePublished(LIVE_SCORES_TOPIC, async (message) => {
    logger.info("Received new live score recap to process.");
    const db = getDb();

    try {
        const payloadBuffer = Buffer.from(message.data.message.data, "base64").toString("utf-8");
        const { eventName, scores, eventDate } = JSON.parse(payloadBuffer);

        const seasonDoc = await db.doc("game-settings/season").get();
        if (!seasonDoc.exists || seasonDoc.data().status !== 'live-season') return;

        const seasonData = seasonDoc.data();
        const activeSeasonId = seasonData.seasonUid;
        const seasonStartDate = seasonData.schedule.startDate.toDate();

        const parsedEventDate = new Date(eventDate);
        const diffInMillis = parsedEventDate.getTime() - seasonStartDate.getTime();
        const eventDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;

        const batch = db.batch();
        for (const scoreData of scores) {
            const docId = `${scoreData.corps.replace(/ /g, '_')}-${eventDay}`;
            const scoreDocRef = db.doc(`live_scores/${activeSeasonId}/scores/${docId}`);
            batch.set(scoreDocRef, {
                corpsName: scoreData.corps,
                day: eventDay,
                eventName: eventName,
                captions: scoreData.captions
            });
        }
        await batch.commit();
        logger.info(`Saved ${scores.length} real score records for day ${eventDay}.`);
        
        const profilesQuery = db.collectionGroup('profile').where('activeSeasonId', '==', activeSeasonId);
        const profilesSnapshot = await profilesQuery.get();
        if (profilesSnapshot.empty) return;

        for (const userDoc of profilesSnapshot.docs) {
            const userProfile = userDoc.data();
            const uid = userDoc.ref.parent.parent.id;

            const userShows = Object.values(userProfile.selectedShows || {}).flat();
            const attendedShow = userShows.some(s => s.eventName === eventName);

            if (attendedShow) {
                let showScore = 0;
                for (const caption in userProfile.lineup) {
                    const [selectedCorps, ,] = userProfile.lineup[caption].split('|');

                    const corpsResult = scores.find(s => s.corps === selectedCorps);
                    if (corpsResult && corpsResult.captions[caption]) {
                        showScore += corpsResult.captions[caption];
                    }
                }

                if (showScore > 0) {
                    const newTotal = (userProfile.totalSeasonScore || 0) + showScore;
                    await userDoc.ref.update({ totalSeasonScore: newTotal });
                    logger.info(`User ${uid} scored ${showScore.toFixed(3)} points for ${eventName}. New total: ${newTotal.toFixed(3)}`);
                }
            }
        }

    } catch (error) {
        logger.error("Error processing live score recap:", error);
    }
});

// ================================================================= //
//                      INTERNAL HELPER LOGIC                        //
// ================================================================= //

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

        const eventName = $('div[data-widget_type="theme-post-title.default"] h1.elementor-heading-title').text().trim() || "Unknown DCI Event";
        const dateLocationDiv = $('div[data-widget_type="shortcode.default"] div.score-date-location');
        const dateText = dateLocationDiv.find('p').eq(0).text().trim();
        const locationText = dateLocationDiv.find('p').eq(1).text().trim();

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
        
        logger.info(`PARSED DATA --> Name: '${eventName}', Date: '${eventDate.toISOString()}', Location: '${eventLocation}', Year: '${year}'`);
        
        const headerRow = $('table#effect-table-0 > tbody > tr.table-top');
        const orderedCaptionTitles = [];
        headerRow.find('td.type').each((_i, el) => {
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
                const normalized = title.replace(/\s-\s/g, ' ').trim();
                return tempScores.hasOwnProperty(normalized) ? normalized : null;
            };

            const scoreTables = $(row).find('table.data');

            scoreTables.each((index, table) => {
                const captionTitle = orderedCaptionTitles[index];
                const mappedTitle = mapCaptionTitleToKey(captionTitle);
                
                if (mappedTitle) {
                    const score = parseFloat($(table).find('td').eq(2).text().trim());
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
                GE1: processCaption("General Effect 1"), GE2: processCaption("General Effect 2"),
                VP:  processCaption("Visual Proficiency"), VA:  processCaption("Visual Analysis"), CG:  processCaption("Color Guard"),
                B:   processCaption("Music Brass"), MA:  processCaption("Music Analysis"), P:   processCaption("Music Percussion"),
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

    const scheduleTemplateRef = db.doc('schedules/live_season_template');
    const scheduleTemplateDoc = await scheduleTemplateRef.get();
    const events = scheduleTemplateDoc.exists ? scheduleTemplateDoc.data().events : [];

    const augustFirst = new Date(year, 7, 1);
    const dayOfWeek = augustFirst.getDay();
    const daysToAdd = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
    const firstSaturday = new Date(augustFirst.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    const finalsDate = new Date(firstSaturday.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startDate = new Date(finalsDate.getTime() - 69 * 24 * 60 * 60 * 1000);

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
            offSeasonCorpsData.push({ corpsName: chosenCorps.corpsName, sourceYear: chosenCorps.sourceYear, points: chosenCorps.points });
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
        const profilesQuery = db.collectionGroup('profile').where('activeSeasonId', '==', oldSeasonUid);
        const profilesSnapshot = await profilesQuery.get();
        
        if (!profilesSnapshot.empty) {
            const batch = db.batch();
            profilesSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, { activeSeasonId: null });
            });
            await batch.commit();
            logger.info(`Invalidated activeSeasonId for ${profilesSnapshot.size} users from previous season: ${oldSeasonUid}`);
        }
    }
}

async function generateOffSeasonSchedule(seasonLength, startDay) {
    logger.info(`Generating schedule for a ${seasonLength}-day season, starting on day ${startDay}.`);
    const db = getDb();
    const scoresSnapshot = await db.collection('historical_scores').get();
    
    const showsByDay = new Map();
    let allShows = []; 
    scoresSnapshot.forEach(yearDoc => {
        const yearData = yearDoc.data().data || [];
        yearData.forEach(event => {
            if (event.eventName && event.offSeasonDay && !event.eventName.toLowerCase().includes('open class')) {
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
        const candidates = showsForThisDay.filter(s => 
            s.eventName.toLowerCase().includes(showNamePattern.toLowerCase()) && 
            !usedEventNames.has(s.eventName)
        );
        
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
    
    const easternClassicCandidates = [...showsForDay41, ...showsForDay42].filter(s => 
        s.eventName.includes("DCI Eastern Classic") && 
        !usedEventNames.has(s.eventName)
    );

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
        logger.warn(`Could not find "DCI Eastern Classic" on days 41 or 42. These days will be filled randomly if available.`);
    }
    
    const remainingDays = schedule.filter(d => d.shows.length === 0);
    const twoShowDayCount = Math.floor(remainingDays.length * 0.2);
    const dayCounts = shuffleArray([...Array(twoShowDayCount).fill(2), ...Array(remainingDays.length - twoShowDayCount).fill(3)]);

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

    logger.info(`Advanced schedule generated successfully.`);
    return schedule;
}  
    
function calculateOffSeasonDay(eventDate, year) {
    if (!eventDate || isNaN(eventDate.getTime())) return null;

    const firstOfAugust = new Date(Date.UTC(year, 7, 1));
    const dayOfWeek = firstOfAugust.getUTCDay();
    const daysUntilFirstSaturday = (6 - dayOfWeek + 7) % 7;
    const firstSaturdayDate = 1 + daysUntilFirstSaturday;
    const finalsDateUTC = new Date(Date.UTC(year, 7, firstSaturdayDate + 7));

    const seasonEndDate = new Date(finalsDateUTC);
    const seasonStartDate = new Date(finalsDateUTC.getTime() - 48 * 24 * 60 * 60 * 1000);
    const eventDateUTC = new Date(Date.UTC(eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate()));
    
    if (eventDateUTC < seasonStartDate || eventDateUTC > seasonEndDate) return null;

    const diffInMillis = eventDateUTC.getTime() - seasonStartDate.getTime();
    const diffInDays = Math.round(diffInMillis / (1000 * 60 * 60 * 24));
    
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
    
    const liveSeasonStartDate = new Date(nextFinalsDate.getTime() - 69 * 24 * 60 * 60 * 1000);
    const seasonTypes = ['Finale', 'Crescendo', 'Scherzo', 'Adagio', 'Allegro', 'Overture'];
    const seasonWindows = [];

    for (let i = 0; i < seasonTypes.length; i++) {
        const seasonEndDate = new Date(liveSeasonStartDate.getTime() - (i * 49 * 24 * 60 * 60 * 1000) - (1 * 24 * 60 * 60 * 1000));
        const seasonStartDate = new Date(seasonEndDate.getTime() - 48 * 24 * 60 * 60 * 1000);
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
    
    const overtureStartDate = new Date(nextFinalsDate.getTime() + 1 * 24 * 60 * 60 * 1000);
    const overtureEndDate = new Date(overtureStartDate.getTime() + 48 * 24 * 60 * 60 * 1000);
    
    return {
        startDate: overtureStartDate,
        endDate: overtureEndDate,
        seasonType: 'Overture',
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
        return Math.max(0, Math.min(maxScore, parseFloat(finalScore.toFixed(3))));

    } else if (allDataPoints.length === 1) {
        return allDataPoints[0][1];
    } else {
        logger.warn(`No historical scores found for ${corpsName} (${sourceYear}), caption ${caption}. Returning 0.`);
        return 0;
    }
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
    memory: '2GiB',
    timeoutSeconds: 540,
}, async (message) => {
    const payloadBuffer = Buffer.from(message.data.message.data, 'base64').toString('utf-8');
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
        await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        const linksOnPage = await page.$$eval('a.arrow-btn[href*="/scores/final-scores/"]', anchors => anchors.map(a => a.href));
        
        if (linksOnPage.length === 0) {
            logger.info(`[Paginator] Found no more 'final-scores' links on pageno=${pageno}. Ending discovery chain.`);
            return;
        }

        logger.info(`[Paginator] Found ${linksOnPage.length} 'final-scores' links. Queueing them for recap search.`);
        
        for (const finalScoresUrl of linksOnPage) {
            try {
                const { data } = await axios.get(finalScoresUrl, { timeout: 15000 });
                const $ = cheerio.load(data);
                
                $('a.arrow-btn[href*="/scores/recap/"]').each((_idx, el) => {
                    const recapLink = $(el).attr('href');
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
        const project = 'marching-art';
        const location = 'us-central1';
        const queue = 'recap-scraper-queue';
        const workerUrl = `https://us-central1-${project}.cloudfunctions.net/scrapeSingleRecap`;
        const queuePath = tasksClient.queuePath(project, location, queue);

        const task = {
            httpRequest: {
                httpMethod: 'POST',
                url: workerUrl,
                body: Buffer.from(JSON.stringify({ url })).toString('base64'),
                headers: { 'Content-Type': 'application/json' },
            },
        };

        await tasksClient.createTask({ parent: queuePath, task: task });
        logger.info(`[Queuer] Successfully queued task for URL: ${url}`);
    } catch (error) {
        logger.error(`[Queuer] Failed to queue task for URL: ${url}`, error);
    }
}