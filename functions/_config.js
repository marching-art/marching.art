const admin = require("firebase-admin");

// Initialize the Firebase Admin SDK
admin.initializeApp();

// Export the initialized services and config variables for other files to use
module.exports = {
    db: admin.firestore(),
    appId: "marching-art", // Your project's App ID
};