const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

admin.initializeApp();
const db = admin.firestore();

// --- Helper Functions ---

/**
 * Shuffles an array in place.
 * @param {Array} array The array to shuffle.
 * @returns {Array} The shuffled array.
 */
const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};


// --- Main Off-Season Generation Function ---

/**
 * Callable function triggered by an admin to set up and start a new off-season.
 * This function now includes the correct tiered random selection logic.
 */
exports.startNewOffSeason = onCall({ cors: true }, async (request) => {
    // 1. --- AUTHENTICATION ---
    if (request.auth?.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Request not authorized. You must be an admin.');
    }

    console.log("Starting new off-season setup...");

    try {
        // 2. --- FETCH LATEST RANKINGS ---
        const rankingsSnapshot = await db.collection('final_rankings')
            .orderBy(admin.firestore.FieldPath.documentId(), "desc")
            .limit(1)
            .get();

        if (rankingsSnapshot.empty) {
            throw new HttpsError('not-found', 'No final_rankings data available to generate corps list.');
        }
        const latestRankingsDoc = rankingsSnapshot.docs[0];
        const rankingsData = latestRankingsDoc.data().data || [];
        const sourceYear = latestRankingsDoc.id;
        console.log(`Using rankings from ${sourceYear} as the source.`);

        // 3. --- GROUP CORPS BY POINTS (TIERED BUCKETS) ---
        const corpsByPoints = {};
        rankingsData.forEach((corps) => {
            const points = corps.points;
            if (points) {
                if (!corpsByPoints[points]) {
                    corpsByPoints[points] = [];
                }
                corpsByPoints[points].push(corps.corps);
            }
        });
        console.log(`Grouped corps into ${Object.keys(corpsByPoints).length} point tiers.`);

        // 4. --- TIERED RANDOM SELECTION ---
        const offSeasonCorpsSelection = [];
        for (const points in corpsByPoints) {
            const pointValue = parseInt(points, 10);
            const corpsInBucket = corpsByPoints[points];
            const selectedCorps = shuffleArray(corpsInBucket)[0]; // Shuffle and pick the first one
            
            offSeasonCorpsSelection.push({
                corpsName: selectedCorps,
                points: pointValue,
            });
        }
        console.log(`Randomly selected ${offSeasonCorpsSelection.length} corps for the off-season.`);

        // 5. --- CREATE NEW SEASON DATA DOCUMENT ---
        const date = new Date();
        const dataDocId = `off-season-${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        
        const dciDataRef = db.collection('dci-data').doc(dataDocId);
        await dciDataRef.set({
            corpsValues: offSeasonCorpsSelection,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            source: `final_rankings/${sourceYear}`,
        });
        console.log(`Created new data document: dci-data/${dataDocId}`);

        // 6. --- UPDATE GLOBAL SEASON SETTINGS ---
        const seasonSettingsRef = db.collection('game-settings').doc('season');
        await seasonSettingsRef.set({
            status: 'off-season',
            name: `Off-Season ${date.toLocaleString("default", { month: "long" })} ${date.getFullYear()}`,
            dataDocId: dataDocId,
            currentPointCap: 150, // Default point cap
            seasonYear: date.getFullYear(), // Store the year for reference
        });
        console.log("Global season settings updated. Off-season is now active.");

        return { message: `Successfully started new Off-Season! Data generated from ${sourceYear} rankings.` };

    } catch (error) {
        console.error("Error starting new off-season:", error);
        if (error instanceof HttpsError) {
            throw error; // Re-throw HttpsError
        }
        throw new HttpsError('internal', 'An unexpected error occurred while starting the off-season.');
    }
});


/**
 * The main off-season game loop, runs daily.
 */
exports.runOffSeasonGameLoop = onSchedule({schedule: "every day 02:05", timeZone: "America/New_York"}, async (event) => {
    console.log("Starting the daily OFF-SEASON game loop...");
    const seasonDoc = await db.collection('game-settings').doc('season').get();

    if (!seasonDoc.exists || seasonDoc.data().status !== 'off-season') {
        console.log("Off-season is not active. Exiting.");
        return null;
    }
    // ... [Your existing game loop logic remains here] ...
    console.log(`Simulation logic would run here.`);
    
    return null;
});

// --- Other Utility Functions ---

exports.setUserRole = onCall({ cors: true }, async (request) => {
    if (request.auth?.token.admin !== true) {
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

exports.saveLineup = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to save a lineup.');
    }
    const { lineup, totalPoints, appId } = request.data;
    const POINT_CAP = 150;
    const finalAppId = appId || 'marching-art';

    if (totalPoints > POINT_CAP) {
        throw new HttpsError('invalid-argument', `Total points (${totalPoints}) exceed the cap of ${POINT_CAP}.`);
    }
    if (Object.keys(lineup).length !== 8 || Object.values(lineup).some(c => !c)) {
        throw new HttpsError('invalid-argument', 'A complete 8-caption lineup is required.');
    }

    try {
        const userDocRef = db.doc(`artifacts/${finalAppId}/users/${request.auth.uid}/profile/data`);
        await userDocRef.update({ lineup });
        return { message: 'Lineup saved successfully!' };
    } catch (err) {
        console.error("Error saving lineup:", err);
        throw new HttpsError('internal', 'Failed to save lineup.');
    }
});
