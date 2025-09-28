const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * Updates a user's corps name and alias.
 */
exports.updateCorpsInfo = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { corpsName, alias } = data;
  const uid = context.auth.uid;

  if (!corpsName || !alias || corpsName.length > 50 || alias.length > 20) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid data provided.");
  }

  const profileRef = admin.firestore().doc(`artifacts/marching-art/users/${uid}/profile/data`);

  try {
    await profileRef.update({
      "corps.corpsName": corpsName,
      "corps.alias": alias,
    });
    return { success: true, message: "Corps info updated successfully!" };
  } catch (error) {
    console.error("Error updating corps info for user:", uid, error);
    throw new functions.https.HttpsError("internal", "An error occurred while saving.");
  }
});