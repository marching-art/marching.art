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
exports.updateProfile = onCall(async (request) => {
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
 * Get public profile for a user
 * @param {Object} data
 * @param {string} data.userId - The user ID to get profile for
 */
exports.getPublicProfile = onCall(async (request) => {
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
