/**
 * Corps Management Functions
 * Handles creating and managing multiple corps per user
 * 
 * Location: functions/src/callable/corps.js
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { DATA_NAMESPACE, getFunctionConfig } = require('../../config'); // FIXED: Changed from ../config

/**
 * Create a new corps for a user
 */
exports.createCorps = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
    }

    const { corpsName, corpsClass, alias, location, seasonId } = data;
    const uid = context.auth.uid;

    // Validation
    if (!corpsName || !corpsClass) {
      throw new functions.https.HttpsError('invalid-argument', 'Corps name and class are required.');
    }

    if (!['SoundSport', 'A Class', 'Open Class', 'World Class'].includes(corpsClass)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid corps class.');
    }

    try {
      const db = admin.firestore();
      const profileRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
      const profileSnap = await profileRef.get();

      if (!profileSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
      }

      const profile = profileSnap.data();

      // Check if user has unlocked this class
      if (!profile.unlockedClasses || !profile.unlockedClasses.includes(corpsClass)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `You haven't unlocked ${corpsClass} yet. Earn more XP to unlock it!`
        );
      }

      // Get current season
      const seasonDoc = await db.doc('game-settings/current').get();
      const currentSeasonId = seasonId || (seasonDoc.exists ? 
        (seasonDoc.data().activeSeasonId || seasonDoc.data().currentSeasonId) : 
        '2025');

      // Create unique corps ID
      const classSlug = corpsClass.toLowerCase().replace(/\s+/g, '');
      const corpsId = `${classSlug}-${currentSeasonId}-${Date.now()}`;
      const corpsRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/corps/${corpsId}`);

      // Create corps document
      await corpsRef.set({
        id: corpsId,
        corpsName: corpsName.trim(),
        corpsClass: corpsClass,
        alias: alias ? alias.trim() : 'Director',
        seasonId: currentSeasonId,
        location: location ? location.trim() : null,
        biography: null,
        showConcept: null,
        
        lineup: {},
        staffAssignments: {},
        registeredShows: [],
        
        uniforms: {
          primaryColor: "#8B4513",
          secondaryColor: "#F7941D",
          textColor: "#FFFFFF",
          style: "traditional"
        },
        
        stats: {
          totalShows: 0,
          totalWins: 0,
          bestScore: 0,
          averageScore: 0,
          seasonRank: 0,
          captionAwards: {}
        },
        
        isActive: true,
        needsSetup: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastEdit: admin.firestore.FieldValue.serverTimestamp()
      });

      // Add to user's active corps list
      await profileRef.update({
        activeCorpsIds: admin.firestore.FieldValue.arrayUnion(corpsId),
        'stats.totalCorpsCreated': admin.firestore.FieldValue.increment(1)
      });

      functions.logger.info(`Created new corps ${corpsId} for user ${uid}`);

      return {
        success: true,
        message: `${corpsName} created successfully!`,
        corpsId: corpsId
      };

    } catch (error) {
      functions.logger.error('Error creating corps:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', 'Failed to create corps.');
    }
  });

/**
 * Update corps information
 */
exports.updateCorps = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
    }

    const { corpsId, updates } = data;
    const uid = context.auth.uid;

    if (!corpsId) {
      throw new functions.https.HttpsError('invalid-argument', 'Corps ID is required.');
    }

    try {
      const db = admin.firestore();
      const corpsRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/corps/${corpsId}`);
      const corpsSnap = await corpsRef.get();

      if (!corpsSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Corps not found.');
      }

      // Validate and sanitize updates
      const allowedFields = ['corpsName', 'alias', 'location', 'biography', 'showConcept', 'uniforms'];
      const sanitizedUpdates = {};

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          sanitizedUpdates[key] = updates[key];
        }
      });

      sanitizedUpdates.lastEdit = admin.firestore.FieldValue.serverTimestamp();

      await corpsRef.update(sanitizedUpdates);

      return {
        success: true,
        message: 'Corps updated successfully!'
      };

    } catch (error) {
      functions.logger.error('Error updating corps:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', 'Failed to update corps.');
    }
  });

/**
 * Get all corps for a user
 */
exports.getUserCorps = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
    }

    const { userId } = data;
    const targetUserId = userId || context.auth.uid;

    try {
      const db = admin.firestore();
      const corpsSnapshot = await db.collection(`artifacts/${DATA_NAMESPACE}/users/${targetUserId}/corps`)
        .where('isActive', '==', true)
        .get();

      const corpsList = [];
      corpsSnapshot.forEach(doc => {
        corpsList.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Sort by class hierarchy
      const classOrder = ['World Class', 'Open Class', 'A Class', 'SoundSport'];
      corpsList.sort((a, b) => classOrder.indexOf(a.corpsClass) - classOrder.indexOf(b.corpsClass));

      return {
        success: true,
        corps: corpsList
      };

    } catch (error) {
      functions.logger.error('Error fetching user corps:', error);
      throw new functions.https.HttpsError('internal', 'Failed to fetch corps.');
    }
  });

/**
 * Delete/retire a corps
 */
exports.retireCorps = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
    }

    const { corpsId } = data;
    const uid = context.auth.uid;

    if (!corpsId) {
      throw new functions.https.HttpsError('invalid-argument', 'Corps ID is required.');
    }

    try {
      const db = admin.firestore();
      const corpsRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/corps/${corpsId}`);
      const corpsSnap = await corpsRef.get();

      if (!corpsSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Corps not found.');
      }

      // Mark as inactive instead of deleting (preserve history)
      await corpsRef.update({
        isActive: false,
        retiredAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Remove from active corps list
      const profileRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
      await profileRef.update({
        activeCorpsIds: admin.firestore.FieldValue.arrayRemove(corpsId)
      });

      return {
        success: true,
        message: 'Corps retired successfully.'
      };

    } catch (error) {
      functions.logger.error('Error retiring corps:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', 'Failed to retire corps.');
    }
  });