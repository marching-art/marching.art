// In functions/_config.js

const admin = require("firebase-admin");

let db; // This will hold our initialized db connection

const getDb = () => {
    if (db) {
        // If db is already initialized, return it
        return db;
    }
    // If not, initialize the app and the database
    admin.initializeApp();
    db = admin.firestore();
    return db;
};

module.exports = {
    getDb: getDb,
    appId: "marching-art",
};