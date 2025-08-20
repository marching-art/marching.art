const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

admin.initializeApp();
const db = admin.firestore();

const corsOptions = {
  cors: ["https://www.marching.art", "https://marching.art", /marching-art.*\.vercel\.app$/, "http://localhost:3000"],
};

// --- NEW: Off-Season Generation and Simulation Logic ---

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

/**
 * Callable function triggered by an admin to set up and start a new off-season.
 */
exports.startNewOffSeason = onCall(corsOptions, async (request) => {
    if (request.auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Request not authorized.');
    }

    console.log("Starting new off-season setup...");
    const batch = db.batch();

    // --- Step 1: Select 25 Random Corps for the Season ---
    const rankingsSnapshot = await db.collection('final_rankings').get();
    if (rankingsSnapshot.empty) {
        throw new HttpsError('not-found', 'No final_rankings data available to generate corps list.');
    }
    const allCorpsSet = new Set();
    rankingsSnapshot.forEach(doc => {
        const yearData = doc.data().data || [];
        yearData.forEach(item => allCorpsSet.add(item.corps));
    });

    if (allCorpsSet.size < 25) {
        throw new HttpsError('failed-precondition', `Not enough unique corps (${allCorpsSet.size}) to start a season. Need at least 25.`);
    }
    
    const selectedCorps = shuffleArray(Array.from(allCorpsSet)).slice(0, 25);
    const offSeasonCorpsRef = db.collection('game-settings').doc('off-season-corps');
    batch.set(offSeasonCorpsRef, { corps: selectedCorps, createdAt: new Date() });
    console.log("Selected 25 corps for the off-season:", selectedCorps);

    // --- Step 2: Generate the 49-Day Schedule ---
    const scoresSnapshot = await db.collection('historical_scores').get();
    if (scoresSnapshot.empty) {
        throw new HttpsError('not-found', 'No historical_scores data available to generate a schedule.');
    }

    const locationPool = new Map();
    scoresSnapshot.forEach(doc => {
        const yearData = doc.data().data || [];
        yearData.forEach(event => {
            if (event.location && event.offSeasonDay) {
                // Use a Set to store multiple days for the same location
                if (!locationPool.has(event.location)) {
                    locationPool.set(event.location, new Set());
                }
                locationPool.get(event.location).add(event.offSeasonDay);
            }
        });
    });

    // --- Define fixed locations for special events ---
    const fixedLocations = {
        28: { name: "Southwestern Championship", location: "San Antonio, Texas" },
        35: { name: "DCI Atlanta Southeastern Championship", location: "Atlanta, Georgia" }, // Example for one of the two shows
        41: { name: "DCI Eastern Classic", location: "Allentown, Pennsylvania" },
        42: { name: "DCI Eastern Classic", location: "Allentown, Pennsylvania" },
    };
    
    // Remove fixed locations from the general pool to avoid duplicates
    Object.values(fixedLocations).forEach(l => locationPool.delete(l.location));

    // Find a unique location for championships weekend (days 47-49)
    const champLocationCandidates = Array.from(locationPool.keys());
    const shuffledChampCandidates = shuffleArray(champLocationCandidates);
    const champsLocation = shuffledChampCandidates.pop() || "Indianapolis, Indiana"; // Fallback
    locationPool.delete(champsLocation); // Ensure it's not used elsewhere

    const schedule = [];
    const usedLocations = new Set(Object.values(fixedLocations).map(l => l.location));
    usedLocations.add(champsLocation);

    const regularLocations = shuffleArray(Array.from(locationPool.keys()));

    for (let day = 1; day <= 49; day++) {
        if (fixedLocations[day]) {
            schedule.push({ day, ...fixedLocations[day], type: 'Regional' });
        } else if (day >= 47) {
            const eventType = { 47: 'Prelims', 48: 'Semi-Finals', 49: 'Finals' };
            schedule.push({ day, name: `DCI World Championship ${eventType[day]}`, location: champsLocation, type: 'Championship' });
        } else {
            let location = regularLocations.pop() || "TBD";
            schedule.push({ day, name: `DCI Tour Event`, location, type: 'Standard' });
        }
    }
    
    const scheduleRef = db.collection('schedules').doc('current-off-season');
    batch.set(scheduleRef, { schedule, createdAt: new Date() });
    console.log("Generated 49-day schedule.");

    // --- Step 3: Activate the Off-Season ---
    const seasonSettingsRef = db.collection('game-settings').doc('season');
    batch.set(seasonSettingsRef, {
        status: 'off-season',
        startDate: new Date(),
        seasonId: `off-season-${new Date().getFullYear()}`
    });
    console.log("Off-season is now active.");

    await batch.commit();
    return { message: `Successfully started new off-season with 25 corps and a 49-day schedule.` };
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

    const { startDate } = seasonDoc.data();
    const now = new Date();
    const start = startDate.toDate();
    const diffTime = Math.abs(now - start);
    const currentOffSeasonDay = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    console.log(`Running simulation for off-season day ${currentOffSeasonDay}.`);

    // In a full implementation, we would get user schedules and simulate scores here.
    // For now, we log the action. The logic for Prelims/Semis/Finals would be complex.
    
    // Example of what would happen:
    // 1. Get the generated schedule for `currentOffSeasonDay`.
    // 2. Get all users who have scheduled their corps for today's event(s).
    // 3. For each competing corps, find a relevant historical score from `historical_scores`.
    // 4. Calculate fantasy points using a shared function.
    // 5. On day 47, calculate all scores and save top 25 to a temp doc.
    // 6. On day 48, only use corps from the temp doc, save top 12.
    // 7. On day 49, only use top 12.
    // 8. After day 49, set season status to 'complete' or 'pending'.

    console.log(`Simulation logic for day ${currentOffSeasonDay} would run here.`);
    
    return null;
});

// --- Other Functions (setUserRole, saveLineup, etc.) ---
// These functions remain the same as your existing file.
// I am including them here to provide a complete, non-redacted file.

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
        const userDocRef = doc(db, 'artifacts', 'marching-art', 'users', request.auth.uid, 'profile', 'data');
        await userDocRef.update({ lineup });
        return { message: 'Lineup saved successfully!' };
    } catch (err) {
        console.error("Error saving lineup:", err);
        throw new HttpsError('internal', 'Failed to save lineup.');
    }
});
