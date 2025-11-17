const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
// Use dataNamespaceParam to match your other files
const { getDb, dataNamespaceParam } = require("../config"); 
const admin = require("firebase-admin");

const isProfane = (text) => /fuck|shit|damn/.test(text.toLowerCase());

exports.registerCorps = onCall({ cors: true }, async (request) => {
  const { corpsName, location, showConcept, class: corpsClass } = request.data;
  const uid = request.auth?.uid;

  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be logged in to register a corps.");
  }

  // --- 1. Validation ---
  if (!corpsName || !location || !showConcept || !corpsClass) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }
  if (corpsName.length > 50 || location.length > 50 || showConcept.length > 500) {
    throw new HttpsError("invalid-argument", "Input field exceeds length limit.");
  }
  if (isProfane(corpsName) || isProfane(location) || isProfane(showConcept)) {
    throw new HttpsError("invalid-argument", "Profane language is not allowed.");
  }

  const db = getDb();
  // Use dataNamespaceParam.value()
  const profileDocRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const profileDoc = await profileDocRef.get();
    if (!profileDoc.exists) {
      throw new HttpsError("not-found", "User profile does not exist.");
    }

    const profileData = profileDoc.data();

    // --- 2. Check Registration Locks Based on Weeks Remaining ---
    const seasonDoc = await db.doc("game-settings/season").get();
    if (seasonDoc.exists) {
      const seasonData = seasonDoc.data();
      const now = new Date();
      const endDate = seasonData.schedule?.endDate?.toDate();

      if (endDate) {
        const millisRemaining = endDate.getTime() - now.getTime();
        const weeksRemaining = Math.ceil(millisRemaining / (7 * 24 * 60 * 60 * 1000));

        const registrationLocks = {
          world: 6,
          open: 5,
          aClass: 4,
          soundSport: 0, // No lock
        };

        const lockWeeks = registrationLocks[corpsClass] || 0;
        if (weeksRemaining < lockWeeks) {
          throw new HttpsError(
            "failed-precondition",
            `Registration for ${corpsClass} is closed (locks at ${lockWeeks} weeks remaining, currently ${weeksRemaining} weeks left).`
          );
        }
      }
    }

    // --- 3. Check Unlocked Classes ---
    const unlockedClasses = profileData.unlockedClasses || ['soundSport'];
    if (!unlockedClasses.includes(corpsClass)) {
      throw new HttpsError("permission-denied", `You have not unlocked the ${corpsClass} class.`);
    }

    // --- 4. Check if corps already exists for this class ---
    if (profileData.corps && profileData.corps[corpsClass]) {
      throw new HttpsError("already-exists", `You already have a corps in the ${corpsClass} class.`);
    }

    // --- 5. Create New Corps Data ---
    const newCorpsData = {
      corpsName,
      location,
      showConcept,
      class: corpsClass,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lineup: {},
      selectedShows: {},
      totalSeasonScore: 0,
      biography: `The ${corpsName} from ${location}.`,
    };

    // --- 6. Set activeSeasonId if not already set ---
    const updateData = {
      [`corps.${corpsClass}`]: newCorpsData
    };

    // Set activeSeasonId when registering first corps for this season
    if (!profileData.activeSeasonId && seasonDoc.exists()) {
      const seasonData = seasonDoc.data();
      if (seasonData.seasonUid) {
        updateData.activeSeasonId = seasonData.seasonUid;
        logger.info(`Setting activeSeasonId for user ${uid} to ${seasonData.seasonUid}`);
      }
    }

    // --- 7. Write to DB ---
    await profileDocRef.update(updateData);

    logger.info(`User ${uid} successfully registered ${corpsName} (${corpsClass}).`);
    return { success: true, message: "Corps registered!" };

  } catch (error) {
    logger.error(`Error registering corps for user ${uid}:`, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An error occurred while registering your corps.");
  }
});