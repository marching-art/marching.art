const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { DATA_NAMESPACE } = require("../config"); // Import the namespace

/**
 * Triggered on the creation of a new Firebase Authentication user.
 */
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  const { uid, email } = user;
  const logger = functions.logger;

  // Use the namespace variable to build the correct path
  const profileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);

  const newUserProfile = {
    email: email,
    displayName: email.split('@')[0],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastLogin: admin.firestore.FieldValue.serverTimestamp(),
    activeSeasonId: null,
    totalSeasonScore: 0,
    xp: 0,
    corpsCoin: 0,
    unlockedClasses: ["SoundSport", "A Class"],
    corps: { alias: "Rookie", corpsName: "New Corps" },
    lineup: {},
    selectedShows: {},
    uniform: { base: "#ffffff", style: "solid", colors: { primary: "#000000", secondary: "#cccccc", accent: "#ff0000" } },
    blockedUsers: [],
    isPublic: true,
    lastUpdatedShowScoring: new Date(0),
  };

  try {
    await profileRef.set(newUserProfile);
    logger.info(`Successfully created compatible profile for user: ${uid}`);
  } catch (error) {
    logger.error(`Error creating compatible profile for user: ${uid}`, error);
  }
});