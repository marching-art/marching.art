/**
 * Corps Management Functions
 * Handles creating and managing multiple corps per user
 * 
 * Location: functions/src/callable/corps.js
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { DATA_NAMESPACE, getFunctionConfig } = require('../../config');

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
      const unlockedClasses = profile.unlockedClasses || ['SoundSport'];
      if (!unlockedClasses.includes(corpsClass)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `You haven't unlocked ${corpsClass} yet. Earn more XP to unlock it!`
        );
      }

      // Check if user already has a corps in this class
      const existingCorpsQuery = await db.collection(`artifacts/${DATA_NAMESPACE}/users/${uid}/corps`)
        .where('corpsClass', '==', corpsClass)
        .where('isActive', '==', true)
        .get();

      if (!existingCorpsQuery.empty) {
        throw new functions.https.HttpsError(
          'already-exists',
          `You already have a ${corpsClass} corps. You can only have one corps per class.`
        );
      }

      // Check total corps count (max 4)
      const allCorpsQuery = await db.collection(`artifacts/${DATA_NAMESPACE}/users/${uid}/corps`)
        .where('isActive', '==', true)
        .get();

      if (allCorpsQuery.size >= 4) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'You already have 4 corps (maximum). Retire a corps to create a new one.'
        );
      }

      // Get current season
      const seasonDoc = await db.doc('game-settings/current').get();
      const currentSeasonId = seasonId || (seasonDoc.exists ? 
        (seasonDoc.data().activeSeasonId || seasonDoc.data().currentSeasonId) : 
        '2025');

      // Create unique corps ID
      const timestamp = Date.now();
      const classSlug = corpsClass.toLowerCase().replace(/\s+/g, '-');
      const corpsId = `${uid}-${classSlug}-${timestamp}`;
      const corpsRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/corps/${corpsId}`);

      // Create corps document
      const corpsData = {
        id: corpsId,
        userId: uid,
        corpsName: corpsName.trim(),
        corpsClass: corpsClass,
        alias: alias ? alias.trim() : 'Director',
        location: location ? location.trim() : '',
        seasonId: currentSeasonId,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastEdit: admin.firestore.FieldValue.serverTimestamp(),
        stats: {
          totalShows: 0,
          bestScore: 0,
          latestScore: 0,
          seasonRank: 0
        },
        lineup: {},
        staff: {},
        uniforms: {}
      };

      await corpsRef.set(corpsData);

      // If this is the first corps, mark setup as complete
      if (allCorpsQuery.size === 0) {
        await profileRef.update({
          hasCompletedSetup: true,
          lastActiveCorps: corpsId,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        await profileRef.update({
          lastActiveCorps: corpsId,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Award XP for creating corps
      await db.collection(`xp_transactions/${uid}/transactions`).add({
        type: 'corps_creation',
        amount: 25,
        description: `Created ${corpsClass} corps: ${corpsName}`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        seasonId: currentSeasonId
      });

      await profileRef.update({
        xp: admin.firestore.FieldValue.increment(25)
      });

      functions.logger.info(`User ${uid} created new corps: ${corpsId} (${corpsClass})`);

      return {
        success: true,
        message: `🎉 ${corpsName} created successfully! (+25 XP)`,
        corpsId: corpsId,
        xpAwarded: 25
      };

    } catch (error) {
      functions.logger.error('Error creating corps:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', 'Failed to create corps: ' + error.message);
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

    if (!corpsId || !updates) {
      throw new functions.https.HttpsError('invalid-argument', 'Corps ID and updates are required.');
    }

    try {
      const db = admin.firestore();
      const corpsRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/corps/${corpsId}`);
      const corpsSnap = await corpsRef.get();

      if (!corpsSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Corps not found.');
      }

      // Validate and sanitize updates
      const allowedFields = ['corpsName', 'alias', 'location', 'biography', 'showConcept', 'uniforms', 'lineup', 'staff'];
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

      const corpsData = corpsSnap.data();

      // Mark as inactive instead of deleting
      await corpsRef.update({
        isActive: false,
        retiredAt: admin.firestore.FieldValue.serverTimestamp()
      });

      functions.logger.info(`User ${uid} retired corps: ${corpsId}`);

      return {
        success: true,
        message: `${corpsData.corpsName} has been retired.`
      };

    } catch (error) {
      functions.logger.error('Error retiring corps:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', 'Failed to retire corps.');
    }
  });