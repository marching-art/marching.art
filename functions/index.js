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

/**
 * Calculates the date of the second Saturday in August for a given year.
 * @param {number} year The year to calculate for.
 * @returns {Date} The date of the second Saturday in August.
 */
const getSecondSaturdayOfAugust = (year) => {
    const augustFirst = new Date(year, 7, 1);
    let firstSaturday = 1;
    // Day of week: 0=Sun, 1=Mon, ..., 6=Sat
    if (augustFirst.getDay() !== 6) {
        firstSaturday = 1 + (6 - augustFirst.getDay());
    }
    // The second Saturday is 7 days after the first.
    return new Date(year, 7, firstSaturday + 7);
};


// --- Automated Master Scheduler ---

/**
 * Runs once a day to check for and manage season transitions automatically.
 */
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
 * Callable function for an admin to manually start a new off-season.
 */
exports.startNewOffSeason = onCall({ cors: true }, async (request) => {
    if (request.auth?.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Request not authorized.');
    }
    console.log("ADMIN ACTION: Manually starting new off-season setup...");
    try {
        const rankingsSnapshot = await db.collection('final_rankings')
            .orderBy(admin.firestore.FieldPath.documentId(), "desc").limit(1).get();
        if (rankingsSnapshot.empty) {
            throw new HttpsError('not-found', 'No final_rankings data available.');
        }
        const latestRankingsDoc = rankingsSnapshot.docs[0];
        const rankingsData = latestRankingsDoc.data().data || [];
        const sourceYear = latestRankingsDoc.id;

        const corpsByPoints = {};
        rankingsData.forEach(corps => {
            if (corps.points) {
                if (!corpsByPoints[corps.points]) corpsByPoints[corps.points] = [];
                corpsByPoints[corps.points].push(corps.corps);
            }
        });

        const offSeasonCorpsSelection = [];
        for (const points in corpsByPoints) {
            const selectedCorps = shuffleArray(corpsByPoints[points])[0];
            offSeasonCorpsSelection.push({ corpsName: selectedCorps, points: parseInt(points, 10) });
        }

        const date = new Date();
        const dataDocId = `off-season-${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        
        await db.collection('dci-data').doc(dataDocId).set({
            corpsValues: offSeasonCorpsSelection,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            source: `final_rankings/${sourceYear}`,
        });

        await db.collection('game-settings').doc('season').set({
            status: 'off-season',
            name: `Off-Season ${date.toLocaleString("default", { month: "long" })} ${date.getFullYear()}`,
            dataDocId: dataDocId,
            currentPointCap: 150,
            seasonYear: date.getFullYear(),
        });

        return { message: `Successfully started new Off-Season from ${sourceYear} rankings.` };
    } catch (error) {
        console.error("Error in startNewOffSeason:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'An unexpected error occurred.');
    }
});

/**
 * Callable function for admins to archive the results of a completed season.
 */
exports.archiveSeasonResults = onCall({ cors: true }, async (request) => {
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
    // ... [Your existing game loop logic remains here] ...
});

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
        throw new HttpsError('internal', 'Error setting user role.');
    }
});

exports.saveLineup = onCall({ cors: true }, async (request) => {
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
