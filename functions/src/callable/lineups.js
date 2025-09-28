const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * Saves a user's lineup by updating the 'lineup' map in their main profile document.
 */
exports.saveLineup = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { seasonId, lineup } = data;
  const uid = context.auth.uid;

  if (!seasonId || !lineup || Object.keys(lineup).length !== 8) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid data provided.");
  }

  // Correct path to the user's main profile document
  const profileRef = admin.firestore().doc(`artifacts/marching-art/users/${uid}/profile/data`);
  
  try {
    // Update the 'lineup' field and 'activeSeasonId' within the existing document
    await profileRef.update({
      lineup: lineup,
      activeSeasonId: seasonId, // Set the active season when the lineup is saved
      "corps.lastEdit": admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, message: "Lineup saved successfully!" };
  } catch (error) {
    console.error("Error updating lineup for user:", uid, error);
    throw new functions.https.HttpsError("internal", "An error occurred while saving.");
  }
});