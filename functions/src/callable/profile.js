// functions/src/callable/profile.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb, dataNamespaceParam } = require("../config");
const { FieldValue } = require("firebase-admin/firestore");

/**
 * Update user profile information
 * @param {Object} data - Profile update data
 * @param {string} data.displayName - User's display name
 * @param {string} data.location - User's location
 * @param {string} data.bio - User's biography
 * @param {string} data.favoriteCorps - User's favorite corps
 */
exports.updateProfile = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to update your profile.");
  }

  const userId = request.auth.uid;
  const { displayName, location, bio, favoriteCorps } = request.data;

  logger.info(`Updating profile for user ${userId}`);

  try {
    const db = getDb();
    const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${userId}/profile/data`);

    // Validate inputs
    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || displayName.trim().length === 0) {
        throw new HttpsError("invalid-argument", "Display name cannot be empty.");
      }
      if (displayName.length > 50) {
        throw new HttpsError("invalid-argument", "Display name cannot exceed 50 characters.");
      }
    }

    if (location !== undefined && typeof location !== 'string') {
      throw new HttpsError("invalid-argument", "Location must be a string.");
    }

    if (bio !== undefined) {
      if (typeof bio !== 'string') {
        throw new HttpsError("invalid-argument", "Bio must be a string.");
      }
      if (bio.length > 500) {
        throw new HttpsError("invalid-argument", "Bio cannot exceed 500 characters.");
      }
    }

    if (favoriteCorps !== undefined && typeof favoriteCorps !== 'string') {
      throw new HttpsError("invalid-argument", "Favorite corps must be a string.");
    }

    // Build update object (only include provided fields)
    const updates = {
      updatedAt: FieldValue.serverTimestamp()
    };

    if (displayName !== undefined) updates.displayName = displayName.trim();
    if (location !== undefined) updates.location = location.trim();
    if (bio !== undefined) updates.bio = bio.trim();
    if (favoriteCorps !== undefined) updates.favoriteCorps = favoriteCorps.trim();

    // Update profile
    await profileRef.update(updates);

    logger.info(`Successfully updated profile for user ${userId}`);

    return {
      success: true,
      message: "Profile updated successfully",
      updates
    };

  } catch (error) {
    logger.error(`Error updating profile for user ${userId}:`, error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal", "Failed to update profile. Please try again.");
  }
});

/**
 * Update username with uniqueness validation
 * @param {Object} data - Username update data
 * @param {string} data.username - New username to set
 */
exports.updateUsername = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to update your username.");
  }

  const userId = request.auth.uid;
  const { username } = request.data;

  logger.info(`Updating username for user ${userId}`);

  // Validate username
  if (!username || typeof username !== 'string') {
    throw new HttpsError("invalid-argument", "Username is required.");
  }

  const trimmedUsername = username.trim();

  if (trimmedUsername.length < 3 || trimmedUsername.length > 15) {
    throw new HttpsError("invalid-argument", "Username must be between 3 and 15 characters.");
  }

  if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
    throw new HttpsError("invalid-argument", "Username can only contain letters, numbers, and underscores.");
  }

  try {
    const db = getDb();
    const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${userId}/profile/data`);
    const newUsernameRef = db.doc(`usernames/${trimmedUsername.toLowerCase()}`);

    // Get current profile to check old username
    const profileDoc = await profileRef.get();
    if (!profileDoc.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const currentProfile = profileDoc.data();
    const oldUsername = currentProfile.username;

    // Check if username is the same
    if (oldUsername && oldUsername.toLowerCase() === trimmedUsername.toLowerCase()) {
      return {
        success: true,
        message: "Username unchanged",
        username: trimmedUsername
      };
    }

    // Check if new username is available
    const newUsernameDoc = await newUsernameRef.get();
    if (newUsernameDoc.exists) {
      throw new HttpsError("already-exists", "This username is already taken.");
    }

    // Use batch to atomically update
    const batch = db.batch();

    // Delete old username reservation if exists
    if (oldUsername) {
      const oldUsernameRef = db.doc(`usernames/${oldUsername.toLowerCase()}`);
      batch.delete(oldUsernameRef);
    }

    // Reserve new username
    batch.set(newUsernameRef, { uid: userId });

    // Update profile
    batch.update(profileRef, {
      username: trimmedUsername,
      updatedAt: FieldValue.serverTimestamp()
    });

    await batch.commit();

    logger.info(`Successfully updated username for user ${userId} from "${oldUsername}" to "${trimmedUsername}"`);

    return {
      success: true,
      message: "Username updated successfully",
      username: trimmedUsername
    };

  } catch (error) {
    logger.error(`Error updating username for user ${userId}:`, error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal", "Failed to update username. Please try again.");
  }
});

