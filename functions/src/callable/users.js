const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { DATA_NAMESPACE } = require("../config");

/**
 * Updates corps information for a user during initial setup
 */
exports.updateCorpsInfo = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { corpsName, alias } = data;
  const uid = context.auth.uid;

  // Validation
  if (!corpsName || !alias) {
    throw new functions.https.HttpsError("invalid-argument", "Corps name and alias are required.");
  }

  if (corpsName.length > 50) {
    throw new functions.https.HttpsError("invalid-argument", "Corps name must be 50 characters or less.");
  }

  if (alias.length > 20) {
    throw new functions.https.HttpsError("invalid-argument", "Alias must be 20 characters or less.");
  }

  try {
    const profileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
    
    // Check if profile exists
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) {
      throw new functions.https.HttpsError("not-found", "User profile not found.");
    }

    // Update corps information
    await profileRef.update({
      "corps.corpsName": corpsName.trim(),
      "corps.alias": alias.trim(),
      "corps.lastEdit": admin.firestore.FieldValue.serverTimestamp()
    });

    return { 
      success: true, 
      message: "Corps information updated successfully!",
      corpsName: corpsName.trim(),
      alias: alias.trim()
    };

  } catch (error) {
    console.error("Error updating corps info for user:", uid, error);
    if (error.code && error.code.startsWith('functions/')) {
      throw error; // Re-throw Firebase function errors
    }
    throw new functions.https.HttpsError("internal", "An error occurred while updating corps info.");
  }
});

/**
 * Updates user profile settings
 */
exports.updateProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { displayName, bio, location, isPublic } = data;
  const uid = context.auth.uid;

  // Validation
  if (displayName && displayName.length > 30) {
    throw new functions.https.HttpsError("invalid-argument", "Display name must be 30 characters or less.");
  }

  if (bio && bio.length > 500) {
    throw new functions.https.HttpsError("invalid-argument", "Bio must be 500 characters or less.");
  }

  if (location && location.length > 50) {
    throw new functions.https.HttpsError("invalid-argument", "Location must be 50 characters or less.");
  }

  try {
    const profileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
    
    const updateData = {
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    if (displayName !== undefined) updateData.displayName = displayName.trim();
    if (bio !== undefined) updateData.bio = bio.trim();
    if (location !== undefined) updateData.location = location.trim();
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    await profileRef.update(updateData);

    return { 
      success: true, 
      message: "Profile updated successfully!"
    };

  } catch (error) {
    console.error("Error updating profile for user:", uid, error);
    throw new functions.https.HttpsError("internal", "An error occurred while updating profile.");
  }
});

/**
 * Awards XP to a user for various activities
 */
exports.awardXP = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { amount, reason, seasonId } = data;
  const uid = context.auth.uid;

  if (!amount || amount < 1) {
    throw new functions.https.HttpsError("invalid-argument", "XP amount must be positive.");
  }

  if (!reason) {
    throw new functions.https.HttpsError("invalid-argument", "Reason is required.");
  }

  try {
    const batch = admin.firestore().batch();

    // Update user profile XP
    const profileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
    batch.update(profileRef, {
      xp: admin.firestore.FieldValue.increment(amount),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    // Log XP transaction
    const xpTransactionRef = admin.firestore().collection(`xp_transactions/${uid}/transactions`).doc();
    batch.set(xpTransactionRef, {
      amount: amount,
      reason: reason,
      seasonId: seasonId || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    return { 
      success: true, 
      message: `Awarded ${amount} XP for ${reason}!`,
      amount: amount
    };

  } catch (error) {
    console.error("Error awarding XP to user:", uid, error);
    throw new functions.https.HttpsError("internal", "An error occurred while awarding XP.");
  }
});

/**
 * Unlocks class tiers based on XP
 */
exports.checkClassUnlocks = functions.https.onCall(async (data, context) => {
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

    const userData = profileSnap.data();
    const currentXP = userData.xp || 0;
    const currentClasses = userData.unlockedClasses || ["SoundSport"];

    // Define XP requirements
    const classRequirements = {
      "SoundSport": 0,
      "A Class": 500,
      "Open Class": 2000,
      "World Class": 5000
    };

    let newUnlocks = [];
    let updatedClasses = [...currentClasses];

    for (const [className, requiredXP] of Object.entries(classRequirements)) {
      if (currentXP >= requiredXP && !currentClasses.includes(className)) {
        newUnlocks.push(className);
        updatedClasses.push(className);
      }
    }

    if (newUnlocks.length > 0) {
      await profileRef.update({
        unlockedClasses: updatedClasses,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        newUnlocks: newUnlocks,
        message: `Congratulations! You've unlocked: ${newUnlocks.join(', ')}!`
      };
    }

    return {
      success: true,
      newUnlocks: [],
      message: "No new class unlocks available."
    };

  } catch (error) {
    console.error("Error checking class unlocks for user:", uid, error);
    throw new functions.https.HttpsError("internal", "An error occurred while checking class unlocks.");
  }
});