const admin = require("firebase-admin");

// This will hold our initialized db connection after the first use
let db;

/**
 * Initializes the Firebase Admin SDK and Firestore connection if they haven't
 * been already, then returns the Firestore instance.
 */
const getDb = () => {
    if (db) {
        // If db is already initialized, return it to avoid re-initializing
        return db;
    }
    // If it's the first time, initialize the app and the database
    admin.initializeApp();
    db = admin.firestore();
    return db;
};

module.exports = {
    getDb: getDb, // Export the function that gets the database
    appId: "marching-art",
};