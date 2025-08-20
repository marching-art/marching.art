const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const crypto = require("crypto");
const axios = require("axios");
const cheerio = require("cheerio");

admin.initializeApp();
const db = admin.firestore();

const corsOptions = {
  cors: ["https://www.marching.art", "https://marching.art", /marching-art.*\.vercel\.app$/, "http://localhost:3000"],
};

// --- Helper function to scrape a single day (for live season) ---
const scrapeDciScoresForDate = async (dateString) => {
    const url = `https://www.dci.org/scores/recap/${dateString}`;
    console.log(`Scraping: ${url}`);
    let dailyScores = {};

    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        
        $("div.recap div.corps-scores").each((j, corpsElem) => {
            const corpsName = $(corpsElem).find("a.corps-name").text().trim();
            if (!corpsName) return;

            const finalScore = parseFloat($(corpsElem).find("span.final-score").text().trim());
            const captions = {};
            
            $(corpsElem).find("table.caption-scores tr").each((k, rowElem) => {
                const captionNameRaw = $(rowElem).find("th").text().trim();
                // Normalize caption names from scraper
                let captionName = null;
                if (captionNameRaw.toLowerCase().includes('general effect')) captionName = captionNameRaw.replace(/\s/g, '');
                if (captionNameRaw.toLowerCase().includes('visual')) captionName = captionNameRaw.replace(/\s/g, '');
                if (captionNameRaw.toLowerCase().includes('music')) captionName = captionNameRaw.replace(/\s/g, '');
                if (captionNameRaw.toLowerCase() === 'brass') captionName = 'B';
                if (captionNameRaw.toLowerCase() === 'percussion') captionName = 'P';
                if (captionNameRaw.toLowerCase() === 'color guard') captionName = 'CG';


                const scores = [];
                $(rowElem).find("td.score").each((l, scoreElem) => {
                    scores.push(parseFloat($(scoreElem).text().trim()));
                });
                if(captionName) {
                    captions[captionName] = scores;
                }
            });

            dailyScores[corpsName] = { finalScore, captions };
        });
    } catch (error) {
        // It's common for some dates to have no scores, so we don't throw an error.
        console.log(`No scores found for ${dateString} or error scraping.`);
    }
    return dailyScores;
};

// --- REFACTORED: Shared Fantasy Point Calculation Logic ---
const calculateAndApplyFantasyScores = async (dailyScores, seasonInfo) => {
    if (!dailyScores || Object.keys(dailyScores).length === 0) {
        console.log("No scores provided to calculate fantasy points.");
        return;
    }

    const usersSnapshot = await db.collectionGroup('profile').get();
    if (usersSnapshot.empty) {
        console.log("No users found to update.");
        return;
    }

    console.log(`Processing scores for ${usersSnapshot.size} users.`);
    const batch = db.batch();

    for (const userDoc of usersSnapshot.docs) {
        const userProfile = userDoc.data();
        const lineup = userProfile.lineup;
        const userRef = userDoc.ref;

        if (!lineup || Object.keys(lineup).length !== 8) {
            continue; // Skip users without a valid lineup
        }

        const getScore = (caption) => {
            const corpsName = lineup[caption];
            const corpsScores = dailyScores[corpsName];
            
            if (!corpsScores || !corpsScores.captions || !corpsScores.captions[caption] || corpsScores.captions[caption].length === 0) {
                return 0;
            }
            const scores = corpsScores.captions[caption];
            return scores.reduce((a, b) => a + b, 0) / scores.length;
        };

        const ge1Score = getScore("GE1");
        const ge2Score = getScore("GE2");
        const vpScore = getScore("VP");
        const vaScore = getScore("VA");
        const cgScore = getScore("CG");
        const bScore = getScore("B");
        const maScore = getScore("MA");
        const pScore = getScore("P");
        
        const totalGe = ge1Score + ge2Score;
        const totalVisual = (vpScore + vaScore + cgScore) / 2;
        const totalMusic = (bScore + maScore + pScore) / 2;
        const finalFantasyScore = totalGe + totalVisual + totalMusic;
        
        // This is where we would update the user's season data.
        // For now, we just log it. In a future step, this will write to a user's season subcollection.
        console.log(`User ${userProfile.username} fantasy score for ${seasonInfo.day}: ${finalFantasyScore.toFixed(3)}`);
    }

    // await batch.commit(); // This will be enabled when we write the scores.
    console.log("Fantasy score calculation complete.");
};


