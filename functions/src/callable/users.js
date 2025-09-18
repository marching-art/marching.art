const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb, dataNamespaceParam } = require("../config");

exports.setUserRole = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied",
      "You must be an admin to perform this action.");
  }

  const { email, makeAdmin } = request.data;
  logger.info(`Admin ${request.auth.uid} attempting to set role for ${email} to admin: ${makeAdmin}`);

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { admin: makeAdmin });

    const action = makeAdmin ? "granted" : "revoked";
    return {
      success: true,
      message: `Admin privileges have been ${action} for ${email}. User must re-login to see changes.`,
    };
  } catch (error) {
    logger.error(`Error setting user role for ${email}:`, error);
    if (error.code === "auth/user-not-found") {
      throw new HttpsError("not-found", `User with email ${email} was not found.`);
    }
    throw new HttpsError("internal", "An error occurred while setting the user role.");
  }
});

exports.checkUsername = onCall({ cors: true }, async (request) => {
  const { username } = request.data;
  if (!username || username.length < 3 || username.length > 15) {
    throw new HttpsError("invalid-argument",
      "Username must be between 3 and 15 characters.");
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new HttpsError("invalid-argument",
      "Username can only contain letters, numbers, and underscores.");
  }

  const usernameRef = getDb().doc(`usernames/${username.toLowerCase()}`);
  const usernameDoc = await usernameRef.get();

  if (usernameDoc.exists) {
    throw new HttpsError("already-exists", "This username is already taken.");
  }

  return { success: true, message: "Username is available." };
});

exports.createUserProfile = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to create a profile.");
  }

  const { username } = request.data;
  const { uid, email } = request.auth.token;

  if (!username) {
    throw new HttpsError("invalid-argument", "Username is required for profile creation.");
  }
  const trimmedUsername = username.trim();

  try {
    const db = getDb();
    const batch = db.batch();

    const usernameRef = db.doc(`usernames/${trimmedUsername.toLowerCase()}`);
    const usernameDoc = await usernameRef.get();

    if (usernameDoc.exists) {
      throw new HttpsError("already-exists", "This username is already taken.");
    }

    const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
    const userPrivateRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/private/data`);
    const existingProfile = await userProfileRef.get();

    if (existingProfile.exists) {
      throw new HttpsError("already-exists", "User profile already exists.");
    }

    batch.set(userProfileRef, {
      username: trimmedUsername,
      createdAt: new Date(),
      lastActive: new Date(),
      bio: `Welcome to my marching.art profile!`,
      uniform: {
        skinTone: '#d8aa7c',
        headwear: { style: 'shako', colors: { hat: '#1a1a1a', trim: '#ffffff' } },
        plume: { style: 'fountain', colors: { plume: '#ff0000' } },
        jacket: { style: 'sash', colors: { base: '#000080', accent: '#ffffff', trim: '#ffd700' } },
        pants: { style: 'stripe', colors: { base: '#ffffff', stripe: '#000080' } },
        shoes: { style: 'white' },
      },
      trophies: { championships: [], regionals: [], finalistMedals: [] },
      seasons: [],
      corps: {}
    });

    batch.set(userPrivateRef, {
      email: email,
    });

    batch.set(usernameRef, { uid: uid });

    await batch.commit();
    logger.info(`Successfully created profile for user ${uid} with username ${trimmedUsername}`);
    return { success: true, message: "User profile created successfully." };

  } catch (error) {
    logger.error(`Error creating user profile for ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to create user profile.");
  }
});

exports.getShowRegistrations = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");

  const { week, eventName, date } = request.data;
  if (!week || !eventName || !date) {
    throw new HttpsError("invalid-argument", "Missing required show data.");
  }

  const db = getDb();
  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) throw new HttpsError("not-found", "No active season.");

  const activeSeasonId = seasonDoc.data().seasonUid;
  if (!activeSeasonId) {
    throw new HttpsError("not-found", "Active season UID is not configured.");
  }

  const registrations = [];
  const q = db.collectionGroup("profile").where("activeSeasonId", "==", activeSeasonId);
  const querySnapshot = await q.get();

  querySnapshot.forEach((doc) => {
    const profile = doc.data();
    const userCorps = profile.corps || {};

    for (const corpsClass in userCorps) {
      const corps = userCorps[corpsClass];
      const showsForWeek = corps.selectedShows ? corps.selectedShows[`week${week}`] : [];

      if (showsForWeek && showsForWeek.some((s) => s.eventName === eventName && s.date === date)) {
        registrations.push({
          corpsName: corps.corpsName || "Unnamed Corps",
          corpsClass: corpsClass,
          username: profile.username,
        });
      }
    }
  });

  return { registrations: registrations };
});

exports.getUserRankings = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to perform this action.");
  }
  const uid = request.auth.uid;
  const db = getDb();

  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) {
    throw new HttpsError("not-found", "No active season found.");
  }
  const activeSeasonId = seasonDoc.data().seasonUid;

  const profilesQuery = db.collectionGroup("profile").where("activeSeasonId", "==", activeSeasonId);
  const profilesSnapshot = await profilesQuery.get();

  if (profilesSnapshot.empty) {
    return { globalRank: 1, totalPlayers: 1 };
  }

  const allPlayerScores = [];
  let myTotalScore = 0;

  profilesSnapshot.docs.forEach((doc) => {
    const profile = doc.data();
    const userId = doc.ref.parent.parent.id;

    const userCorps = profile.corps || {};
    if (profile.corpsName && !userCorps.worldClass) {
      userCorps.worldClass = { totalSeasonScore: profile.totalSeasonScore || 0 };
    }
    const totalScore = Object.values(userCorps).reduce((sum, corps) => sum + (corps.totalSeasonScore || 0), 0);

    allPlayerScores.push(totalScore);
    if (userId === uid) {
      myTotalScore = totalScore;
    }
  });

  allPlayerScores.sort((a, b) => b - a);
  const rank = allPlayerScores.findIndex((score) => score === myTotalScore) + 1;

  return {
    globalRank: rank > 0 ? rank : allPlayerScores.length,
    totalPlayers: allPlayerScores.length,
    totalScore: myTotalScore,
  };
});

exports.migrateUserProfiles = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
  }

  const db = getDb();
  let migratedCount = 0;
  let errorCount = 0;

  try {
    const profilesQuery = db.collectionGroup("profile")
      .where("corpsName", "!=", null);

    const profilesSnapshot = await profilesQuery.get();

    if (profilesSnapshot.empty) {
      return { success: true, message: "No profiles need migration." };
    }

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of profilesSnapshot.docs) {
      const oldProfile = doc.data();

      if (oldProfile.corps) continue;

      try {
        const newProfileData = {
          corps: {
            worldClass: {
              corpsName: oldProfile.corpsName,
              lineup: oldProfile.lineup || {},
              totalSeasonScore: oldProfile.totalSeasonScore || 0,
              selectedShows: oldProfile.selectedShows || {},
              weeklyTrades: oldProfile.weeklyTrades || { used: 0 },
              lastScoredDay: oldProfile.lastScoredDay || 0,
              lineupKey: oldProfile.lineupKey,
            },
          },
          migratedAt: new Date(),
        };

        batch.update(doc.ref, newProfileData);
        migratedCount++;
        batchCount++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      } catch (error) {
        logger.error(`Error migrating profile ${doc.id}:`, error);
        errorCount++;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    return {
      success: true,
      message: `Migration completed: ${migratedCount} profiles migrated, ${errorCount} errors`,
    };
  } catch (error) {
    logger.error("Migration failed:", error);
    throw new HttpsError("internal", "Migration failed: " + error.message);
  }
});