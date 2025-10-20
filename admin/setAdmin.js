// Import the Firebase Admin SDK
const admin = require('firebase-admin');

// Import your service account key
const serviceAccount = require('./serviceAccountKey.json');

// --- CONFIGURATION ---
// PASTE THE USER UID YOU COPIED FROM THE FIREBASE CONSOLE HERE
const uid = 'o8vfRCOevjTKBY0k2dISlpiYiIH2';

// Initialize the Firebase Admin App
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Set the admin custom claim for the user
admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`Successfully set admin claim for user: ${uid}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error setting custom claims:', error);
    process.exit(1);
  });