// --- Existing Cloud Functions (Fully Implemented) ---
exports.setUserRole = onCall(corsOptions, async (request) => {
    if (request.auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Request not authorized.');
    }
    const { email, makeAdmin } = request.data;
    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, { admin: makeAdmin });
        return { message: `Success! ${email} has been ${makeAdmin ? 'made' : 'removed as'} an admin.` };
    } catch (err) {
        console.error("Error setting user role:", err);
        throw new HttpsError('internal', 'Error setting user role.');
    }
});

exports.saveSchedule = onCall(corsOptions, async (request) => {
    if (request.auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Request not authorized.');
    }
    const { scheduleId, scheduleData } = request.data;
    if (!scheduleId || !scheduleData) {
        throw new HttpsError('invalid-argument', 'Schedule ID and data must be provided.');
    }
    try {
        await db.collection('schedules').doc(scheduleId).set(scheduleData);
        return { message: 'Schedule saved successfully!' };
    } catch (err) {
        console.error("Error saving schedule:", err);
        throw new HttpsError('internal', 'Failed to save schedule.');
    }
});

exports.saveDciData = onCall(corsOptions, async (request) => {
    if (request.auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Request not authorized.');
    }
    const { year, corpsNames } = request.data;
    const filteredCorps = corpsNames.filter(name => name && name.trim() !== '');
    if (!year || filteredCorps.length === 0) {
        throw new HttpsError('invalid-argument', 'Year and at least one corps name are required.');
    }

    const pointValues = [25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1];
    const corpsValues = filteredCorps.map((corpsName, index) => ({
        corpsName,
        points: pointValues[index] || 1
    }));

    try {
        await db.collection('dci-data').doc(String(year)).set({ corpsValues });
        return { message: `DCI data for ${year} saved successfully!` };
    } catch (err) {
        console.error("Error saving DCI data:", err);
        throw new HttpsError('internal', 'Failed to save DCI data.');
    }
});

exports.saveLineup = onCall(corsOptions, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to save a lineup.');
    }
    const { lineup, totalPoints } = request.data;
    const POINT_CAP = 150;

    if (totalPoints > POINT_CAP) {
        throw new HttpsError('invalid-argument', `Total points (${totalPoints}) exceed the cap of ${POINT_CAP}.`);
    }
    if (Object.keys(lineup).length !== 8 || Object.values(lineup).some(c => !c)) {
        throw new HttpsError('invalid-argument', 'A complete 8-caption lineup is required.');
    }

    try {
        const userDocRef = db.collection('artifacts').doc('marching-art').collection('users').doc(request.auth.uid).collection('profile').doc('data');
        await userDocRef.update({ lineup });
        return { message: 'Lineup saved successfully!' };
    } catch (err) {
        console.error("Error saving lineup:", err);
        throw new HttpsError('internal', 'Failed to save lineup.');
    }
});

exports.scrapeHistoricalData = onCall({ cors: corsOptions, timeoutSeconds: 540 }, async (request) => {
    if (request.auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Request not authorized.');
    }
    // This is a placeholder for the masterParser.js logic. 
    // The masterParser script is more suitable for large, one-time data ingestion.
    // Running this as a cloud function is possible but complex due to file system dependencies.
    console.log("scrapeHistoricalData function called. Note: This is a placeholder.");
    return { message: "This function is a placeholder. Please use the `masterParser.js` script for bulk data ingestion." };
});


