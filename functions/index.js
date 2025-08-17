const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const crypto = require("crypto");
const axios = require("axios");
const cheerio = require("cheerio");

admin.initializeApp();
const db = admin.firestore();

// CORS configuration to allow requests from your web app
const corsOptions = {
  cors: ["https://www.marching.art", "https://marching.art", /marching-art.*\.vercel\.app$/, "http://localhost:3000"],
};

// Helper function to scrape a single day
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
                const captionName = $(rowElem).find("th").text().trim();
                const scores = [];
                $(rowElem).find("td").each((l, cellElem) => {
                    const score = parseFloat($(cellElem).text().trim());
                    if (!isNaN(score)) scores.push(score);
                });
                
                if (scores.length > 0) {
                    if(captionName.includes("General Effect 1")) captions.GE1 = scores;
                    if(captionName.includes("General Effect 2")) captions.GE2 = scores;
                    if(captionName.includes("Visual Prof")) captions.VP = scores;
                    if(captionName.includes("Visual Analysis")) captions.VA = scores;
                    if(captionName.includes("Color Guard")) captions.CG = scores;
                    if(captionName.includes("Brass")) captions.B = scores;
                    if(captionName.includes("Music Analysis")) captions.MA = (captions.MA || []).concat(scores);
                    if(captionName.includes("Percussion")) captions.P = (captions.P || []).concat(scores);
                }
            });
            dailyScores[corpsName] = { finalScore, captions };
        });
        return dailyScores;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            // This is expected for days with no shows
        } else {
            console.error(`Error scraping scores for ${dateString}:`, error);
        }
        return {};
    }
};


exports.setUserRole = onCall(corsOptions, async (request) => {
  if (request.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Request not authorized.');
  }
  const { email, makeAdmin } = request.data;
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(userRecord.uid, { admin: makeAdmin });
    return { message: `Success! ${email} has been ${makeAdmin ? "made" : "removed as"} an admin.` };
  } catch (err) {
    throw new HttpsError('internal', err.message);
  }
});

exports.saveSchedule = onCall(corsOptions, async (request) => {
  if (request.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Request not authorized.');
  }
  const { scheduleId, scheduleData } = request.data;
  if (!scheduleId || !scheduleData) {
    throw new HttpsError('invalid-argument', 'Invalid data provided.');
  }
  try {
    await db.collection("schedules").doc(scheduleId).set(scheduleData);
    return { message: `Successfully saved schedule: ${scheduleData.name}` };
  } catch (err) {
    throw new HttpsError('internal', 'Failed to save schedule.');
  }
});

exports.saveDciData = onCall(corsOptions, async (request) => {
    if (request.auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Request not authorized.');
    }
    const { year, corpsNames } = request.data;
    if (!year || !corpsNames || corpsNames.length !== 25) {
        throw new HttpsError('invalid-argument', 'A year and 25 corps names are required.');
    }
    const corpsValues = corpsNames.map((name, index) => {
        let points = 25 - index;
        if (name.toLowerCase() === 'genesis') points = 5;
        if (name.toLowerCase() === 'jersey surf') points = 3;
        return { rank: index + 1, corpsName: name, points: points };
    });
    try {
        await db.collection("dci-data").doc(String(year)).set({ year: parseInt(year), corpsValues });
        return { message: `Successfully saved DCI data for ${year}.` };
    } catch (err) {
        throw new HttpsError('internal', 'Failed to save DCI data.');
    }
});

exports.saveLineup = onCall(corsOptions, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in.');
    }
    const uid = request.auth.uid;
    const { lineup, totalPoints } = request.data;
    const appId = 'marching-art';
    if (!lineup || Object.keys(lineup).length !== 8) {
        throw new HttpsError('invalid-argument', 'A lineup must contain 8 captions.');
    }
    const corpsList = Object.values(lineup).sort().join('-');
    const lineupHash = crypto.createHash('md5').update(corpsList).digest('hex');
    const userProfileRef = db.doc(`artifacts/${appId}/users/${uid}/profile/data`);
    const lineupRef = db.doc(`lineups/${lineupHash}`);
    try {
        await db.runTransaction(async (transaction) => {
            const lineupDoc = await transaction.get(lineupRef);
            if (lineupDoc.exists && lineupDoc.data().ownerUid !== uid) {
                throw new HttpsError('already-exists', 'This lineup is already claimed.');
            }
            transaction.set(lineupRef, { ownerUid: uid, claimedAt: new Date() });
            transaction.update(userProfileRef, { lineup: { ...lineup, totalPoints, lastUpdated: new Date() }});
        });
        return { message: "Lineup saved successfully!" };
    } catch (error) {
        if (error.code === 'already-exists') throw error;
        throw new HttpsError('internal', 'An error occurred while saving.');
    }
});

exports.scrapeHistoricalData = onCall(corsOptions, async (request) => {
    if (request.auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Request not authorized.');
    }
    const { year } = request.data;
    if (!year) {
        throw new HttpsError('invalid-argument', 'A year must be provided.');
    }
    console.log(`Starting historical scrape for ${year}...`);
    // TODO: Build the logic to scrape all scores for an entire season from dci.org/scores
    return { message: `Historical scrape for ${year} initiated. (Functionality pending)` };
});


// --- SCHEDULED GAME ENGINE ---
exports.runGameLoop = onSchedule({schedule: "every day 02:00", timeZone: "America/New_York"}, async (event) => {
    console.log("Starting the daily game loop...");
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const dateString = `${year}-${(yesterday.getMonth() + 1).toString().padStart(2, '0')}-${yesterday.getDate().toString().padStart(2, '0')}`;

    const dailyScores = await scrapeDciScoresForDate(dateString);

    if (Object.keys(dailyScores).length > 0) {
        const scoreDocRef = db.collection('dci-data').doc(String(year)).collection('scores').doc(dateString);
        await scoreDocRef.set({ date: dateString, events: [{ eventName: "Scores for this date", results: dailyScores }] });
        console.log(`Successfully scraped and saved scores for ${dateString}.`);
    } else {
         console.log(`No scores found for ${dateString}.`);
    }
    
    // --- Calculate Fantasy Points and Update Users ---
    const usersSnapshot = await db.collectionGroup('profile').get();
    if (usersSnapshot.empty) {
        console.log("No users found to update.");
        return null;
    }

    console.log(`Processing scores for ${usersSnapshot.size} users.`);
    const batch = db.batch();

    for (const userDoc of usersSnapshot.docs) {
        const userProfile = userDoc.data();
        const lineup = userProfile.lineup;

        if (!lineup || Object.keys(lineup).length !== 8) {
            continue;
        }

        const getScore = (caption) => {
            const corpsName = lineup[caption];
            const corpsScores = dailyScores[corpsName];
            if (!corpsScores || !corpsScores.captions[caption] || corpsScores.captions[caption].length === 0) {
                // TODO: Implement trend-analysis for missing scores
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

        // TODO: Update user's season data with the new score
        console.log(`User ${userProfile.username} score: ${finalFantasyScore.toFixed(3)}`);
    }

    // await batch.commit(); // In a future step, we'll save the updates
    console.log("Fantasy score calculation complete.");
    return null;
});
