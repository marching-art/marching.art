/**
 * User Setup Functions
 * Handles initial user setup and onboarding
 * 
 * Location: functions/src/callable/setup.js
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { DATA_NAMESPACE, getFunctionConfig } = require('../../config');

/**
 * Complete user setup - creates first corps and marks setup as complete
 * This is called from the NewUserSetup component
 */
exports.completeUserSetup = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
    }

    const { corpsName, alias, location, corpsClass } = data;
    const uid = context.auth.uid;

    // Validation
    if (!corpsName || !alias) {
      throw new functions.https.HttpsError('invalid-argument', 'Corps name and alias are required.');
    }

    if (!['SoundSport', 'A Class', 'Open Class', 'World Class'].includes(corpsClass)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid corps class.');
    }

    if (corpsName.length > 50) {
      throw new functions.https.HttpsError('invalid-argument', 'Corps name must be 50 characters or less.');
    }

    if (alias.length > 20) {
      throw new functions.https.HttpsError('invalid-argument', 'Alias must be 20 characters or less.');
    }

    try {
      const db = admin.firestore();
      const profileRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
      
      // Check if profile exists
      const profileSnap = await profileRef.get();
      if (!profileSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found. Please try logging out and back in.');
      }

      const profile = profileSnap.data();

      // Check if already completed setup
      if (profile.hasCompletedSetup) {
        return {
          success: true,
          message: 'Setup already completed',
          alreadyCompleted: true
        };
      }

      // Get current season
      const seasonDoc = await db.doc('game-settings/current').get();
      const currentSeasonId = seasonDoc.exists ? 
        (seasonDoc.data().activeSeasonId || seasonDoc.data().currentSeasonId) : 
        '2025';

      // Create unique corps ID
      const timestamp = Date.now();
      const classSlug = corpsClass.toLowerCase().replace(/\s+/g, '-');
      const corpsId = `${uid}-${classSlug}-${timestamp}`;
      const corpsRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/corps/${corpsId}`);

      // Create corps document with all required fields
      const corpsData = {
        id: corpsId,
        userId: uid,
        corpsName: corpsName.trim(),
        corpsClass: corpsClass,
        alias: alias.trim(),
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
        uniforms: {
          jacket: { baseColor: '#000000', trim1Color: '#FFFFFF', trim2Color: '#FFFFFF', buttonColor: '#FFD700', frontStyle: 'military', collarStyle: 'mandarin' },
          pants: { baseColor: '#000000', stripeColor: '#FFFFFF', style: 'straight' },
          shako: { baseColor: '#000000', plumeColor: '#FFFFFF', badgeColor: '#FFD700', style: 'traditional', plumeStyle: 'plume' },
          accessories: { gauntlets: { enabled: false }, sash: { enabled: false }, epaulets: { enabled: false } }
        }
      };

      // Use batch write for atomicity
      const batch = db.batch();
      
      // Create the corps
      batch.set(corpsRef, corpsData);

      // Update profile with setup completion and first corps reference
      batch.update(profileRef, {
        hasCompletedSetup: true,
        lastActiveCorps: corpsId,
        'corps.corpsName': corpsName.trim(),
        'corps.alias': alias.trim(),
        'corps.location': location ? location.trim() : '',
        'corps.corpsClass': corpsClass,
        'corps.lastEdit': admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });

      // Award initial XP
      const xpTransactionRef = db.collection(`xp_transactions/${uid}/transactions`).doc();
      batch.set(xpTransactionRef, {
        type: 'setup_completion',
        amount: 50,
        description: `Completed initial setup and created ${corpsClass} corps: ${corpsName}`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        seasonId: currentSeasonId
      });

      // Increment XP in profile
      batch.update(profileRef, {
        xp: admin.firestore.FieldValue.increment(50)
      });

      // Commit all changes
      await batch.commit();

      functions.logger.info(`User ${uid} completed setup with corps: ${corpsId} (${corpsClass})`);

      return {
        success: true,
        message: `🎉 Welcome to marching.art! ${corpsName} has been created!`,
        corpsId: corpsId,
        corpsName: corpsName.trim(),
        xpAwarded: 50
      };

    } catch (error) {
      functions.logger.error('Error completing user setup:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', 'Failed to complete setup: ' + error.message);
    }
  });