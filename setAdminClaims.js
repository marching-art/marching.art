// setAdminClaims.js
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'marching-art'
});

async function setAdminClaims() {
  const uid = 'o8vfRCOevjTKBY0k2dISlpiYiIH2';
  
  try {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log('Successfully set admin claims for user:', uid);
    
    // Verify the claims were set
    const user = await admin.auth().getUser(uid);
    console.log('User custom claims:', user.customClaims);
    
    process.exit(0);
  } catch (error) {
    console.error('Error setting admin claims:', error);
    process.exit(1);
  }
}

setAdminClaims();