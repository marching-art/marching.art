const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
// Use dataNamespaceParam to match your other files
const { getDb, dataNamespaceParam } = require("../config");

exports.saveShowConcept = onCall({ cors: true }, async (request) => {
  const { concept, corpsClass } = request.data;
  const uid = request.auth?.uid;

  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  if (!concept || !corpsClass) {
    throw new HttpsError("invalid-argument", "Missing concept or corps class.");
  }

  // Validate description length
  if (concept.description && concept.description.length > 500) {
    throw new HttpsError("invalid-argument", "Show concept description exceeds 500 characters.");
  }

  const db = getDb();
  // Use dataNamespaceParam.value()
  const profileDocRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    // Save to profile
    await profileDocRef.update({
      [`corps.${corpsClass}.showConcept`]: concept
    });

    logger.info(`User ${uid} saved new show concept for ${corpsClass}.`);
    return { success: true };

  } catch (error) {
    logger.error(`Error saving show concept for user ${uid}:`, error);
    throw new HttpsError("internal", "An error occurred while saving your show concept.");
  }
});