// --- NEW: Callable function for Admin to save off-season settings ---
exports.saveOffSeasonSettings = onCall(corsOptions, async (request) => {
    if (request.auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Request not authorized.');
    }
    const { historicalYear, status } = request.data;
    if (!historicalYear || !status) {
        throw new HttpsError('invalid-argument', 'A historical year and status must be provided.');
    }

    try {
        const settingsRef = db.collection('game-settings').doc('off-season');
        const settingsData = {
            historicalYear: String(historicalYear),
            status: status, // 'active' or 'inactive'
            updatedAt: new Date(),
        };
        if (status === 'active') {
            settingsData.startDate = new Date();
        }
        await settingsRef.set(settingsData, { merge: true });
        return { message: `Off-season settings saved. Year: ${historicalYear}, Status: ${status}.` };
    } catch (err) {
        console.error("Error saving off-season settings:", err);
        throw new HttpsError('internal', 'Failed to save off-season settings.');
    }
});


// --- SCHEDULED LIVE GAME ENGINE (runs during DCI season) ---
exports.runLiveGameLoop = onSchedule({schedule: "every day 02:00", timeZone: "America/New_York"}, async (event) => {
    console.log("Starting the daily LIVE game loop...");
    const offSeasonSettings = (await db.collection('game-settings').doc('off-season').get()).data();
    if (offSeasonSettings && offSeasonSettings.status === 'active') {
        console.log("Off-season is active. Skipping live game loop.");
        return null;
    }

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateString = `${yesterday.getFullYear()}-${(yesterday.getMonth() + 1).toString().padStart(2, '0')}-${yesterday.getDate().toString().padStart(2, '0')}`;

    const dailyScores = await scrapeDciScoresForDate(dateString);

    if (Object.keys(dailyScores).length > 0) {
        await calculateAndApplyFantasyScores(dailyScores, { type: 'live', day: dateString });
    } else {
         console.log(`No live scores found for ${dateString}.`);
    }
    return null;
});


// --- NEW: SCHEDULED OFF-SEASON GAME ENGINE ---
exports.runOffSeasonGameLoop = onSchedule({schedule: "every day 02:05", timeZone: "America/New_York"}, async (event) => {
    console.log("Starting the daily OFF-SEASON game loop...");
    const settingsRef = db.collection('game-settings').doc('off-season');
    const settingsDoc = await settingsRef.get();

    if (!settingsDoc.exists || settingsDoc.data().status !== 'active') {
        console.log("Off-season is not active. Exiting.");
        return null;
    }

    const settings = settingsDoc.data();
    const { historicalYear, startDate } = settings;

    const now = new Date();
    const start = startDate.toDate();
    const diffTime = Math.abs(now - start);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // Day 1 is the first day
    const currentOffSeasonDay = diffDays;

    console.log(`Off-season day ${currentOffSeasonDay} for historical year ${historicalYear}.`);

    const historicalScoresRef = db.collection('historical_scores').doc(String(historicalYear));
    const doc = await historicalScoresRef.get();

    if (!doc.exists) {
        console.log(`No historical score data found for year ${historicalYear}.`);
        return null;
    }

    const allEventsForYear = doc.data().data;
    const todaysEvents = allEventsForYear.filter(e => e.offSeasonDay === currentOffSeasonDay);

    if (todaysEvents.length === 0) {
        console.log(`No historical events found for off-season day ${currentOffSeasonDay}.`);
        return null;
    }

    const combinedDailyScores = {};
    todaysEvents.forEach(event => {
        console.log(`Processing event: ${event.eventName || event.location}`);
        event.scores.forEach(corpsScore => {
            combinedDailyScores[corpsScore.corps] = {
                finalScore: corpsScore.score,
                captions: corpsScore.captions
            };
        });
    });

    await calculateAndApplyFantasyScores(combinedDailyScores, { type: 'off-season', day: currentOffSeasonDay });
    return null;
});
