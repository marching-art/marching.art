// functions/src/callable/profile.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { FieldValue } = require("firebase-admin/firestore");
const { assertAuth, assertWriteBudget } = require("../helpers/callableGuards");

/**
 * Update user profile information
 * @param {Object} data - Profile update data
 * @param {string} data.displayName - User's display name
 * @param {string} data.location - User's location
 * @param {string} data.bio - User's biography
 * @param {string} data.favoriteCorps - User's favorite corps
 */
exports.updateProfile = onCall({ cors: true }, async (request) => {
  const userId = assertAuth(request);

  const { displayName, location, bio, favoriteCorps } = request.data;

  // Abuse throttle (shared profile bucket) — far above any human rate.
  await assertWriteBudget(getDb(), userId, "profile", { max: 60, windowMs: 10 * 60 * 1000 });

  logger.info(`Updating profile for user ${userId}`);

  try {
    const db = getDb();
    const profileRef = db.doc(paths.userProfile(userId));

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
  const userId = assertAuth(request);

  const { username } = request.data;

  // Abuse throttle (shared profile bucket) — far above any human rate.
  await assertWriteBudget(getDb(), userId, "profile", { max: 60, windowMs: 10 * 60 * 1000 });

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
    const profileRef = db.doc(paths.userProfile(userId));
    const newUsernameRef = db.doc(`usernames/${trimmedUsername.toLowerCase()}`);

    // Check availability and swap the reservation in ONE transaction. The
    // old check-then-batch flow raced: two users claiming the same name both
    // passed the availability read, and the loser's batch.set overwrote the
    // winner's reservation — and a later rename by the loser then DELETED a
    // reservation that belonged to someone else, freeing a name still shown
    // on their profile. transaction.create() makes the losing claim fail.
    const { unchanged, oldUsername } = await db.runTransaction(async (t) => {
      // Get current profile to check old username
      const profileDoc = await t.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const oldUsername = profileDoc.data().username;

      // Check if username is the same
      if (oldUsername && oldUsername.toLowerCase() === trimmedUsername.toLowerCase()) {
        return { unchanged: true, oldUsername };
      }

      // Delete old username reservation if it exists AND still belongs to
      // this user — never delete a reservation another account holds.
      if (oldUsername) {
        const oldUsernameRef = db.doc(`usernames/${oldUsername.toLowerCase()}`);
        const oldUsernameDoc = await t.get(oldUsernameRef);
        if (oldUsernameDoc.exists && oldUsernameDoc.data().uid === userId) {
          t.delete(oldUsernameRef);
        }
      }

      // Reserve new username — create() (not set) fails atomically if a
      // concurrent claim got there first.
      t.create(newUsernameRef, { uid: userId });

      // Update profile
      t.update(profileRef, {
        username: trimmedUsername,
        updatedAt: FieldValue.serverTimestamp()
      });
      return { unchanged: false, oldUsername };
    });

    if (unchanged) {
      return {
        success: true,
        message: "Username unchanged",
        username: trimmedUsername
      };
    }

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

    // transaction.create() rejects with gRPC ALREADY_EXISTS (code 6) when a
    // concurrent claim reserved the name between this call's read and commit.
    if (error?.code === 6) {
      throw new HttpsError("already-exists", "This username is already taken.");
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
  const userId = assertAuth(request);

  const { email } = request.data;

  // Abuse throttle (shared profile bucket) — far above any human rate.
  await assertWriteBudget(getDb(), userId, "profile", { max: 60, windowMs: 10 * 60 * 1000 });

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

    // Persist the email ONLY to the owner-private document. The public
    // `profile/data` doc is world-readable (leaderboards / public profiles),
    // so email addresses must never be written there.
    const profileRef = db.doc(paths.userProfile(userId));
    const privateRef = db.doc(paths.userPrivate(userId));

    const batch = db.batch();
    // Touch the public profile's updatedAt only (no email field).
    batch.update(profileRef, {
      updatedAt: FieldValue.serverTimestamp()
    });
    batch.set(privateRef, {
      email: trimmedEmail
    }, { merge: true });

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
    const profileRef = db.doc(paths.userProfile(userId));
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
        topTenFinishes: 0,
        leagueWins: 0,
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

/**
 * Delete user account and all associated data
 * This permanently deletes the user's account from Firebase Auth
 * and removes all their data from Firestore
 */
exports.deleteAccount = onCall({ cors: true }, async (request) => {
  const userId = assertAuth(request);

  // Abuse throttle (shared profile bucket) — far above any human rate.
  await assertWriteBudget(getDb(), userId, "profile", { max: 60, windowMs: 10 * 60 * 1000 });

  logger.info(`Deleting account for user ${userId}`);

  try {
    const admin = require("firebase-admin");
    const db = getDb();

    // Get user profile to find username for cleanup
    const profileRef = db.doc(paths.userProfile(userId));
    const profileDoc = await profileRef.get();
    const username = profileDoc.exists ? profileDoc.data().username : null;
    // Buy Me a Coffee supporter link (if any) — unlinked below so the deleted
    // account drops off the Supporters wall.
    const supporterEmailHash = profileDoc.exists
      ? profileDoc.data().supporter?.emailHash || null
      : null;
    const supporterRef = supporterEmailHash
      ? db.doc(paths.supporter(supporterEmailHash))
      : null;

    const userDocRef = db.doc(paths.user(userId));

    // OPTIMIZATION: Fetch subcollections in parallel instead of sequentially
    const [corpsSnapshot, notificationsSnapshot, supporterSnap] = await Promise.all([
      userDocRef.collection('corps').get(),
      userDocRef.collection('notifications').get(),
      supporterRef ? supporterRef.get() : Promise.resolve(null),
    ]);

    // OPTIMIZATION: Single batch for all deletions instead of 3 separate commits
    // Firestore batches support up to 500 operations - we're well under that limit
    const batch = db.batch();

    // Delete profile data
    batch.delete(profileRef);

    // Delete private data
    const privateRef = db.doc(paths.userPrivate(userId));
    batch.delete(privateRef);

    // Delete username reservation if exists
    if (username) {
      const usernameRef = db.doc(`usernames/${username.toLowerCase()}`);
      batch.delete(usernameRef);
    }

    // Delete corps subcollection documents
    corpsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete notifications subcollection documents
    notificationsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Unlink the Buy Me a Coffee supporter record from the deleted account:
    // strips the account association + wall identity (uid/displayName/username)
    // so they no longer appear on the Supporters wall, while leaving the
    // membership record intact for BMAC reconcile consistency.
    if (supporterRef && supporterSnap && supporterSnap.exists) {
      batch.update(supporterRef, {
        uid: null,
        displayName: null,
        username: null,
      });
    }

    // Single atomic commit for all Firestore deletions
    await batch.commit();

    // Delete the user from Firebase Auth
    await admin.auth().deleteUser(userId);

    logger.info(`Successfully deleted account for user ${userId}`);

    return {
      success: true,
      message: "Account deleted successfully"
    };

  } catch (error) {
    logger.error(`Error deleting account for user ${userId}:`, error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal", "Failed to delete account. Please try again.");
  }
});
