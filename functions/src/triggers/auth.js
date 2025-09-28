const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { DATA_NAMESPACE } = require("../config");

/**
 * Triggered when a new user is created
 * Creates the initial user profile and sets up default data
 */
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  console.log(`Creating profile for new user: ${user.uid}`);
  
  try {
    const userProfileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${user.uid}/profile/data`);
    
    // Create initial user profile
    await userProfileRef.set({
      id: user.uid,
      email: user.email,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActive: admin.firestore.FieldValue.serverTimestamp(),
      
      // Corps information - starts with default values
      corps: {
        corpsName: "New Corps",
        alias: "Director",
        class: "SoundSport",
        location: null,
        biography: null,
        showConcept: null,
        lastEdit: admin.firestore.FieldValue.serverTimestamp(),
        lastScore: 0,
        seasonRank: 0,
        totalPerformances: 0
      },
      
      // Game progression
      xp: 0,
      level: 1,
      corpsCoin: 1000, // Starting CorpsCoin
      unlockedClasses: ["SoundSport"], // Start with SoundSport unlocked
      
      // Season data
      activeSeasonId: getCurrentSeasonId(),
      lineup: {}, // Will be populated when user selects captions
      staffAssignments: {}, // Staff assigned to captions
      
      // Customization
      uniforms: {
        primaryColor: "#8B4513", // Brown
        secondaryColor: "#F7941D", // Gold
        textColor: "#FFFFFF", // White
        style: "traditional"
      },
      
      // Social features
      leagues: [],
      friends: [],
      
      // Privacy settings
      profileVisibility: "public",
      allowDirectMessages: true,
      showOnLeaderboards: true,
      
      // Statistics
      stats: {
        totalSeasons: 0,
        championshipsWon: 0,
        topFinishes: {
          first: 0,
          second: 0,
          third: 0
        },
        averageScore: 0
      }
    });

    // Create private data document
    const privateDataRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${user.uid}/private/data`);
    await privateDataRef.set({
      loginHistory: [{
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        method: 'email'
      }],
      preferences: {
        emailNotifications: true,
        pushNotifications: true,
        marketingEmails: false,
        dataSharing: false
      },
      purchaseHistory: [],
      reportedUsers: [],
      blockedUsers: []
    });

    // Initialize XP tracking
    const xpRef = admin.firestore().collection(`xp_transactions/${user.uid}/transactions`).doc();
    await xpRef.set({
      type: 'account_creation',
      amount: 100,
      description: 'Welcome to marching.art!',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      seasonId: getCurrentSeasonId()
    });

    // Update total XP
    await userProfileRef.update({
      xp: 100
    });

    console.log(`Successfully created profile for user: ${user.uid}`);
    
  } catch (error) {
    console.error(`Error creating profile for user ${user.uid}:`, error);
    // Don't throw error - we don't want to block user creation
  }
});

/**
 * Triggered when a user is deleted
 * Cleans up all user data across collections
 */
exports.onUserDelete = functions.auth.user().onDelete(async (user) => {
  console.log(`Cleaning up data for deleted user: ${user.uid}`);
  
  try {
    const batch = admin.firestore().batch();
    
    // Delete user profile and subcollections
    const userRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${user.uid}`);
    const userCollections = ['profile', 'private', 'staff', 'comments', 'notifications'];
    
    for (const collection of userCollections) {
      const collectionRef = userRef.collection(collection);
      const snapshot = await collectionRef.get();
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
    }

    // Delete user from any marketplace listings
    const marketplaceRef = admin.firestore().collection('staff_marketplace');
    const marketplaceSnapshot = await marketplaceRef.where('sellerId', '==', user.uid).get();
    
    marketplaceSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Remove user from leagues
    const leaguesRef = admin.firestore().collection('leagues');
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
    const xpRef = admin.firestore().collection(`xp_transactions/${user.uid}/transactions`);
    const xpSnapshot = await xpRef.get();
    
    xpSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete CorpsCoin transactions
    const coinRef = admin.firestore().collection('corpscoin_transactions');
    const coinSnapshot = await coinRef.where('userId', '==', user.uid).get();
    
    coinSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete performance history
    const performanceRef = admin.firestore().collection(`performance_history/${user.uid}`);
    const performanceSnapshot = await performanceRef.get();
    
    performanceSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Clean up league invitations
    const invitationsRef = admin.firestore().collection('league_invitations');
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
});

/**
 * Helper function to get the current season ID
 */
function getCurrentSeasonId() {
  const now = new Date();
  const year = now.getFullYear();
  
  // Season runs from June to August, so if we're before June, 
  // we're still in the previous year's season
  if (now.getMonth() < 5) { // Before June
    return (year - 1).toString();
  }
  
  return year.toString();
}

/**
 * Award XP to a user
 */
exports.awardXP = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { amount, description, type } = data;
  const uid = context.auth.uid;

  if (!amount || amount <= 0 || amount > 1000) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid XP amount.");
  }

  try {
    const userProfileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
    
    await admin.firestore().runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userProfileRef);
      
      if (!userSnap.exists) {
        throw new functions.https.HttpsError("not-found", "User profile not found.");
      }

      const userData = userSnap.data();
      const currentXP = userData.xp || 0;
      const newXP = currentXP + amount;
      const newLevel = Math.floor(newXP / 1000) + 1;

      // Update user XP and level
      transaction.update(userProfileRef, {
        xp: newXP,
        level: newLevel
      });

      // Record XP transaction
      const xpTransactionRef = admin.firestore().collection(`xp_transactions/${uid}/transactions`).doc();
      transaction.set(xpTransactionRef, {
        type: type || 'manual',
        amount: amount,
        description: description || 'XP awarded',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        seasonId: getCurrentSeasonId()
      });

      // Check for class unlocks based on XP
      const unlockedClasses = userData.unlockedClasses || ['SoundSport'];
      let newUnlocks = [];

      if (newXP >= 2000 && !unlockedClasses.includes('A Class')) {
        unlockedClasses.push('A Class');
        newUnlocks.push('A Class');
      }
      
      if (newXP >= 5000 && !unlockedClasses.includes('Open Class')) {
        unlockedClasses.push('Open Class');
        newUnlocks.push('Open Class');
      }
      
      if (newXP >= 10000 && !unlockedClasses.includes('World Class')) {
        unlockedClasses.push('World Class');
        newUnlocks.push('World Class');
      }

      if (newUnlocks.length > 0) {
        transaction.update(userProfileRef, {
          unlockedClasses: unlockedClasses
        });
      }
    });

    return { 
      success: true, 
      message: `Awarded ${amount} XP!`
    };

  } catch (error) {
    console.error("Error awarding XP:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "An error occurred while awarding XP.");
  }
});