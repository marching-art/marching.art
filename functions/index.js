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
 * Preserves ALL existing functionality while adding new admin features
 * Designed for 10,000+ concurrent users with ultimate efficiency
 */

// === CALLABLE FUNCTIONS ===

// Enhanced lineup management with validation (EXISTING - Keep ALL functions)
exports.lineups = require('./src/callable/lineups');

// User management (EXISTING - Keep ALL functions)
exports.users = require('./src/callable/users');

// Staff management (EXISTING - Keep ALL functions INCLUDING marketplace)  
exports.staff = require('./src/callable/staff');

// EXISTING admin functions (Keep ALL existing functions)
exports.admin = require('./src/admin/initializeStaff');

// === NEW ADMIN FUNCTIONS ===
// Comprehensive admin panel functions for season administration
exports.adminPanel = require('./src/callable/admin');

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
        corps: { alias: "Director", corpsName: "New Corps", corpsClass: "SoundSport" },
        isPublic: true,
        preferences: {
          emailNotifications: true,
          pushNotifications: false
        }
      };

      try {
        await profileRef.set(newUserProfile);
        logger.info(`Profile created for user: ${uid}`);
      } catch (error) {
        logger.error(`Error creating profile for user ${uid}:`, error);
      }
    });
}