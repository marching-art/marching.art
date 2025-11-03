const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb, dataNamespace } = require("../config"); // Assuming config.js exports these
const admin = require("firebase-admin");

// Basic profanity filter (replace with a more robust one later)
const isProfane = (text) => /fuck|shit|damn/.test(text.toLowerCase());

exports.registerCorps = onCall(async (request) => {
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
  const profileDocRef = db.doc(`artifacts/${dataNamespace}/users/${uid}/profile/data`);

  try {
    const profileDoc = await profileDocRef.get();
    if (!profileDoc.exists) {
      throw new HttpsError("not-found", "User profile does not exist.");
    }
    
    const profileData = profileDoc.data();
    
    // --- 2. Check Unlocked Classes ---
    const unlockedClasses = profileData.unlockedClasses || ['soundSport'];
    if (!unlockedClasses.includes(corpsClass)) {
      throw new HttpsError("permission-denied", `You have not unlocked the ${corpsClass} class.`);
    }

    // --- 3. Check if corps already exists for this class ---
    if (profileData.corps && profileData.corps[corpsClass]) {
      throw new HttpsError("already-exists", `You already have a corps in the ${corpsClass} class.`);
    }

    // --- 4. Create New Corps Data ---
    const newCorpsData = {
      corpsName,
      location,
      showConcept, // Initial concept
      class: corpsClass,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lineup: {},
      selectedShows: {},
      totalSeasonScore: 0,
      // Your plan implies bio carries over, so we set it here
      biography: `The ${corpsName} from ${location}.`, 
    };

    // --- 5. Write to DB ---
    await profileDocRef.update({
      [`corps.${corpsClass}`]: newCorpsData
    });

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