'use strict';

const admin = require('firebase-admin');
const functions = require('firebase-functions');

// Import config with fallback if file doesn't exist
let config = {};
try {
  config = require('./config');
} catch (e) {
  // Fallback configuration if config.js doesn't exist
  config = {
    DATA_NAMESPACE: 'marching-art',
    ADMIN_USER_ID: 'o8vfRCOevjTKBY0k2dISlpiYiIH2',
    getFunctionConfig: (type) => ({
      timeoutSeconds: type === 'heavy' ? 540 : type === 'light' ? 60 : 180,
      memory: type === 'heavy' ? '1GB' : type === 'light' ? '256MB' : '512MB'
    })
  };
}

const { DATA_NAMESPACE, ADMIN_USER_ID, getFunctionConfig } = config;

admin.initializeApp();

/**
 * marching.art Firebase Functions - Complete System
 * Preserves ALL existing functionality while adding new features
 */

// === CALLABLE FUNCTIONS ===

// Enhanced lineup management with validation (ENHANCED EXISTING)
exports.lineups = require('./src/callable/lineups');

// User management (EXISTING - Keep ALL functions)
exports.users = require('./src/callable/users');

// Staff management (EXISTING - Keep ALL functions INCLUDING marketplace)  
exports.staff = require('./src/callable/staff');

// Admin functions (EXISTING - Keep ALL functions)
exports.admin = require('./src/admin/initializeStaff');

// === TRIGGER FUNCTIONS ===

// Authentication triggers (EXISTING - Keep ALL functions)
exports.authTriggers = require('./src/triggers/auth');

// === SCHEDULED FUNCTIONS ===

// NEW: Core game engine functions (ADD to existing)
// Only include if files exist
try {
  exports.scoreProcessor = require('./src/scheduled/scoreProcessor');
} catch (e) {
  console.log('scoreProcessor not found, skipping');
}

try {
  exports.seasonScheduler = require('./src/scheduled/seasonScheduler');
} catch (e) {
  console.log('seasonScheduler not found, skipping');
}

// === ENHANCED FUNCTIONS (if config exists) ===

if (typeof getFunctionConfig === 'function') {
  /**
   * Enhanced user creation with proper configuration
   */
  exports.onUserCreateEnhanced = functions
    .runWith(getFunctionConfig('light'))
    .auth.user().onCreate(async (user) => {
      const { uid, email } = user;
      const logger = functions.logger;

      const profileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);

      const newUserProfile = {
        email: email,
        displayName: email.split('@')[0],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        activeSeasonId: null,
        totalSeasonScore: 0,
        xp: 0,
        corpsCoin: 1000, // Starting CorpsCoin
        unlockedClasses: ["SoundSport", "A Class"],
        corps: { alias: "Director", corpsName: "New Corps", class: "SoundSport" },
        lineup: {},
        selectedShows: {},
        uniform: { 
          base: "#ffffff", 
          style: "solid", 
          colors: { primary: "#000000", secondary: "#cccccc", accent: "#ff0000" } 
        },
        blockedUsers: [],
        isPublic: true,
        lastUpdatedShowScoring: new Date(0),
      };

      try {
        await profileRef.set(newUserProfile);
        logger.info(`Successfully created enhanced profile for user: ${uid}`);
      } catch (error) {
        logger.error(`Error creating enhanced profile for user: ${uid}`, error);
      }
    });

  /**
   * Initialize new season (admin only) - Enhanced version
   */
  exports.initializeSeasonEnhanced = functions
    .runWith(getFunctionConfig('standard'))
    .https.onCall(async (data, context) => {
      // Verify admin access
      if (!context.auth?.token?.admin && context.auth?.uid !== ADMIN_USER_ID) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Admin access required'
        );
      }
      
      try {
        const startDate = data.startDate ? new Date(data.startDate) : new Date();
        const seasonId = `season_${startDate.getFullYear()}_${startDate.getMonth() + 1}`;
        
        // Initialize season with enhanced features
        const gameSettingsRef = admin.firestore().collection('game-settings').doc('current');
        await gameSettingsRef.set({
          currentSeasonId: seasonId,
          seasonStartDate: admin.firestore.Timestamp.fromDate(startDate),
          currentWeek: 1,
          seasonType: 'live',
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Create season corps data structure
        const seasonCorpsRef = admin.firestore().collection('dci-data').doc(seasonId);
        await seasonCorpsRef.set({
          seasonId: seasonId,
          corps: [], // Will be populated by season scheduler
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return {
          success: true,
          message: 'Season initialized successfully with enhanced features',
          seasonId: seasonId
        };
        
      } catch (error) {
        functions.logger.error('Error initializing enhanced season:', error);
        throw new functions.https.HttpsError('internal', 'Failed to initialize season');
      }
    });
}