const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * Triggered on the creation of a new Firebase Authentication user.
 * Creates a user profile in Firestore that is compatible with the existing data structure.
 */
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  const { uid, email } = user;
  const logger = functions.logger;

  // Corrected path to match your existing structure
  const profileRef = admin.firestore().doc(`artifacts/marching-art/users/${uid}/profile/data`);

  const newUserProfile = {
    // Core Info
    email: email,
    displayName: email.split('@')[0],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastLogin: admin.firestore.FieldValue.serverTimestamp(),
    
    // Default Gameplay Fields
    activeSeasonId: null,
    totalSeasonScore: 0,
    xp: 0,
    corpsCoin: 0,
    unlockedClasses: ["SoundSport", "A Class"],
    corps: {
      alias: "Rookie",
      corpsName: "New Corps",
    },
    
    // Default Empty Structures to match existing accounts
    lineup: {},
    selectedShows: {},
    uniform: {
      base: "#ffffff",
      style: "solid",
      colors: {
        primary: "#000000",
        secondary: "#cccccc",
        accent: "#ff0000",
      },
    },
    blockedUsers: [],

    // Other default fields
    isPublic: true,
    lastUpdatedShowScoring: new Date(0), // Set to epoch time
  };

  try {
    await profileRef.set(newUserProfile);
    logger.info(`Successfully created compatible profile for user: ${uid}`);
  } catch (error) {
    logger.error(`Error creating compatible profile for user: ${uid}`, error);
  }
});