const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { setGlobalOptions } = require("firebase-functions/v2/options"); // <<< CORS FIX: ADD THIS LINE
const { PubSub } = require('@google-cloud/pubsub');
const axios = require('axios');
const cheerio = require('cheerio');
const { db, appId } = require('./_config');
// --- END: All require statements ---

// <<< CORS FIX: ADD THIS LINE to configure permissions
setGlobalOptions({ cors: { origin: "https://www.marching.art" } });

// Initialize the PubSub client ONCE
const pubsubClient = new PubSub();

// Initialize Firebase Admin SDK
admin.initializeApp();

// --- Helper Functions ---

const getSecondSaturdayOfAugust = (year) => {
    const augustFirst = new Date(year, 7, 1);
    let firstSaturday = 1;
    if (augustFirst.getDay() !== 6) {
        firstSaturday = 1 + (6 - augustFirst.getDay());
    }
    return new Date(year, 7, firstSaturday + 7);
};

const corsOptions = {
  cors: ["https://www.marching.art", "https://marching.art", /marching-art.*\.vercel\.app$/, "http://localhost:3000"],
};

// --- Automated Master Scheduler ---

/**
 * Runs once a day to check for and manage season transitions automatically.
 */
exports.validateAndSaveLineup = onCall(async (request) => {
    // 1. Authentication & Basic Validation
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in to save a lineup.");
    }
    const { lineup, corpsName } = request.data;
    if (!lineup || Object.keys(lineup).length !== 8) {
        throw new HttpsError("invalid-argument", "A complete 8-caption lineup is required.");
    }

    const uid = request.auth.uid;
    const lineupValues = Object.values(lineup).sort(); // Sort to create a consistent key

    // 2. Create a unique, readable key for the lineup
    const lineupKey = lineupValues.join('_');
    if (lineupValues.length !== 8 || lineupValues.some(val => !val)) {
        throw new HttpsError("invalid-argument", "The lineup is incomplete.");
    }
    
    // 3. Get current season settings
    const seasonSettingsRef = db.doc('game-settings/season');
    const seasonDoc = await seasonSettingsRef.get();
    if (!seasonDoc.exists || seasonDoc.data().status === 'inactive') {
        throw new HttpsError("failed-precondition", "There is no active season.");
    }
    const activeSeasonId = seasonDoc.id;
    const seasonData = seasonDoc.data();

    // 4. Perform the main logic in a transaction to ensure data integrity
    try {
        await db.runTransaction(async (transaction) => {
            const userProfileRef = db.doc(`artifacts/${appId}/users/${uid}/profile/data`);
            const userProfileDoc = await transaction.get(userProfileRef);
            if (!userProfileDoc.exists) {
                throw new HttpsError("not-found", "User profile does not exist.");
            }

            // Reference to the new, unique lineup document in our tracking collection
            const newActiveLineupRef = db.collection('activeLineups').doc(lineupKey);
            const existingLineupDoc = await transaction.get(newActiveLineupRef);

            // Check if this exact lineup is already taken by ANOTHER user
            if (existingLineupDoc.exists && existingLineupDoc.data().uid !== uid) {
                throw new HttpsError("already-exists", "This exact lineup has already been claimed by another user. Please change at least one corps.");
            }

            // If the user is updating their lineup, we must delete their old one
            const oldLineupKey = userProfileDoc.data().lineupKey;
            if (oldLineupKey && oldLineupKey !== lineupKey) {
                const oldActiveLineupRef = db.collection('activeLineups').doc(oldLineupKey);
                transaction.delete(oldActiveLineupRef);
            }
            
            // 5. Save the new lineup and update the user's profile
            transaction.set(newActiveLineupRef, { uid: uid, seasonId: activeSeasonId });
            
            const profileUpdateData = {
                lineup: lineup,
                lineupKey: lineupKey, // Store the key for easy deletion next time
                activeSeasonId: activeSeasonId
            };
            // If this is a new signup, also set the corps name
            if (corpsName) {
                profileUpdateData.corpsName = corpsName;
            }

            transaction.update(userProfileRef, profileUpdateData);
        });

        return { success: true, message: "Lineup saved successfully!" };

    } catch (error) {
        console.error("Transaction failed: ", error);
        // Re-throw HttpsError to be caught by the client, or wrap other errors
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError("internal", "An error occurred while saving your lineup. Please try again.");
    }
});

