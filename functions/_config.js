const admin = require("firebase-admin");

// Initialize the app ONCE at the top level of the module.
admin.initializeApp();

// Get the Firestore instance from the already-initialized app.
const db = admin.firestore();

/**
 * Returns the already-initialized Firestore database instance.
 */
const getDb = () => {
    return db;
};

module.exports = {
    getDb: getDb,
    appId: "marching-art",
};