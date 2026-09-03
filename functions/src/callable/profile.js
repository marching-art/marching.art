// functions/src/callable/profile.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { FieldValue } = require("firebase-admin/firestore");
const { assertAuth, assertWriteBudget } = require("../helpers/callableGuards");
const { detachMemberFromLeague } = require("../helpers/leagueLifecycle");
const { collectRegistrationsFromProfile } = require("../helpers/showRegistrations");
const { eraseDirectorFromResults } = require("../helpers/accountErasure");

/**
 * Apply a list of write operations across as many Firestore batches as needed,
 * staying under the 500-op batch limit. Each op is a function that receives the
 * current batch and enqueues one write. Used by account deletion to anonymize a
 * potentially large fan-out (a prolific commenter's threads) without a single
 * oversized batch.
 */
async function commitInChunks(db, ops, chunkSize = 400) {
  for (let i = 0; i < ops.length; i += chunkSize) {
    const batch = db.batch();
    for (const applyOp of ops.slice(i, i + chunkSize)) applyOp(batch);
    await batch.commit();
  }
}

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

    if (location !== undefined) {
      if (typeof location !== 'string') {
        throw new HttpsError("invalid-argument", "Location must be a string.");
      }
      if (location.length > 100) {
        throw new HttpsError("invalid-argument", "Location cannot exceed 100 characters.");
      }
    }

    if (bio !== undefined) {
      if (typeof bio !== 'string') {
        throw new HttpsError("invalid-argument", "Bio must be a string.");
      }
      if (bio.length > 500) {
        throw new HttpsError("invalid-argument", "Bio cannot exceed 500 characters.");
      }
    }

    if (favoriteCorps !== undefined) {
      if (typeof favoriteCorps !== 'string') {
        throw new HttpsError("invalid-argument", "Favorite corps must be a string.");
      }
      if (favoriteCorps.length > 100) {
        throw new HttpsError("invalid-argument", "Favorite corps cannot exceed 100 characters.");
      }
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
 * Delete user account and all associated data
 * This permanently deletes the user's account from Firebase Auth
 * and removes all their data from Firestore
 */
// Longer timeout than the default: deletion now sweeps the full recap history
// (fantasy + podium) to anonymize this director's past results, which is bounded
// by the game's history rather than a constant.
exports.deleteAccount = onCall({ cors: true, timeoutSeconds: 300, cpu: 1 }, async (request) => {
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

    // corpsNamesSnap holds every corps-name reservation this account owns, in
    // any season (corpsnames/{seasonUid}_{name}), so the names can be released
    // back to the open market below.
    const [supporterSnap, corpsNamesSnap] = await Promise.all([
      supporterRef ? supporterRef.get() : Promise.resolve(null),
      db.collection('corpsnames').where('uid', '==', userId).get(),
    ]);

    // One small batch for the documents that live OUTSIDE the user's subtree
    // plus the profile itself (so listeners drop it immediately). Everything
    // under the user document is removed by the recursive delete below — the
    // former hand-enumerated batch covered two of the eleven user
    // subcollections and, with notifications unbounded, overflowed the 500-op
    // batch cap for any active account, which made deletion impossible for
    // exactly the directors most likely to want it (SITE_REVIEW B-H6/S-M6).
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

    // Release every corps-name reservation back to the open market. The name is
    // globally unique per season (registerCorps / processCorpsDecisions block a
    // name any reservation already holds, including a retired account's), so a
    // deleted director's names would otherwise stay locked forever. Historical
    // recaps keep showing the corps name as text — releasing the reservation
    // only frees the name for a future director to claim.
    corpsNamesSnap.docs.forEach(doc => {
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

    // Leagues first, while the profile still says which ones they are in.
    // A league's roster lives on the LEAGUE document, so deleting the profile
    // and stopping left this uid in every `members` array it had ever joined —
    // padding the member count, holding a standings row, and unremovable by the
    // commissioner, whose only escape hatch wrote to the profile that had just
    // been deleted. Each league is best-effort and cannot fail the deletion;
    // whatever this misses, removeLeagueMember can now clear by hand.
    const leagueIds = profileDoc.exists ? profileDoc.data().leagueIds || [] : [];
    for (const leagueId of leagueIds) {
      const outcome = await detachMemberFromLeague(db, leagueId, userId);
      logger.info(`Account deletion ${userId}: league ${leagueId} ${outcome}.`);
    }

    // Single atomic commit for the cross-collection deletions
    await batch.commit();

    // The whole user subtree: corps, notifications, the profile/public mirror,
    // seasonDetail, captionLedger, wardrobe, podium, corpsCoinHistory,
    // email_log, comments — and the user document itself. Recursive, so a new
    // subcollection is deleted by default rather than orphaned. A failure here
    // aborts BEFORE the Auth account goes, so the director can retry: the
    // profile is already gone and every step above is idempotent.
    try {
      await db.recursiveDelete(userDocRef);
    } catch (recursiveError) {
      logger.error(`Account deletion ${userId}: recursive delete of the user subtree failed:`, recursiveError);
      throw new HttpsError(
        "internal",
        "Your account data could not be fully removed. Please try again in a moment."
      );
    }

    // Drop the user out of the materialized "who's attending" show index so the
    // deleted account stops appearing on upcoming show pages (and in the running
    // order) before the nightly rebuild would otherwise self-heal it. The index
    // is keyed by the active season's uid; the user's registrations are derived
    // from the profile we already read (its selectedShows are the source of
    // truth), and each of their `${uid}_${corpsClass}` entries is removed from
    // the event docs it appears in. Best-effort — the profile (source of truth)
    // is already gone, and the nightly rebuild reconciles anything missed here.
    if (profileDoc.exists) {
      try {
        const seasonDoc = await db.doc("game-settings/season").get();
        const seasonUid = seasonDoc.exists ? seasonDoc.data().seasonUid : null;
        if (seasonUid) {
          // eventKey -> set of this user's registration entry keys on that event.
          const entryKeysByEvent = new Map();
          for (const { key, entryKey } of collectRegistrationsFromProfile(userId, profileDoc.data())) {
            if (!entryKeysByEvent.has(key)) entryKeysByEvent.set(key, new Set());
            entryKeysByEvent.get(key).add(entryKey);
          }
          if (entryKeysByEvent.size > 0) {
            const regBatch = db.batch();
            for (const [eventKey, entryKeys] of entryKeysByEvent) {
              const registrations = {};
              for (const entryKey of entryKeys) {
                registrations[entryKey] = FieldValue.delete();
              }
              regBatch.set(
                db.doc(paths.showRegistrationEvent(seasonUid, eventKey)),
                { registrations },
                { merge: true }
              );
            }
            await regBatch.commit();
          }
        }
      } catch (indexError) {
        logger.warn(`Show-registration cleanup failed for ${userId} (self-heals nightly):`, indexError);
      }
    }

    // Anonymize the account's public footprint that OUTLIVES the profile:
    // article comments, article likes, and historical results. Each step is
    // best-effort — the account is already deleted from the app's point of view,
    // and none of these should block or fail the deletion. They are also
    // idempotent, so a partial run is safe to leave as-is.

    // Comments stay on the article (removing them would gut threads other
    // readers replied to) but lose their author: null the identity, keep the
    // text. Likes are anonymous already — only the per-user reaction doc ties a
    // like to a person, and the aggregate count lives elsewhere — so deleting
    // those docs keeps every article's like COUNT while dropping the attribution.
    try {
      const [commentsSnap, reactionsSnap] = await Promise.all([
        db.collection("article_comments").where("userId", "==", userId).get(),
        db.collection("article_user_reactions").where("userId", "==", userId).get(),
      ]);
      const ANON_NAME = "Former Director";
      const ops = [];
      commentsSnap.docs.forEach((doc) => {
        ops.push((batch) => batch.update(doc.ref, {
          userId: null,
          userName: ANON_NAME,
          userTitle: null,
          anonymized: true,
        }));
      });
      reactionsSnap.docs.forEach((doc) => {
        ops.push((batch) => batch.delete(doc.ref));
      });
      await commitInChunks(db, ops);
    } catch (commentError) {
      logger.warn(`Comment/like anonymization failed for ${userId}:`, commentError);
    }

    // Historical results (recaps, Podium standings, Hall of Champions) keep the
    // corps and its scores but must stop naming or linking to the deleted
    // director — see helpers/accountErasure.js.
    try {
      const stats = await eraseDirectorFromResults(db, userId);
      logger.info(
        `Anonymized results for ${userId}: ${stats.recapDays} recap days, ` +
          `${stats.standings} standings, ${stats.fantasyStandings} fantasy standings, ` +
          `${stats.champions} champion docs.`
      );
    } catch (resultsError) {
      logger.warn(`Results anonymization failed for ${userId}:`, resultsError);
    }

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