/**
 * Runs automatically every day at 3:00 AM Eastern Time.
 * Checks if the current season has ended and triggers the start of the next season.
 */
exports.seasonScheduler = onSchedule({
    schedule: 'every day 03:00',
    timeZone: 'America/New_York',
}, async (context) => {
    
    console.log('Running daily season scheduler...');
    const now = new Date();

    const seasonSettingsRef = db.doc('game-settings/season');
    const seasonDoc = await seasonSettingsRef.get();

    if (!seasonDoc.exists) {
        console.log('No season document found. Attempting to start the first off-season.');
        await startNewOffSeason(); 
        return;
    }

    const seasonData = seasonDoc.data();
    
    // Check if the schedule and endDate exist before trying to access them
    if (!seasonData.schedule || !seasonData.schedule.endDate) {
        console.log('Season document is missing a schedule or end date. Attempting to start a new off-season to correct.');
        await startNewOffSeason();
        return;
    }

    const seasonEndDate = seasonData.schedule.endDate.toDate();

    // If the current season has NOT ended, do nothing.
    if (now < seasonEndDate) {
        console.log(`Current season (${seasonData.name}) is still active. Ends on ${seasonEndDate}. No action taken.`);
        return;
    }

    // --- The current season has ended! ---
    console.log(`Season ${seasonData.name} has ended. Starting next season.`);

    // TODO: Add logic here to finalize the ended season (calculate final scores, award trophies, etc.)

    // Determine what the next season should be
    const today = new Date();
    const currentYear = today.getFullYear();
    // DCI season typically starts in late June. Let's use June 15th as the cutoff.
    const liveSeasonStartDate = new Date(currentYear, 5, 15); // Month is 0-indexed, so 5 is June.

    if (seasonData.status === 'off-season' && today >= liveSeasonStartDate) {
        console.log("It's time for the live season! Starting now.");
        await startNewLiveSeason();
    } else {
        console.log("Starting a new off-season.");
        await startNewOffSeason();
    }
});

exports.manageSeasonTransitions = onSchedule({schedule: "every day 01:05", timeZone: "America/New_York"}, async (event) => {
    console.log("Running daily season transition check...");
    const today = new Date();
    const year = today.getFullYear();

    const finalsDay = getSecondSaturdayOfAugust(year);
    const liveSeasonEnd = new Date(finalsDay);
    liveSeasonEnd.setDate(liveSeasonEnd.getDate() + 1); 

    const liveSeasonStart = new Date(finalsDay);
    liveSeasonStart.setDate(liveSeasonStart.getDate() - 69);

    const seasonSettingsRef = db.collection('game-settings').doc('season');
    const seasonDoc = await seasonSettingsRef.get();
    const currentStatus = seasonDoc.exists ? seasonDoc.data().status : 'inactive';

    // --- Start a NEW LIVE season ---
    /* COMMENT OUT THIS ENTIRE BLOCK TO PREVENT IT FROM RUNNING
    if (today >= liveSeasonStart && today < liveSeasonEnd && currentStatus !== 'live-season') {
        console.log("AUTOMATION: Starting new Live Season.");
        // Placeholder for a future 'startNewLiveSeason' function
        await seasonSettingsRef.set({
            status: 'live-season',
            name: `Live Season ${year}`,
            seasonYear: year,
            currentPointCap: 150,
            startDate: admin.firestore.Timestamp.fromDate(liveSeasonStart)
        });
        return;
    }
    */

    // --- Start a NEW OFF-SEASON ---
    if (today >= liveSeasonEnd && currentStatus === 'live-season') {
        console.log("AUTOMATION: Live season ended. Starting a new Off-Season.");
        // This would automatically call startNewOffSeason.
        // For now, we'll log and set to inactive.
        await seasonSettingsRef.set({ status: 'inactive', name: 'Inactive' });
        return;
    }
    
    console.log("No season transition required today.");
});


