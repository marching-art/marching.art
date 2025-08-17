const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const crypto = require("crypto");
const axios = require("axios");
const cheerio = require("cheerio");

admin.initializeApp();
const db = admin.firestore();

exports.setUserRole = onCall(async (request) => {
  // Security Check: Ensure the user calling the function is an admin.
  if (request.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Request not authorized. User must be an admin.');
  }

  const email = request.data.email;
  const makeAdmin = request.data.makeAdmin; // This will be true or false

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      admin: makeAdmin,
    });
    return {
      message: `Success! ${email} has been ${makeAdmin ? "made" : "removed as"} an admin.`,
    };
  } catch (err) {
    console.error(err);
    throw new HttpsError('internal', err.message);
  }
});

exports.saveSchedule = onCall(async (request) => {
  // Security Check
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
    console.error("Error saving schedule:", err);
    throw new HttpsError('internal', 'Failed to save schedule.');
  }
});

exports.saveDciData = onCall(async (request) => {
    // Security Check
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
        console.error("Error saving DCI data:", err);
        throw new HttpsError('internal', 'Failed to save DCI data.');
    }
});

exports.saveLineup = onCall(async (request) => {
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

exports.scrapeHistoricalData = onCall(async (request) => {
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
    const month = (yesterday.getMonth() + 1).toString().padStart(2, '0');
    const day = yesterday.getDate().toString().padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    const url = `https://www.dci.org/scores/recap/${dateString}`;

    console.log(`Checking for scores from: ${url}`);
    
    let dailyScores = {};

    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        
        $("div.recap div.corps-scores").each((j, corpsElem) => {
            const corpsName = $(corpsElem).find("a.corps-name").text().trim();
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
            dailyScores[corpsName] = captions;
        });
        console.log(`Successfully scraped scores for ${Object.keys(dailyScores).length} corps.`);
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.log(`No DCI scores page found for ${dateString}.`);
        } else {
            console.error("Error scraping scores:", error);
        }
    }

    // --- Calculate Fantasy Points and Update Users ---
    if (Object.keys(dailyScores).length === 0) {
        console.log("No scores to process. Ending game loop.");
        return null;
    }

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
            continue; // Skip users without a valid lineup
        }

        const getScore = (caption) => {
            const corpsName = lineup[caption];
            const corpsScores = dailyScores[corpsName];
            if (!corpsScores || !corpsScores[caption] || corpsScores[caption].length === 0) {
                // TODO: Implement trend-analysis for missing scores
                return 0; 
            }
            // Average the scores from all judges for that caption
            const scores = corpsScores[caption];
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
        
        const totalGe = ge1Score + ge2Score; // Max 40
        const totalVisual = (vpScore + vaScore + cgScore) / 2; // Max 30
        const totalMusic = (bScore + maScore + pScore) / 2; // Max 30
        const finalFantasyScore = totalGe + totalVisual + totalMusic;

        // TODO: Update user's season data with the new score
        console.log(`User ${userProfile.username} score: ${finalFantasyScore.toFixed(3)}`);
    }

    // await batch.commit(); // In a future step, we'll save the updates
    console.log("Fantasy score calculation complete.");
    return null;
});