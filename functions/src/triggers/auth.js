/**
 * Authentication Trigger Functions
 * Handles user creation and deletion events
 * 
 * Location: functions/src/triggers/auth.js
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { DATA_NAMESPACE, getFunctionConfig } = require("../../config");

/**
 * Helper function to get the current season ID
 */
function getCurrentSeasonId() {
  const now = new Date();
  const year = now.getFullYear();
  
  // Season runs from June to August, so if we're before June, 
  // we're still in the previous year's season
  if (now.getMonth() < 5) { // Before June (0-indexed)
    return (year - 1).toString();
  }
  
  return year.toString();
}

/**
 * Triggered when a new user is created
 * Creates the initial user profile with support for multiple corps
 */
exports.onUserCreate = functions
  .runWith(getFunctionConfig('light'))
  .auth.user()
  .onCreate(async (user) => {
    console.log(`Creating profile for new user: ${user.uid}`);
    
    try {
      const db = admin.firestore();
      const userProfileRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${user.uid}/profile/data`);
      
      // Get current season
      const seasonDoc = await db.doc('game-settings/current').get();
      const currentSeasonId = seasonDoc.exists ? 
        (seasonDoc.data().activeSeasonId || seasonDoc.data().currentSeasonId || getCurrentSeasonId()) : 
        getCurrentSeasonId();

      // Create initial user profile
      await userProfileRef.set({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'New User',
        photoURL: user.photoURL || null,
        
        // Corps information (will be updated on first setup)
        corps: {
          corpsName: 'New Corps',
          corpsClass: 'SoundSport',
          alias: 'Director',
          location: '',
          uniform: {
            primaryColor: '#F7941D',
            secondaryColor: '#000000',
            accentColor: '#FFFFFF'
          }
        },
        
        // Game stats
        xp: 0,
        level: 1,
        corpsCoin: 1000,
        
        // Unlocked features
        unlockedClasses: ['SoundSport'],
        
        // Season info
        currentSeasonId: currentSeasonId,
        seasonsCompleted: 0,
        
        // Profile settings
        isPublic: true,
        bio: '',
        
        // Stats
        stats: {
          totalShows: 0,
          wins: 0,
          podiums: 0,
          finalsAppearances: 0,
          highestScore: 0,
          averageScore: 0,
          staffHired: 0,
          leaguesJoined: 0
        },
        
        // Timestamps
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActive: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });

      // Award welcome XP
      const xpTransactionRef = db.collection(`xp_transactions/${user.uid}/transactions`).doc();
      await xpTransactionRef.set({
        type: 'account_creation',
        amount: 50,
        description: 'Welcome to marching.art!',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        seasonId: currentSeasonId
      });

      console.log(`Successfully created profile for user: ${user.uid}`);
      return null;
      
    } catch (error) {
      console.error(`Error creating profile for user ${user.uid}:`, error);
      return null;
    }
  });

/**
 * Triggered when a user is deleted
 * Cleans up all user data across collections
 */
exports.onUserDelete = functions
  .runWith(getFunctionConfig('standard'))
  .auth.user()
  .onDelete(async (user) => {
    console.log(`Cleaning up data for deleted user: ${user.uid}`);
    
    try {
      const db = admin.firestore();
      const batch = db.batch();
      
      // Delete user profile and all subcollections
      const userRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${user.uid}`);
      const userCollections = ['profile', 'private', 'staff', 'corps', 'comments', 'notifications'];
      
      for (const collection of userCollections) {
        const collectionRef = userRef.collection(collection);
        const snapshot = await collectionRef.get();
        
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
      }

      // Delete user from any marketplace listings
      const marketplaceRef = db.collection('staff_marketplace');
      const marketplaceSnapshot = await marketplaceRef.where('sellerId', '==', user.uid).get();
      
      marketplaceSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Remove user from leagues
      const leaguesRef = db.collection('leagues');
      const leagueSnapshot = await leaguesRef.where('members', 'array-contains', user.uid).get();
      
      leagueSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const updatedMembers = data.members.filter(memberId => memberId !== user.uid);
        batch.update(doc.ref, { 
          members: updatedMembers,
          memberCount: updatedMembers.length
        });
      });

      // Delete XP transactions
      const xpRef = db.collection(`xp_transactions/${user.uid}/transactions`);
      const xpSnapshot = await xpRef.get();
      
      xpSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete CorpsCoin transactions
      const coinRef = db.collection(`corps_coin_transactions/${user.uid}/transactions`);
      const coinSnapshot = await coinRef.get();
      
      coinSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Clean up league invitations
      const invitationsRef = db.collection('league_invitations');
      const inviteSnapshot = await invitationsRef.where('inviteeId', '==', user.uid).get();
      const senderSnapshot = await invitationsRef.where('inviterId', '==', user.uid).get();
      
      [...inviteSnapshot.docs, ...senderSnapshot.docs].forEach(doc => {
        batch.delete(doc.ref);
      });

      // Commit all deletions
      await batch.commit();
      
      console.log(`Successfully cleaned up data for deleted user: ${user.uid}`);
      
    } catch (error) {
      console.error(`Error cleaning up data for user ${user.uid}:`, error);
    }
    
    return null;
  });