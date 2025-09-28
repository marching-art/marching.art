const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { DATA_NAMESPACE } = require("../config");

/**
 * Updates a user's corps name and alias.
 * 
 * IMPORTANT: This is a callable function, not an HTTP function.
 * CORS is handled automatically by Firebase for callable functions.
 * The issue is likely in how the function is being called from the frontend.
 */
exports.updateCorpsInfo = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { corpsName, alias } = data;
  const uid = context.auth.uid;

  // Validate input
  if (!corpsName || !alias) {
    throw new functions.https.HttpsError("invalid-argument", "Corps name and alias are required.");
  }

  if (corpsName.length > 50) {
    throw new functions.https.HttpsError("invalid-argument", "Corps name must be 50 characters or less.");
  }

  if (alias.length > 20) {
    throw new functions.https.HttpsError("invalid-argument", "Alias must be 20 characters or less.");
  }

  // Sanitize input
  const sanitizedCorpsName = corpsName.trim();
  const sanitizedAlias = alias.trim();

  if (!sanitizedCorpsName || !sanitizedAlias) {
    throw new functions.https.HttpsError("invalid-argument", "Corps name and alias cannot be empty.");
  }

  try {
    const profileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);

    // Check if profile exists first
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) {
      throw new functions.https.HttpsError("not-found", "User profile not found.");
    }

    // Update the profile
    await profileRef.update({
      "corps.corpsName": sanitizedCorpsName,
      "corps.alias": sanitizedAlias,
      "corps.lastEdit": admin.firestore.FieldValue.serverTimestamp(),
    });

    return { 
      success: true, 
      message: "Corps info updated successfully!",
      corpsName: sanitizedCorpsName,
      alias: sanitizedAlias
    };
  } catch (error) {
    console.error("Error updating corps info for user:", uid, error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError("internal", "An error occurred while saving.");
  }
});

/**
 * Get user profile information
 */
exports.getUserProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const uid = context.auth.uid;

  try {
    const profileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
    const profileSnap = await profileRef.get();

    if (!profileSnap.exists) {
      throw new functions.https.HttpsError("not-found", "User profile not found.");
    }

    const profileData = profileSnap.data();
    
    // Return only necessary profile data (no sensitive information)
    return {
      success: true,
      profile: {
        id: uid,
        corps: profileData.corps,
        displayName: profileData.displayName,
        location: profileData.location,
        xp: profileData.xp,
        level: profileData.level,
        corpsCoin: profileData.corpsCoin,
        unlockedClasses: profileData.unlockedClasses,
        activeSeasonId: profileData.activeSeasonId,
        uniforms: profileData.uniforms,
        stats: profileData.stats
      }
    };
  } catch (error) {
    console.error("Error fetching user profile:", uid, error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError("internal", "An error occurred while fetching profile.");
  }
});

/**
 * Update user location
 */
exports.updateUserLocation = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { location } = data;
  const uid = context.auth.uid;

  if (!location || location.length > 100) {
    throw new functions.https.HttpsError("invalid-argument", "Valid location (max 100 characters) is required.");
  }

  try {
    const profileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
    
    await profileRef.update({
      location: location.trim(),
      lastActive: admin.firestore.FieldValue.serverTimestamp()
    });

    return { 
      success: true, 
      message: "Location updated successfully!",
      location: location.trim()
    };
  } catch (error) {
    console.error("Error updating location for user:", uid, error);
    throw new functions.https.HttpsError("internal", "An error occurred while updating location.");
  }
});