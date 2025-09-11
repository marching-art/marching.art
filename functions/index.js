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
const { Timestamp } = require('firebase-admin/firestore'); // Import Timestamp

const pubsubClient = new PubSub();
const tasksClient = new CloudTasksClient();
const PAGINATION_TOPIC = "dci-pagination-topic";

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
    // Example: await getAuth().setCustomUserClaims(user.uid, { admin: makeAdmin });
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
    
    logger.info(`[validateAndSaveLineup] Firing for user: ${uid}`);
    
    if (!lineup || Object.keys(lineup).length !== 8) {
        throw new HttpsError("invalid-argument", "A complete 8-caption lineup is required.");
    }

    const lineupValues = Object.values(lineup).sort();
    const lineupKey = lineupValues.join("_");
    
    const seasonSettingsRef = getDb().doc("game-settings/season");
    const seasonDoc = await seasonSettingsRef.get();
    if (!seasonDoc.exists || seasonDoc.data().status === "inactive") {
        throw new HttpsError("failed-precondition", "There is no active season.");
    }
    const activeSeasonId = seasonDoc.id;

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
                throw new HttpsError("already-exists", "This exact lineup has already been claimed by another user.");
            }

            const oldLineupKey = userProfileDoc.data().lineupKey;
            if (oldLineupKey && oldLineupKey !== lineupKey) {
                const oldActiveLineupRef = getDb().collection("activeLineups").doc(oldLineupKey);
                transaction.delete(oldActiveLineupRef);
            }
            
            transaction.set(newActiveLineupRef, { uid: uid, seasonId: activeSeasonId });
            
            const profileUpdateData = {
                lineup: lineup,
                lineupKey: lineupKey,
                activeSeasonId: activeSeasonId,
                corpsName: corpsName,
            };

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
        // Define a single, known-good URL for manual testing
        const testUrl = 'https://www.dci.org/scores/recap/2023-dci-world-championships-finals';
        
        // Pass the URL to the logic function
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
        
        // --- NEW: Calculate offSeasonDay using our helper function ---
        const parsedEventDate = new Date(eventDate);
        const offSeasonDay = calculateOffSeasonDay(parsedEventDate, year);

        const newEventData = {
            eventName: eventName,
            date: eventDate,
            location: eventLocation,
            scores: scores,
            headerMap: {},
            offSeasonDay: offSeasonDay // Use the calculated value here
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
    schedule: "*/30 19-23 * 7,8 6",
    timeZone: "America/New_York",
}, async (_context) => {
    await scrapeDciScoresLogic();
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

/**
 * NEW: Nightly function to process scores for the current day of the off-season.
 */
exports.processDailyScores = onSchedule({
    schedule: "every day 03:00",
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
    
    // Calculate the current off-season day (1-49)
    const now = new Date();
    const diffInMillis = now.getTime() - seasonStartDate.getTime();
    const diffInDays = Math.floor(diffInMillis / (1000 * 60 * 60 * 24));
    const currentOffSeasonDay = diffInDays + 1;

    if (currentOffSeasonDay < 1 || currentOffSeasonDay > 49) {
        logger.info(`Current off-season day (${currentOffSeasonDay}) is outside the 1-49 range. Exiting.`);
        return;
    }

    logger.info(`Processing scores for Off-Season Day: ${currentOffSeasonDay}`);

    // Get today's scheduled shows from the season document
    const todayEventData = seasonData.events.find(e => e.offSeasonDay === currentOffSeasonDay);
    if (!todayEventData || !todayEventData.shows || todayEventData.shows.length === 0) {
        logger.info(`No shows scheduled for day ${currentOffSeasonDay}. Nothing to score.`);
        return;
    }
    const todaysShows = todayEventData.shows;
    
    // Get all user profiles participating in the current season
    const profilesQuery = db.collectionGroup('profile').where('activeSeasonId', '==', seasonData.id);
    const profilesSnapshot = await profilesQuery.get();
    
    if (profilesSnapshot.empty) {
        logger.info("No users have joined the current season. Exiting.");
        return;
    }
    
    const week = Math.ceil(currentOffSeasonDay / 7);
    
    for (const userDoc of profilesSnapshot.docs) {
        const userProfile = userDoc.data();
        const uid = userDoc.ref.parent.parent.id; // Correctly get UID from subcollection path
        
        // Check if the user has selected shows for this week
        const userShowsForWeek = userProfile.selectedShows ? userProfile.selectedShows[`week${week}`] : [];
        if (!userShowsForWeek || userShowsForWeek.length === 0) {
            continue; // User didn't select any shows this week
        }

        let dailyScore = 0;
        
        for (const show of todaysShows) {
            // Check if the user "attended" this show
            const attendedShow = userShowsForWeek.some(s => s.eventName === show.eventName && s.date === show.date);
            if (attendedShow) {
                // Calculate user's score for this specific show
                let showScore = 0;
                for (const caption in userProfile.lineup) {
                    const selectedCorps = userProfile.lineup[caption];
                    const corpsScoreData = show.scores.find(s => s.corps === selectedCorps);
                    if (corpsScoreData && corpsScoreData.captions[caption]) {
                        showScore += corpsScoreData.captions[caption];
                    }
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

exports.getShowRegistrations = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");

    const { week, eventName, date } = request.data;
    if (!week || !eventName || !date) {
        throw new HttpsError("invalid-argument", "Missing required show data.");
    }
    
    const db = getDb();
    const seasonDoc = await db.doc("game-settings/season").get();
    if (!seasonDoc.exists) throw new HttpsError("not-found", "No active season.");
    
    const activeSeasonId = seasonDoc.id;
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

/**
 * NEW: Callable function for a user to save their show selections for a given week.
 */
exports.selectUserShows = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }
    const uid = request.auth.uid;
    const { week, shows } = request.data; // Expects week: 1, shows: [show1, show2, ...]

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

// ================================================================= //
//                      INTERNAL HELPER LOGIC                        //
// ================================================================= //

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @param {Array} array The array to shuffle.
 * @returns {Array} The shuffled array.
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  return array; // Return the array for easier use
}

async function scrapeDciScoresLogic(urlToScrape) {
    logger.info(`[scrapeDciScoresLogic] Starting for URL: ${urlToScrape}`);
    if (!urlToScrape) {
        logger.error("[scrapeDciScoresLogic] Critical error: No URL provided.");
        throw new Error("A URL is required to scrape.");
    }
    
    try {
        const { data } = await axios.get(urlToScrape);
        const $ = cheerio.load(data);
        const scoresData = [];

        // --- CORRECTED SELECTORS FOR METADATA ---
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
        
        // --- ★ NEW: Parse the table header ONCE to create a caption map ★ ---
        const headerRow = $('table#effect-table-0 > tbody > tr.table-top');
        const orderedCaptionTitles = [];
        headerRow.find('td.type').each((_i, el) => {
            orderedCaptionTitles.push($(el).text().trim());
        });

        // --- ★ REVISED DYNAMIC CAPTION SCRAPING LOGIC ★ ---
        $("table#effect-table-0 > tbody > tr").not(".table-top").each((i, row) => {
            const corpsName = $(row).find("td.sticky-td").first().text().trim();
            if (!corpsName) return;

            const totalScore = parseFloat($(row).find("td.data-total").last().find("span").first().text().trim());
            
            const tempScores = {
                "General Effect 1": [],
                "General Effect 2": [],
                "Visual Proficiency": [],
                "Visual Analysis": [],
                "Color Guard": [],
                "Music Brass": [],
                "Music Analysis": [],
                "Music Percussion": [],
            };
            
            // Map DCI's caption names to our internal keys
            const mapCaptionTitleToKey = (title) => {
                const normalized = title.replace(/\s-\s/g, ' ').trim();
                return tempScores.hasOwnProperty(normalized) ? normalized : null;
            };

            // Find all individual score tables for the current corps
            const scoreTables = $(row).find('table.data');

            // Iterate through the scores and use the ordered header map to identify them
            scoreTables.each((index, table) => {
                // The Nth score table in this row corresponds to the Nth caption title from the header
                const captionTitle = orderedCaptionTitles[index];
                const mappedTitle = mapCaptionTitleToKey(captionTitle);
                
                if (mappedTitle) {
                    // The actual score is the 3rd sub-cell (index 2) in the score table
                    const score = parseFloat($(table).find('td').eq(2).text().trim());
                    if (!isNaN(score)) {
                        tempScores[mappedTitle].push(score);
                    }
                }
            });

            // --- Process and Average the collected scores ---
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
                VP:  processCaption("Visual Proficiency"),
                VA:  processCaption("Visual Analysis"),
                CG:  processCaption("Color Guard"),
                B:   processCaption("Music Brass"),
                MA:  processCaption("Music Analysis"),
                P:   processCaption("Music Percussion"),
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
        await pubsubClient.topic("dci-scores-topic").publishMessage({ data: dataBuffer });
        logger.info(`Successfully published ${scoresData.length} corps scores from ${eventName}.`);

    } catch (error) {
        logger.error(`[scrapeDciScoresLogic] CRITICAL ERROR for URL ${urlToScrape}:`, error);
    }
}

async function startNewLiveSeason() {
    logger.info("Generating new live season...");
    const today = new Date();
    const year = today.getFullYear();

    const augustFirst = new Date(year, 7, 1);
    const dayOfWeek = augustFirst.getDay();
    const daysToAdd = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
    const firstSaturday = new Date(augustFirst.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    const finalsDate = new Date(firstSaturday.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startDate = new Date(finalsDate.getTime() - 70 * 24 * 60 * 60 * 1000);

    const newSeasonData = {
        name: `DCI ${year} Live Season`,
        status: "live-season",
        seasonYear: year,
        currentPointCap: 150,
        schedule: {
            startDate: startDate,
            endDate: finalsDate,
            openTradeEndDate: new Date(`${year}-07-01T23:59:59-04:00`),
            quartersDate: new Date(new Date(finalsDate).setDate(finalsDate.getDate() - 2)),
            semifinalsDate: new Date(new Date(finalsDate).setDate(finalsDate.getDate() - 1)),
            finalsDate: finalsDate,
        },
    };
    
    // TODO: Generate corpsData for the live season from final_rankings.
    await getDb().doc("game-settings/season").set(newSeasonData);
    logger.info(`Successfully started the ${newSeasonData.name}.`);
}

async function startNewOffSeason() {
    logger.info("Generating new off-season with cycle-sync and advanced rules...");
    const db = getDb();
    
    const startDate = new Date();
    const endDate = getNextSeasonEndDate();

    // Calculate truncated season length
    const diffInMillis = endDate.getTime() - startDate.getTime();
    let seasonLength = Math.ceil(diffInMillis / (1000 * 60 * 60 * 24));
    if (seasonLength > 49) seasonLength = 49;
    if (seasonLength < 1) {
        logger.error("Calculated season length is less than 1. Aborting.");
        return;
    }

    logger.info(`New season will start on ${startDate.toISOString()} and end on ${endDate.toISOString()}, with a length of ${seasonLength} days.`);

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
            const entry = {
                corpsName: corps.corps,
                sourceYear: year,
                points: pointValue
            };

            if (!pointsMap.has(pointValue)) {
                pointsMap.set(pointValue, []);
            }
            pointsMap.get(pointValue).push(entry);
            allCorpsList.push(entry);
        });
    });

    const offSeasonCorpsData = [];
    const usedCorpsNames = new Set();
    const shuffledAllCorps = shuffleArray(allCorpsList); // For fallback picks

    for (let points = 25; points >= 1; points--) {
        let candidates = pointsMap.get(points) || [];
        let chosenCorps = null;

        if (candidates.length > 0) {
            const shuffledCandidates = shuffleArray([...candidates]);
            
            // --- Step 1: Prioritize finding an unused corps with the correct point value ---
            chosenCorps = shuffledCandidates.find(c => !usedCorpsNames.has(c.corpsName));

            // --- Step 2: If no unused corps is found, accept a duplicate to maintain point accuracy ---
            if (!chosenCorps) {
                logger.info(`No unused corps for ${points} points. Accepting a duplicate.`);
                // Simply select the first available candidate, even if its name is already used.
                chosenCorps = shuffledCandidates[0];
            }
        }

        // --- Step 3 (Last Resort): If no corps exist for this point value at all ---
        if (!chosenCorps) {
            const fallback = shuffledAllCorps.find(c => !usedCorpsNames.has(c.corpsName));
            if (fallback) {
                logger.warn(`No corps found for ${points} points. Using fallback ${fallback.corpsName} and re-valuing.`);
                chosenCorps = { ...fallback, points: points }; // Assign the current loop's point value
            }
        }
        
        if (chosenCorps) {
            // It's important to push a copy of the object
            offSeasonCorpsData.push({
                corpsName: chosenCorps.corpsName,
                sourceYear: chosenCorps.sourceYear,
                points: chosenCorps.points,
            });
            // Still add the name to the used set so the primary logic (Step 1) works correctly.
            usedCorpsNames.add(chosenCorps.corpsName);
        }
    }
    
    const startDay = 49 - seasonLength + 1;

    const schedule = await generateOffSeasonSchedule(seasonLength, startDay);

    const seasonName = `Off-Season ${startDate.toLocaleString("default", { month: "long" })} ${startDate.getFullYear()}`;
    const dataDocId = `off-season-${startDate.getFullYear()}-${startDate.getMonth() + 1}-${startDate.getDate()}`;
    
    await db.doc(`dci-data/${dataDocId}`).set({ corpsValues: offSeasonCorpsData, /* ... */ });

    const newSeasonSettings = {
        name: seasonName,
        status: "off-season",
        seasonUid: dataDocId,
        currentPointCap: 150,
        dataDocId: dataDocId,
        schedule: {
            startDate: Timestamp.fromDate(startDate),
            endDate: Timestamp.fromDate(endDate),
        },
        events: schedule
    };

    await db.doc("game-settings/season").set(newSeasonSettings);
    logger.info(`Successfully started ${seasonName} for ${seasonLength} days.`);
}


async function generateOffSeasonSchedule(seasonLength, startDay) {
    logger.info(`Generating schedule for a ${seasonLength}-day season, starting on day ${startDay}.`);
    const db = getDb();
    const scoresSnapshot = await db.collection('historical_scores').get();
    
    // 1. Group all valid shows by their offSeasonDay, EXCLUDING "Open Class"
    const showsByDay = new Map();
    let allShows = []; 
    scoresSnapshot.forEach(yearDoc => {
        const yearData = yearDoc.data().data || [];
        yearData.forEach(event => {
            // --- NEW: Filter out "Open Class" shows ---
            if (event.eventName && event.offSeasonDay && !event.eventName.toLowerCase().includes('open class')) {
                const showData = {
                    eventName: event.eventName,
                    date: event.date,
                    location: event.location,
                    scores: event.scores,
                    offSeasonDay: event.offSeasonDay
                };
                if (!showsByDay.has(event.offSeasonDay)) showsByDay.set(event.offSeasonDay, []);
                showsByDay.get(event.offSeasonDay).push(showData);
                allShows.push(showData);
            }
        });
    });

    // 2. Initialize schedule for the correct range of days
    const schedule = Array.from({ length: seasonLength }, (_, i) => ({ offSeasonDay: startDay + i, shows: [] }));
    const usedEventNames = new Set();
    const usedLocations = new Set();

    // --- UPDATED: More robust function to find and place shows ---
    const findAndSetShow = (day, name, mandatory) => {
        const dayObject = schedule.find(d => d.offSeasonDay === day);
        if (!dayObject) return false; // Day doesn't exist in this truncated schedule

        const potentialShows = showsByDay.get(day) || [];
        const show = potentialShows.find(s => s.eventName.includes(name));
        
        if (show) {
            dayObject.shows = [{ ...show, mandatory }];
            usedEventNames.add(show.eventName);
            usedLocations.add(show.location);
            return true;
        }

        logger.warn(`Could not find required show for Day ${day}: ${name}. Day will be filled randomly.`);
        return false;
    };
    
    // 3. Place mandatory and special shows first
    findAndSetShow(28, "DCI Southwestern Championship", true);
    findAndSetShow(47, "DCI World Championship Prelims", true);
    findAndSetShow(48, "DCI World Championship Semifinals", true);
    findAndSetShow(49, "DCI World Championship Finals", true);

    // ... (rest of the special show logic for DCI East, etc.) ...
    
    // 4. Fill the rest of the schedule
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

    // --- NEW: Ensure Days 45 and 46 are always empty ---
    const day45 = schedule.find(d => d.offSeasonDay === 45);
    if (day45) day45.shows = [];
    const day46 = schedule.find(d => d.offSeasonDay === 46);
    if (day46) day46.shows = [];

    logger.info(`Advanced schedule generated successfully.`);
    return schedule;
}  
    
/**
 * Calculates the off-season day (1-49) for a given event date.
 * Day 49 is defined as the second Saturday in August of the event's year.
 * @param {Date} eventDate The date of the drum corps event.
 * @param {number} year The four-digit year of the event.
 * @return {number|null} The off-season day (1-49) or null if outside the season.
 */
function calculateOffSeasonDay(eventDate, year) {
    if (!eventDate || isNaN(eventDate.getTime())) {
        return null; // Cannot calculate without a valid date
    }

    // --- Step 1: Find the second Saturday in August for the given year ---
    const firstOfAugust = new Date(Date.UTC(year, 7, 1)); // Month is 0-indexed, 7 = August
    const dayOfWeek = firstOfAugust.getUTCDay(); // 0=Sunday, 6=Saturday

    // Days to add to the 1st to get to the first Saturday
    const daysUntilFirstSaturday = (6 - dayOfWeek + 7) % 7;
    const firstSaturdayDate = 1 + daysUntilFirstSaturday;
    
    // The second Saturday is 7 days after the first one
    const finalsDateUTC = new Date(Date.UTC(year, 7, firstSaturdayDate + 7));

    // --- Step 2: Determine the 49-day season window ---
    const seasonEndDate = new Date(finalsDateUTC);
    const seasonStartDate = new Date(finalsDateUTC.getTime() - 48 * 24 * 60 * 60 * 1000);

    // --- Step 3: Check if the event is within the window ---
    // Normalize eventDate to UTC start of day for accurate comparison
    const eventDateUTC = new Date(Date.UTC(eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate()));
    
    if (eventDateUTC < seasonStartDate || eventDateUTC > seasonEndDate) {
        return null; // Event is outside the 49-day off-season window
    }

    // --- Step 4: Calculate the specific off-season day ---
    const diffInMillis = eventDateUTC.getTime() - seasonStartDate.getTime();
    const diffInDays = Math.round(diffInMillis / (1000 * 60 * 60 * 24));
    
    return diffInDays + 1; // Return the day number (1 to 49)
}

function getNextSeasonEndDate() {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // DCI Finals is the 2nd Saturday in August. This is our anchor.
    const findSecondSaturday = (year) => {
        const firstOfAugust = new Date(year, 7, 1);
        let dayOfWeek = firstOfAugust.getDay();
        let firstSaturday = 1 + (6 - dayOfWeek + 7) % 7;
        return new Date(year, 7, firstSaturday + 7);
    };

    let dciFinalsDate = findSecondSaturday(currentYear);

    // If this year's DCI finals have already passed, the anchor is next year's finals.
    if (now > dciFinalsDate) {
        dciFinalsDate = findSecondSaturday(currentYear + 1);
    }
    
    // The live season is 10 weeks. The off-season is 7 weeks (49 days).
    // The full cycle is 17 weeks. We need to find the next 7-week interval end date
    // that occurs before the next 10-week live season begins.

    // A full cycle is 17 weeks (119 days). We can work backwards from DCI finals.
    const liveSeasonStartDate = new Date(dciFinalsDate.getTime() - (69 * 24 * 60 * 60 * 1000)); // 10 weeks = 70 days
    
    // Find the closest previous 7-week cycle end date.
    let potentialEndDate = new Date(liveSeasonStartDate.getTime() - (1 * 24 * 60 * 60 * 1000)); // Day before live season
    
    // This logic ensures we find the correct end date for the 7-week off-season slot
    // immediately preceding the live season.
    while (potentialEndDate > now) {
        let proposedStartDate = new Date(potentialEndDate.getTime() - (48 * 24 * 60 * 60 * 1000));
        if (proposedStartDate <= now) {
            break;
        }
        potentialEndDate = new Date(potentialEndDate.getTime() - (49 * 24 * 60 * 60 * 1000));
    }
    
    return potentialEndDate;
}

// ================================================================= //
//                      NEW CRAWLER & WORKER FUNCTIONS               //
// ================================================================= //

/**
 * The CRAWLER: An onCall function that finds all recap URLs on the main DCI scores
 * page and adds them as tasks to a Cloud Tasks queue.
 */
// In functions/index.js, replace the entire discoverAndQueueUrls function

exports.discoverAndQueueUrls = onCall({ cors: true }, async (request) => {
    if (!request.auth || !request.auth.token.admin) {
        throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
    }

    logger.info("Kicking off asynchronous discovery process...");
    
    // Publish the first page number to the pagination topic to start the chain.
    const dataBuffer = Buffer.from(JSON.stringify({ pageno: 1 }));
    await pubsubClient.topic(PAGINATION_TOPIC).publishMessage({ data: dataBuffer });

    return { success: true, message: "Asynchronous scraper process initiated. See logs for progress." };
});

/**
 * The WORKER: An HTTP-triggered function that receives a URL from the Cloud Tasks
 * queue, scrapes it, and publishes the results to Pub/Sub.
 */
exports.scrapeSingleRecap = onRequest({ cors: true }, async (req, res) => {
    // The v2 onRequest wrapper handles body parsing, so req.body is already an object.
    try {
        const { url } = req.body;
        if (!url) {
            logger.error("Worker received a task with no URL.");
            res.status(400).send("Bad Request: Missing URL in payload.");
            return;
        }

        // We reuse our existing scraping logic!
        await scrapeDciScoresLogic(url);

        // Acknowledge the task was successful
        res.status(200).send("Successfully processed recap URL.");
    } catch (error) {
        logger.error(`Worker failed to process URL: ${req.body.url}`, error);
        // Tell Cloud Tasks the task failed so it can be retried
        res.status(500).send("Internal Server Error");
    }
});

exports.processPaginationPage = onMessagePublished({
    topic: PAGINATION_TOPIC,
    memory: '2GiB',
    timeoutSeconds: 540,
}, async (message) => {
    // --- FIX STARTS HERE ---
    // Manually decode the Base64 payload and parse it as JSON.
    const payloadBuffer = Buffer.from(message.data.message.data, 'base64').toString('utf-8');
    const { pageno } = JSON.parse(payloadBuffer);
    // --- FIX ENDS HERE ---

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
        
        // Use Axios to quickly find recap links on each final-scores page
        for (const finalScoresUrl of linksOnPage) {
            try {
                const { data } = await axios.get(finalScoresUrl, { timeout: 15000 });
                const $ = cheerio.load(data);
                
                $('a.arrow-btn[href*="/scores/recap/"]').each((_idx, el) => {
                    const recapLink = $(el).attr('href');
                    if (recapLink) {
                        const fullUrl = new URL(recapLink, baseUrl).href;
                        // Instead of adding to a set, directly queue it in Cloud Tasks
                        queueRecapUrlForScraping(fullUrl);
                    }
                });
            } catch (error) {
                 logger.warn(`[Paginator] Could not process ${finalScoresUrl}. Skipping. Message: ${error.message}`);
            }
        }
        
        // Trigger the next page processing
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
        // The CloudTasksClient is now initialized globally, no need to require it here
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