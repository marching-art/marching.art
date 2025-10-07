/**
 * Show Registration Functions
 * Handles competition registration and management
 * 
 * Location: functions/src/callable/showRegistration.js
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { DATA_NAMESPACE, getFunctionConfig } = require('../../config');

/**
 * Register user's corps for a competition show
 */
exports.registerForShow = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to register for shows');
    }

    const { showId, seasonId } = data;
    const userId = context.auth.uid;

    // Validate input
    if (!showId || !seasonId) {
      throw new functions.https.HttpsError('invalid-argument', 'Show ID and Season ID are required');
    }

    try {
      const db = admin.firestore();

      // Get user profile
      const profileRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${userId}/profile/data`);
      const profileSnap = await profileRef.get();

      if (!profileSnap.exists()) {
        throw new functions.https.HttpsError('not-found', 'User profile not found');
      }

      const profile = profileSnap.data();

      // Validate corps setup
      if (!profile.corps || !profile.corps.corpsName || profile.corps.corpsName === 'New Corps') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Please complete your corps setup before registering for shows'
        );
      }

      // Get show details
      const scheduleRef = db.doc(`schedules/${seasonId}`);
      const scheduleSnap = await scheduleRef.get();

      if (!scheduleSnap.exists()) {
        throw new functions.https.HttpsError('not-found', 'Schedule not found');
      }

      const scheduleData = scheduleSnap.data();
      let targetShow = null;

      // Find the show in the schedule
      Object.keys(scheduleData).forEach(weekKey => {
        if (weekKey.startsWith('week')) {
          const shows = scheduleData[weekKey].shows || [];
          const found = shows.find(show => show.id === showId);
          if (found) {
            targetShow = found;
          }
        }
      });

      if (!targetShow) {
        throw new functions.https.HttpsError('not-found', 'Show not found in schedule');
      }

      // Validate class eligibility
      if (targetShow.classes && !targetShow.classes.includes(profile.corps.corpsClass)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Your corps class (${profile.corps.corpsClass}) is not eligible for this show`
        );
      }

      // Check if show is in the past
      if (targetShow.date) {
        const showDate = targetShow.date.toDate ? targetShow.date.toDate() : new Date(targetShow.date);
        if (showDate < new Date()) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Cannot register for shows that have already occurred'
          );
        }
      }

      // Check if already registered
      const existingQuery = await db.collection('participants')
        .where('userId', '==', userId)
        .where('showId', '==', showId)
        .where('seasonId', '==', seasonId)
        .get();

      if (!existingQuery.empty) {
        throw new functions.https.HttpsError(
          'already-exists',
          'You are already registered for this show'
        );
      }

      // Create participant record
      const participantData = {
        userId: userId,
        showId: showId,
        seasonId: seasonId,
        corpsId: profile.corps.corpsId || userId,
        corpsName: profile.corps.corpsName,
        corpsClass: profile.corps.corpsClass,
        alias: profile.corps.alias || profile.displayName,
        registeredAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'registered'
      };

      await db.collection('participants').add(participantData);

      // Log the registration
      functions.logger.info(`User ${userId} registered for show ${showId}`);

      // Award XP for registration
      await db.collection(`xp_transactions/${userId}/transactions`).add({
        type: 'show_registration',
        amount: 10,
        description: `Registered for ${targetShow.eventName}`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        seasonId: seasonId
      });

      // Update user XP
      await profileRef.update({
        xp: admin.firestore.FieldValue.increment(10)
      });

      return {
        success: true,
        message: `Successfully registered for ${targetShow.eventName}!`,
        xpAwarded: 10
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