/**
 * Update user email address
 * @param {Object} data - Email update data
 * @param {string} data.email - New email address
 */
exports.updateEmail = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to update your email.");
  }

  const userId = request.auth.uid;
  const { email } = request.data;

  logger.info(`Updating email for user ${userId}`);

  // Validate email
  if (!email || typeof email !== 'string') {
    throw new HttpsError("invalid-argument", "Email is required.");
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    throw new HttpsError("invalid-argument", "Please enter a valid email address.");
  }

  try {
    const admin = require("firebase-admin");
    const db = getDb();

    // Check if email is already in use by another account
    try {
      const existingUser = await admin.auth().getUserByEmail(trimmedEmail);
      if (existingUser.uid !== userId) {
        throw new HttpsError("already-exists", "This email is already associated with another account.");
      }
      // If it's the same user, email is unchanged
      return {
        success: true,
        message: "Email unchanged",
        email: trimmedEmail
      };
    } catch (authError) {
      // If user not found, email is available - continue
      if (authError.code !== 'auth/user-not-found') {
        throw authError;
      }
    }

    // Update email in Firebase Auth
    await admin.auth().updateUser(userId, { email: trimmedEmail });

    // Update email in Firestore profile
    const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${userId}/profile/data`);
    const privateRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${userId}/private/data`);

    const batch = db.batch();
    batch.update(profileRef, {
      email: trimmedEmail,
      updatedAt: FieldValue.serverTimestamp()
    });
    batch.update(privateRef, {
      email: trimmedEmail
    });

    await batch.commit();

    logger.info(`Successfully updated email for user ${userId} to "${trimmedEmail}"`);

    return {
      success: true,
      message: "Email updated successfully",
      email: trimmedEmail
    };

  } catch (error) {
    logger.error(`Error updating email for user ${userId}:`, error);

    if (error instanceof HttpsError) {
      throw error;
    }

    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError("already-exists", "This email is already associated with another account.");
    }

    if (error.code === 'auth/invalid-email') {
      throw new HttpsError("invalid-argument", "Please enter a valid email address.");
    }

    throw new HttpsError("internal", "Failed to update email. Please try again.");
  }
});

/**
 * Get public profile for a user
 * @param {Object} data
 * @param {string} data.userId - The user ID to get profile for
 */
exports.getPublicProfile = onCall({ cors: true }, async (request) => {
  const { userId } = request.data;

  if (!userId) {
    throw new HttpsError("invalid-argument", "User ID is required.");
  }

  logger.info(`Fetching public profile for user ${userId}`);

  try {
    const db = getDb();
    const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${userId}/profile/data`);
    const profileDoc = await profileRef.get();

    if (!profileDoc.exists) {
      throw new HttpsError("not-found", "Profile not found.");
    }

    const profileData = profileDoc.data();

    // Return only public fields
    return {
      displayName: profileData.displayName || 'Unknown Director',
      location: profileData.location || '',
      bio: profileData.bio || '',
      favoriteCorps: profileData.favoriteCorps || '',
      xp: profileData.xp || 0,
      xpLevel: profileData.xpLevel || 1,
      achievements: profileData.achievements || [],
      stats: profileData.stats || {
        seasonsPlayed: 0,
        championships: 0,
        topTenFinishes: 0
      },
      createdAt: profileData.createdAt,
      corps: profileData.corps || {}
    };

  } catch (error) {
    logger.error(`Error fetching public profile for user ${userId}:`, error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal", "Failed to fetch profile. Please try again.");
  }
});
