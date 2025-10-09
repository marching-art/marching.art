/**
 * Show Registration Functions
 * Handles competition registration and management
 * 
 * Location: functions/src/callable/showRegistration.js
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { DATA_NAMESPACE, getFunctionConfig } = require('../../config'); // FIXED: Changed from ../config

/**
 * Register user's corps for a show
 */
exports.registerForShow = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be logged in');
    }

    const { showId, seasonId, corpsId } = data;
    const userId = context.auth.uid;

    if (!showId || !seasonId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Show ID and Season ID are required'
      );
    }

    try {
      const db = admin.firestore();

      // Get user's profile to find their active corps
      const profileRef = db.doc(`artifacts/marching-art/users/${userId}/profile/data`);
      const profileSnap = await profileRef.get();

      // FIXED: Use .exists as property, not function
      if (!profileSnap.exists) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'User profile not found'
        );
      }

      const profileData = profileSnap.data();
      
      // Determine which corps to register
      let corpsToRegister = null;
      
      if (corpsId) {
        // Specific corps ID provided
        corpsToRegister = profileData.corps?.find(c => c.id === corpsId);
      } else if (profileData.activeCorpsId) {
        // Use active corps
        corpsToRegister = profileData.corps?.find(c => c.id === profileData.activeCorpsId);
      } else if (profileData.corps && profileData.corps.length > 0) {
        // Use first corps
        corpsToRegister = profileData.corps[0];
      }

      if (!corpsToRegister) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No corps found to register'
        );
      }

      // Check if lineup exists
      if (!profileData.lineup || Object.keys(profileData.lineup).length === 0) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Please complete your caption selections before registering for shows'
        );
      }

      // Check if already registered
      const existingRegistration = await db.collection('participants')
        .where('userId', '==', userId)
        .where('showId', '==', showId)
        .where('corpsId', '==', corpsToRegister.id)
        .where('seasonId', '==', seasonId)
        .limit(1)
        .get();

      if (!existingRegistration.empty) {
        throw new functions.https.HttpsError(
          'already-exists',
          'You are already registered for this show'
        );
      }

      // Get show details from schedule
      const scheduleRef = db.doc(`schedules/${seasonId}`);
      const scheduleSnap = await scheduleRef.get();

      if (!scheduleSnap.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Schedule not found for this season'
        );
      }

      const scheduleData = scheduleSnap.data();
      const show = scheduleData.competitions?.find(c => c.id === showId);

      if (!show) {
        throw new functions.https.HttpsError(
          'not-found',
          'Show not found in schedule'
        );
      }

      // Check if show has already occurred
      if (show.date) {
        const showDate = show.date.toDate ? show.date.toDate() : new Date(show.date);
        if (showDate < new Date()) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Cannot register for shows that have already occurred'
          );
        }
      }

      // Check class eligibility
      if (show.allowedClasses && !show.allowedClasses.includes(corpsToRegister.corpsClass)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Your ${corpsToRegister.corpsClass} corps is not eligible for this show`
        );
      }

      // Create participant record
      const participantData = {
        userId: userId,
        corpsId: corpsToRegister.id,
        corpsName: corpsToRegister.corpsName,
        corpsClass: corpsToRegister.corpsClass,
        showId: showId,
        seasonId: seasonId,
        lineup: profileData.lineup,
        registeredAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'registered'
      };

      await db.collection('participants').add(participantData);

      functions.logger.info(`User ${userId} registered corps ${corpsToRegister.id} for show ${showId}`);

      return {
        success: true,
        message: `Successfully registered ${corpsToRegister.corpsName} for ${show.name}`
      };

    } catch (error) {
      functions.logger.error('Error registering for show:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal',
        'Failed to register for show: ' + error.message
      );
    }
  });

/**
 * Unregister user's corps from a competition show
 */
exports.unregisterFromShow = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be logged in');
    }

    const { showId, seasonId } = data;
    const userId = context.auth.uid;

    // Validate input
    if (!showId || !seasonId) {
      throw new functions.https.HttpsError('invalid-argument', 'Show ID and Season ID are required');
    }

    try {
      const db = admin.firestore();

      // Find participant record
      const participantsQuery = await db.collection('participants')
        .where('userId', '==', userId)
        .where('showId', '==', showId)
        .where('seasonId', '==', seasonId)
        .get();

      if (participantsQuery.empty) {
        throw new functions.https.HttpsError(
          'not-found',
          'You are not registered for this show'
        );
      }

      // Get show details to check if it's in the past
      const scheduleRef = db.doc(`schedules/${seasonId}`);
      const scheduleSnap = await scheduleRef.get();

      if (scheduleSnap.exists()) {
        const scheduleData = scheduleSnap.data();
        let targetShow = null;

        Object.keys(scheduleData).forEach(weekKey => {
          if (weekKey.startsWith('week')) {
            const shows = scheduleData[weekKey].shows || [];
            const found = shows.find(show => show.id === showId);
            if (found) {
              targetShow = found;
            }
          }
        });

        // Check if show has already occurred
        if (targetShow && targetShow.date) {
          const showDate = targetShow.date.toDate ? targetShow.date.toDate() : new Date(targetShow.date);
          if (showDate < new Date()) {
            throw new functions.https.HttpsError(
              'failed-precondition',
              'Cannot unregister from shows that have already occurred'
            );
          }
        }
      }

      // Delete participant record
      const batch = db.batch();
      participantsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      functions.logger.info(`User ${userId} unregistered from show ${showId}`);

      return {
        success: true,
        message: 'Successfully unregistered from show'
      };

    } catch (error) {
      functions.logger.error('Error unregistering from show:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal',
        'Failed to unregister from show: ' + error.message
      );
    }
  });

/**
 * Get user's registered shows for a season
 */
exports.getRegisteredShows = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be logged in');
    }

    const { seasonId } = data;
    const userId = context.auth.uid;

    if (!seasonId) {
      throw new functions.https.HttpsError('invalid-argument', 'Season ID is required');
    }

    try {
      const db = admin.firestore();

      // Get all participant records for user in this season
      const participantsQuery = await db.collection('participants')
        .where('userId', '==', userId)
        .where('seasonId', '==', seasonId)
        .get();

      const registeredShows = [];
      participantsQuery.docs.forEach(doc => {
        registeredShows.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return {
        success: true,
        shows: registeredShows,
        count: registeredShows.length
      };

    } catch (error) {
      functions.logger.error('Error getting registered shows:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to get registered shows: ' + error.message
      );
    }
  });

/**
 * Get all participants for a specific show
 */
exports.getShowParticipants = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    const { showId, seasonId } = data;

    if (!showId || !seasonId) {
      throw new functions.https.HttpsError('invalid-argument', 'Show ID and Season ID are required');
    }

    try {
      const db = admin.firestore();

      // Get all participants for this show
      const participantsQuery = await db.collection('participants')
        .where('showId', '==', showId)
        .where('seasonId', '==', seasonId)
        .orderBy('corpsClass')
        .orderBy('corpsName')
        .get();

      const participants = [];
      participantsQuery.docs.forEach(doc => {
        participants.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Group by class
      const byClass = {};
      participants.forEach(p => {
        if (!byClass[p.corpsClass]) {
          byClass[p.corpsClass] = [];
        }
        byClass[p.corpsClass].push(p);
      });

      return {
        success: true,
        participants: participants,
        byClass: byClass,
        totalCount: participants.length
      };

    } catch (error) {
      functions.logger.error('Error getting show participants:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to get show participants: ' + error.message
      );
    }
  });

module.exports = {
  registerForShow: exports.registerForShow,
  unregisterFromShow: exports.unregisterFromShow,
  getRegisteredShows: exports.getRegisteredShows,
  getShowParticipants: exports.getShowParticipants
};