// --- Core Season Management Functions (Callable by Admin) ---

/**
 * Creates and saves all data for a new OFF-SEASON.
 * An off-season is 7 weeks long.
 */
async function startNewOffSeason() {
    console.log("Generating new off-season...");

    // 1. FETCH THE LATEST FINAL RANKINGS
    const rankingsQuery = db.collection('final_rankings').orderBy(db.FieldPath.documentId(), 'desc').limit(1);
    const rankingsSnapshot = await rankingsQuery.get();
    if (rankingsSnapshot.empty) {
        throw new Error("Cannot start off-season: No final rankings found in the database.");
    }
    const latestRankingsDoc = rankingsSnapshot.docs[0];
    const sourceCorps = latestRankingsDoc.data().data; // This is the array of {rank, corps, score}
    const sourceYear = latestRankingsDoc.id;

    console.log(`Using final rankings from ${sourceYear} as the source.`);

    // 2. SHUFFLE THE CORPS
    // We'll take the top 25 corps for randomization
    const shuffledCorps = shuffleArray(sourceCorps.slice(0, 25));

    // 3. ASSIGN NEW FANTASY POINT VALUES
    // Assign points in a descending fashion to the now-randomized list
    const pointValues = [25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const offSeasonCorpsData = shuffledCorps.map((item, index) => ({
        corpsName: item.corps,
        points: pointValues[index] || 1, // Assign points, default to 1 if out of range
    }));

    // 4. SAVE THE NEW CORPS DATA LIST
    const startDate = new Date();
    const seasonName = `Off-Season ${startDate.toLocaleString('default', { month: 'long' })} ${startDate.getFullYear()}`;
    // Create a unique ID for this season's data document
    const dataDocId = `off-season-${startDate.getFullYear()}-${startDate.getMonth() + 1}`;
    
    await db.doc(`dci-data/${dataDocId}`).set({
        corpsValues: offSeasonCorpsData,
        source: `Shuffled from ${sourceYear} rankings`,
        createdAt: startDate,
    });

    console.log(`Saved new corps data to dci-data/${dataDocId}`);

    // 5. UPDATE THE MAIN SEASON SETTINGS DOCUMENT
    const endDate = new Date(startDate.getTime() + 49 * 24 * 60 * 60 * 1000); // 7 weeks * 7 days

    const newSeasonSettings = {
        name: seasonName,
        status: 'off-season',
        currentPointCap: 150,
        dataDocId: dataDocId, // Link to the data document we just created
        schedule: {
            startDate: startDate,
            endDate: endDate
        }
    };

    await db.doc('game-settings/season').set(newSeasonSettings);
    console.log(`Successfully started the ${seasonName}.`);
}

/**
 * A standard Fisher-Yates shuffle algorithm to randomize an array.
 * This is the function your linter was referring to.
 */
function shuffleArray(array) {
  let currentIndex = array.length,  randomIndex;
  // While there remain elements to shuffle.
  while (currentIndex != 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

/**
 * Callable function for admins to archive the results of a completed season.
 */
exports.archiveSeasonResults = onCall(corsOptions, async (request) => {
    if (request.auth?.token.admin !== true) {
        throw new HttpsError('permission-denied', 'You must be an admin to perform this action.');
    }
    const { seasonIdToArchive, seasonName } = request.data;
    if (!seasonIdToArchive || !seasonName) {
        throw new HttpsError('invalid-argument', 'A season ID and name must be provided.');
    }
    console.log(`ARCHIVAL: Starting process for season: ${seasonIdToArchive}`);
    const batch = db.batch();
    try {
        const usersSnapshot = await db.collectionGroup('profile').where('activeSeasonId', '==', seasonIdToArchive).get();
        if (usersSnapshot.empty) {
            return { message: "No users participated in this season." };
        }
        
        const finalScores = usersSnapshot.docs.map(doc => ({
            userId: doc.ref.parent.parent.id,
            ...doc.data(),
            finalScore: Math.random() * 1000 + 500, // Replace with actual score calculation
        })).sort((a, b) => b.finalScore - a.finalScore);

        finalScores.forEach((userData, index) => {
            const userId = userData.userId;
            const archiveRef = db.collection('artifacts/marching-art/users').doc(userId).collection('seasonHistory').doc(seasonIdToArchive);
            batch.set(archiveRef, {
                seasonName: seasonName,
                corpsName: userData.corpsName,
                finalLineup: userData.lineup,
                finalScore: userData.finalScore,
                finalRank: index + 1,
                archivedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            const profileRef = db.doc(`artifacts/marching-art/users/${userId}/profile/data`);
            batch.update(profileRef, { activeSeasonId: null });
        });

        const seasonSettingsRef = db.collection('game-settings').doc('season');
        batch.update(seasonSettingsRef, { status: 'inactive', name: 'Inactive' });

        await batch.commit();
        return { message: `Successfully archived results for ${finalScores.length} users for season ${seasonName}.` };
    } catch (error) {
        console.error("Error archiving season results:", error);
        throw new HttpsError('internal', 'An unexpected error occurred during season archival.');
    }
});


// --- Daily Game Loop & Other Utilities ---

exports.runOffSeasonGameLoop = onSchedule({schedule: "every day 02:05", timeZone: "America/New_York"}, async (event) => {
    console.log("Starting the daily OFF-SEASON game loop...");
    const seasonSettingsRef = db.collection('game-settings').doc('season');
    const seasonDoc = await seasonSettingsRef.get();

    if (!seasonDoc.exists || seasonDoc.data().status !== 'off-season') {
        console.log("Off-season is not active. Exiting game loop.");
        return null;
    }

    const seasonData = seasonDoc.data();
    const startDate = seasonData.startDate.toDate();
    const today = new Date();
    const diffTime = Math.abs(today - startDate);
    const currentDay = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    console.log(`Running simulation for Off-Season Day ${currentDay}.`);

    // 1. Fetch the schedule for the current season
    const scheduleRef = db.collection('schedules').doc('current-off-season'); // Assuming a fixed ID for the off-season schedule for now
    const scheduleDoc = await scheduleRef.get();
    if (!scheduleDoc.exists) {
        console.error("Off-season schedule not found!");
        return null;
    }
    const todaysEvents = scheduleDoc.data().schedule.filter(e => e.day === currentDay);
    if (todaysEvents.length === 0) {
        console.log(`No events scheduled for Day ${currentDay}. Exiting.`);
        return null;
    }

    // 2. Fetch all users participating in this season
    const usersSnapshot = await db.collectionGroup('profile')
        .where('activeSeasonId', '==', seasonData.id) // This assumes season 'id' is set in game-settings
        .get();
        
    if (usersSnapshot.empty) {
        console.log("No users are participating in the current season. Exiting.");
        return null;
    }

    // 3. Fetch all historical scores to use for simulation
    const scoresSnapshot = await db.collection('historical_scores').get();
    const historicalScores = [];
    scoresSnapshot.forEach(doc => {
        historicalScores.push(...doc.data().data);
    });

    const batch = db.batch();

    // 4. Simulate events for each user
    for (const userDoc of usersSnapshot.docs) {
        const userProfile = userDoc.data();
        const userId = userDoc.ref.parent.parent.id;
        const userLineup = userProfile.lineup;

        if (!userLineup) continue; // Skip users with no lineup

        let totalDayScore = 0;
        const lineupCorps = Object.values(userLineup);

        // Simple simulation: find a relevant historical score and add some variance
        lineupCorps.forEach(corpsName => {
            const relevantScores = historicalScores.filter(s => s.corps === corpsName);
            let score = 75; // Default score if no history found
            if (relevantScores.length > 0) {
                // Use an average of historical scores
                const avgScore = relevantScores.reduce((acc, s) => acc + s.score, 0) / relevantScores.length;
                // Add some random variance to make it unique
                score = avgScore + (Math.random() - 0.5) * 5;
            }
            totalDayScore += score;
        });

        const finalDayScore = parseFloat((totalDayScore / 8).toFixed(3)); // Average the 8 caption scores

        // 5. Save the daily result to the user's active season history
        const eventResultRef = db.collection('artifacts/marching-art/users').doc(userId)
                                 .collection('activeSeasonEvents').doc(`day-${currentDay}`);
        
        batch.set(eventResultRef, {
            day: currentDay,
            eventName: todaysEvents[0].name, // Assuming one event per day for simplicity
            score: finalDayScore,
            lineup: userLineup,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    await batch.commit();
    console.log(`Successfully simulated Day ${currentDay} for ${usersSnapshot.docs.length} users.`);
    return null;
});

exports.setUserRole = onCall(corsOptions, async (request) => {
    if (request.auth?.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Request not authorized.');
    }
    const { email, makeAdmin } = request.data;
    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, { admin: makeAdmin });
        return { message: `Success! ${email} has been ${makeAdmin ? 'made' : 'removed as'} an admin.` };
    } catch (err) {
        throw new HttpsError('internal', 'Error setting user role.');
    }
});

exports.saveLineup = onCall(corsOptions, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in.');
    }
    const { lineup, totalPoints, appId } = request.data;
    const POINT_CAP = 150;
    const finalAppId = appId || 'marching-art';

    if (totalPoints > POINT_CAP) {
        throw new HttpsError('invalid-argument', `Points exceed cap.`);
    }
    if (Object.keys(lineup).length !== 8 || Object.values(lineup).some(c => !c)) {
        throw new HttpsError('invalid-argument', 'A complete lineup is required.');
    }
    try {
        const userDocRef = db.doc(`artifacts/${finalAppId}/users/${request.auth.uid}/profile/data`);
        await userDocRef.update({ lineup });
        return { message: 'Lineup saved successfully!' };
    } catch (err) {
        throw new HttpsError('internal', 'Failed to save lineup.');
    }
});

/**
 * Runs on a schedule to scrape detailed DCI recap pages.
 * This version is tailored to the complex nested table structure of the recap page.
 */
exports.scrapeDciScores = onSchedule({
    // Schedule remains commented out for off-season testing.
    schedule: 'every 5 minutes', 
    timeZone: 'America/New_York',
}, async (context) => {
    console.log('Running DCI RECAP scraper...');
    const urlToScrape = 'https://www.dci.org/scores/recap/2025-dci-world-championship-finals/';

    try {
        const { data } = await axios.get(urlToScrape);
        const $ = cheerio.load(data);
        const scoresData = [];

        // Select all table rows within the main table body, but exclude the header row
        $('table#effect-table-0 > tbody > tr').not('.table-top').each((i, row) => {
            
            const corpsName = $(row).find('td.sticky-td').first().text().trim();
            if (!corpsName) return; // Skip if the row is empty or not a corps row

            // --- Define the main sections based on their column position ---
            const geSection = $(row).find('td').eq(1);
            const visualSection = $(row).find('td').eq(2);
            const musicSection = $(row).find('td').eq(3);
            const totalScore = parseFloat($(row).find('td.data-total').last().find('span').first().text().trim());

            // Helper function to get the final caption score from a section
            // It looks for the final "TOT" column within a nested table structure
            const getCaptionTotal = (section, index) => {
                const scoreText = $(section).find('table.main-sec-table').eq(index).find('td.data-total span').first().text().trim();
                return parseFloat(scoreText);
            };

            const scores = {
                corps: corpsName,
                totalScore: totalScore,
                captions: {
                    // In the GE section (geSection), the first two tables are the GE judges.
                    // We take the final total from the entire GE section.
                    GE: getCaptionTotal(geSection, 0), // This gets the combined GE score like "39.275"

                    // In the Visual section (visualSection), captions are in order
                    VP: getCaptionTotal(visualSection, 0), // Visual Proficiency
                    VA: getCaptionTotal(visualSection, 1), // Visual Analysis
                    CG: getCaptionTotal(visualSection, 2), // Color Guard

                    // In the Music section (musicSection), captions are in order
                    B: getCaptionTotal(musicSection, 0), // Brass
                    MA: getCaptionTotal(musicSection, 1), // Music Analysis
                    P: getCaptionTotal(musicSection, 2),  // Percussion
                }
            };
            
            // Note: The recap sheet combines GE1 and GE2 into one GE score.
            // For the game, we can divide this by 2 to get an average for GE1 and GE2.
            scores.captions.GE1 = scores.captions.GE / 2;
            scores.captions.GE2 = scores.captions.GE / 2;
            delete scores.captions.GE; // Remove the temporary combined score

            scoresData.push(scores);
        });

        if (scoresData.length === 0) {
            console.log('No scores found. The scraper selectors might need an update.');
            return;
        }

        console.log(`Successfully scraped recap for ${scoresData.length} corps. Publishing to Pub/Sub.`);
        
        const eventName = $('h1.page-title').text().trim() || "DCI Recap Event";
        const dataBuffer = Buffer.from(JSON.stringify({ scores: scoresData, eventName: eventName }));

        await pubsubClient.topic('dci-scores-topic').publishMessage({ data: dataBuffer });

    } catch (error) {
        console.error('Error during recap scraping or publishing:', error);
    }
});

/**
 * Triggered by a message on the 'dci-scores-topic'. This function calculates
 * and saves fantasy scores for all active players based on the scraped recap data.
 * (Updated to Firebase Functions v2 syntax)
 */
exports.processDciScores = onMessagePublished('dci-scores-topic', async (message) => {
    console.log("Received new scores to process.");

    try {
        // 1. PARSE THE INCOMING SCORE DATA
        // The data from the scraper is a base64 encoded buffer.
        const payloadBuffer = Buffer.from(message.data.message.data, 'base64').toString('utf-8');
        const { eventName, scores } = JSON.parse(payloadBuffer);

        if (!scores || scores.length === 0) {
            console.log("Payload contained no scores. Exiting function.");
            return;
        }

        // Create a quick lookup map for scores for efficient access.
        const scoreMap = new Map();
        scores.forEach(s => scoreMap.set(s.corps, s));
        
        // 2. GET ALL ACTIVE PLAYERS
        const seasonSettingsRef = db.doc('game-settings/season');
        const seasonDoc = await seasonSettingsRef.get();
        if (!seasonDoc.exists) {
            console.error("Cannot process scores: No active season found.");
            return;
        }
        const activeSeasonId = seasonDoc.id;

        const profileCollection = db.collectionGroup('profile').where('activeSeasonId', '==', activeSeasonId);
        const playersSnapshot = await profileCollection.get();

        if (playersSnapshot.empty) {
            console.log("No active players in this season to score.");
            return;
        }
        
        console.log(`Found ${playersSnapshot.size} players to score for event: ${eventName}.`);
        
        // 3. CALCULATE FANTASY SCORE FOR EACH PLAYER
        const promises = [];
        playersSnapshot.forEach(playerDoc => {
            const playerData = playerDoc.data();
            const playerLineup = playerData.lineup;

            if (!playerLineup) return; 

            let fantasyScore = 0;
            
            for (const caption in playerLineup) {
                const selectedCorps = playerLineup[caption];
                const corpsScores = scoreMap.get(selectedCorps);
                
                if (corpsScores && corpsScores.captions[caption]) {
                    fantasyScore += corpsScores.captions[caption];
                }
            }

            // 4. SAVE THE SCORE TO THE DATABASE
            const promise = db.runTransaction(async (transaction) => {
                const playerProfileRef = playerDoc.ref;
                const freshPlayerDoc = await transaction.get(playerProfileRef);
                const freshPlayerData = freshPlayerDoc.data();

                const seasons = freshPlayerData.seasons || [];
                const seasonIndex = seasons.findIndex(s => s.name === seasonDoc.data().name);

                const newEvent = {
                    eventName: eventName,
                    score: parseFloat(fantasyScore.toFixed(3)),
                    date: new Date() 
                };
                
                if (seasonIndex > -1) {
                    seasons[seasonIndex].events = [...(seasons[seasonIndex].events || []), newEvent];
                } else {
                    seasons.push({
                        name: seasonDoc.data().name,
                        showTitle: "New Season",
                        repertoire: "TBD",
                        type: seasonDoc.data().status.startsWith('live') ? 'Live' : 'Off',
                        events: [newEvent]
                    });
                }
                
                const newTotalScore = (freshPlayerData.totalSeasonScore || 0) + newEvent.score;
                
                transaction.update(playerProfileRef, {
                    seasons: seasons,
                    totalSeasonScore: newTotalScore
                });
            });

            promises.push(promise);
        });

        await Promise.all(promises);
        console.log("Successfully processed and saved scores for all players.");

    } catch (error) {
        console.error("Error processing scores:", error);
    }
});

/**
 * Calculates all dates for a new LIVE season and updates the game settings.
 * A live season is 10 weeks long.
 */
async function startNewLiveSeason() {
    const today = new Date();
    const year = today.getFullYear();

    // DCI Finals are consistently the second Saturday in August. Let's calculate that.
    const augustFirst = new Date(year, 7, 1); // 7 = August
    const dayOfWeek = augustFirst.getDay(); // 0=Sun, 6=Sat
    // Days to get to the first Saturday
    const daysToAdd = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
    const firstSaturday = new Date(augustFirst.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    const finalsDate = new Date(firstSaturday.getTime() + 7 * 24 * 60 * 60 * 1000); // Second Saturday

    // Season is 10 weeks long
    const startDate = new Date(finalsDate.getTime() - 70 * 24 * 60 * 60 * 1000); // 10 weeks * 7 days

    const newSeasonData = {
        name: `DCI ${year} Live Season`,
        status: 'live-season',
        seasonYear: year,
        currentPointCap: 150, // Or fetch this from another settings doc
        schedule: {
            startDate: startDate,
            endDate: finalsDate,
            openTradeEndDate: new Date(`${year}-07-01T23:59:59-04:00`),
            quartersDate: new Date(new Date(finalsDate).setDate(finalsDate.getDate() - 2)),
            semifinalsDate: new Date(new Date(finalsDate).setDate(finalsDate.getDate() - 1)),
            finalsDate: finalsDate,
        }
    };
    
    // TODO: Add logic here to generate the corpsData for the live season.
    // This would likely read from your `final_rankings` collection for the PREVIOUS year.

    await db.doc('game-settings/season').set(newSeasonData);
    console.log(`Successfully started the ${newSeasonData.name}.`);
}

/**
 * Calculates all dates for a new OFF-SEASON and updates the game settings.
 * An off-season is 7 weeks long.
 */
async function startNewOffSeason() {
    const startDate = new Date();
    // Off-season is 7 weeks long
    const endDate = new Date(startDate.getTime() + 49 * 24 * 60 * 60 * 1000); // 7 weeks * 7 days

    const newSeasonData = {
        name: `Off-Season ${startDate.toLocaleString('default', { month: 'long' })} ${startDate.getFullYear()}`,
        status: 'off-season',
        currentPointCap: 150,
        schedule: {
            startDate: startDate,
            endDate: endDate
            // Off-seasons may have simpler trade rules, so fewer dates are needed
        }
    };

    // TODO: Add your logic to generate random corpsData for the off-season.
    // This is where you'd use the logic from `startNewOffSeason` that was triggered
    // from your admin panel, likely using the `final_rankings` data.

    await db.doc('game-settings/season').set(newSeasonData);
    console.log(`Successfully started the ${newSeasonData.name}.`);
}