/**
 * marching.art Firebase Cloud Functions - Complete Index
 * 
 * Location: functions/index.js
 * 
 * This file exports all cloud functions for the marching.art platform
 */

'use strict';

const admin = require('firebase-admin');
const functions = require('firebase-functions');

// Initialize Firebase Admin
admin.initializeApp();

// Import config
const config = require('./config');
const { DATA_NAMESPACE, ADMIN_USER_ID, getFunctionConfig } = config;

/**
 * EXPORTS STRUCTURE:
 * - Scheduled Functions (cron jobs)
 * - Callable Functions (client-invoked)
 * - Trigger Functions (database events)
 */

// ============================================================================
// SCHEDULED FUNCTIONS
// ============================================================================

// Live Score Scraper
const liveScoreScraper = require('./src/scheduled/liveScoreScraper');
exports.scrapeDailyLiveScores = liveScoreScraper.scrapeDailyLiveScores;
exports.triggerManualScrape = liveScoreScraper.triggerManualScrape;

// Score Processor
const scoreProcessor = require('./src/scheduled/scoreProcessor');
exports.processNightlyScores = scoreProcessor.processNightlyScores;
exports.processScoresManually = scoreProcessor.processScoresManually;

// Season Scheduler
const seasonScheduler = require('./src/scheduled/seasonScheduler');
exports.checkSeasonStatus = seasonScheduler.checkSeasonStatus;
exports.initializeSeasonManually = seasonScheduler.initializeSeasonManually;

// Weekly Matchups
exports.generateWeeklyMatchups = functions
  .runWith(getFunctionConfig('light'))
  .pubsub.schedule('0 4 * * 1')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    const logger = functions.logger;
    logger.info('Starting weekly matchup generation...');
    
    const db = admin.firestore();
    const seasonDoc = await db.doc('game-settings/current').get();
    
    if (!seasonDoc.exists) {
      logger.error('No active season found');
      return null;
    }
    
    // TODO: Implement matchup generation logic
    logger.info('Weekly matchups generated successfully');
    return null;
  });

// ============================================================================
// CALLABLE FUNCTIONS - LINEUPS
// ============================================================================

const lineups = require('./src/callable/lineups');
exports.validateAndSaveLineup = lineups.validateAndSaveLineup;
exports.saveLineup = lineups.saveLineup; // Legacy support
exports.getAvailableCorps = lineups.getAvailableCorps;
exports.validateLineupPreview = lineups.validateLineupPreview;
exports.checkLineupValidity = lineups.checkLineupValidity;
exports.getAvailableCorps = lineups.getAvailableCorps;

// ============================================================================
// CALLABLE FUNCTIONS - SHOW REGISTRATION
// ============================================================================

const showRegistration = require('./src/callable/showRegistration');
exports.registerForShow = showRegistration.registerForShow;
exports.unregisterFromShow = showRegistration.unregisterFromShow;
exports.getRegisteredShows = showRegistration.getRegisteredShows;
exports.getShowParticipants = showRegistration.getShowParticipants;

// ============================================================================
// CALLABLE FUNCTIONS - USERS
// ============================================================================

const users = require('./src/callable/users');
exports.updateProfile = users.updateProfile;
exports.updateUniform = users.updateUniform;
exports.updateCorpsInfo = users.updateCorpsInfo;
exports.awardXP = users.awardXP;
exports.checkClassUnlocks = users.checkClassUnlocks;

// ============================================================================
// CALLABLE FUNCTIONS - STAFF
// ============================================================================

const staff = require('./src/callable/staff');
exports.purchaseStaffMember = staff.purchaseStaffMember;
exports.assignStaffToCaption = staff.assignStaffToCaption;
exports.unassignStaffFromCaption = staff.unassignStaffFromCaption;
exports.sellStaffMember = staff.sellStaffMember;
exports.purchaseFromMarketplace = staff.purchaseFromMarketplace;
exports.cancelMarketplaceListing = staff.cancelMarketplaceListing;
exports.updateListingPrice = staff.updateListingPrice;
exports.getUserStaff = staff.getUserStaff;
exports.getAvailableStaff = staff.getAvailableStaff;
exports.getMarketplaceListings = staff.getMarketplaceListings;
exports.getUserMarketplaceListings = staff.getUserMarketplaceListings;

// ============================================================================
// CALLABLE FUNCTIONS - UNIFORMS
// ============================================================================

const uniforms = require('./src/callable/uniforms');
exports.updateUniform = uniforms.updateUniform;
exports.purchaseUniformFeature = uniforms.purchaseFeature;
exports.getUniformUnlockStatus = uniforms.getUnlockStatus;
exports.getUniformFeatureList = uniforms.getFeatureList;

// ============================================================================
// CALLABLE FUNCTIONS - ADMIN
// ============================================================================

const adminPanel = require('./src/callable/admin');
exports.getSystemStats = adminPanel.getSystemStats;
exports.seasonAction = adminPanel.seasonAction;
exports.databaseAction = adminPanel.databaseAction;
exports.userAction = adminPanel.userAction;
exports.staffAction = adminPanel.staffAction;

const adminFunctions = require('./src/admin/initializeStaff');
exports.initializeStaffDatabase = adminFunctions.initializeStaffDatabase;
exports.addStaffMember = adminFunctions.addStaffMember;
exports.getStaffStatistics = adminFunctions.getStaffStatistics;

// ============================================================================
// TRIGGER FUNCTIONS - AUTH
// ============================================================================

const authTriggers = require('./src/triggers/auth');
exports.onUserCreate = authTriggers.onUserCreate;
exports.onUserDelete = authTriggers.onUserDelete;

// ============================================================================
// TRIGGER FUNCTIONS - DATABASE
// ============================================================================

// User Profile Updates
exports.onProfileUpdate = functions.firestore
  .document(`artifacts/${DATA_NAMESPACE}/users/{userId}/profile/data`)
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const userId = context.params.userId;
    
    functions.logger.info(`Profile updated for user: ${userId}`);
    
    // Update lastActive timestamp
    if (beforeData.lastActive !== afterData.lastActive) {
      return null; // Avoid infinite loops
    }
    
    await change.after.ref.update({
      lastActive: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return null;
  });

// Lineup Changes
exports.onLineupChange = functions.firestore
  .document(`artifacts/${DATA_NAMESPACE}/users/{userId}/profile/data`)
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    
    // Check if lineup was updated
    if (JSON.stringify(beforeData.lineup) !== JSON.stringify(afterData.lineup)) {
      const userId = context.params.userId;
      functions.logger.info(`Lineup changed for user: ${userId}`);
      
      // Award XP for lineup updates (limited to prevent abuse)
      const lastLineupUpdate = beforeData.corps?.lastEdit;
      const now = new Date();
      
      if (!lastLineupUpdate || (now - lastLineupUpdate.toDate()) > 3600000) { // 1 hour
        const db = admin.firestore();
        
        await db.collection(`xp_transactions/${userId}/transactions`).add({
          type: 'lineup_update',
          amount: 5,
          description: 'Updated corps lineup',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        await change.after.ref.update({
          xp: admin.firestore.FieldValue.increment(5)
        });
      }
    }
    
    return null;
  });

// Marketplace Activity
exports.onMarketplacePurchase = functions.firestore
  .document('staff_marketplace/{listingId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    
    // Check if listing was purchased (status changed to sold)
    if (beforeData.status === 'active' && afterData.status === 'sold') {
      const listingId = context.params.listingId;
      functions.logger.info(`Marketplace listing sold: ${listingId}`);
      
      // Create notifications for buyer and seller
      const db = admin.firestore();
      const batch = db.batch();
      
      // Seller notification
      const sellerNotifRef = db.collection(`artifacts/${DATA_NAMESPACE}/users/${afterData.sellerId}/notifications`).doc();
      batch.set(sellerNotifRef, {
        type: 'marketplace_sale',
        title: 'Staff Member Sold!',
        message: `Your ${afterData.staffName} was purchased for ${afterData.price} CorpsCoin`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        relatedId: listingId
      });
      
      // Buyer notification
      if (afterData.buyerId) {
        const buyerNotifRef = db.collection(`artifacts/${DATA_NAMESPACE}/users/${afterData.buyerId}/notifications`).doc();
        batch.set(buyerNotifRef, {
          type: 'marketplace_purchase',
          title: 'Purchase Successful!',
          message: `You successfully purchased ${afterData.staffName}`,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          relatedId: listingId
        });
      }
      
      await batch.commit();
    }
    
    return null;
  });

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Health check endpoint for monitoring
 */
exports.healthCheck = functions.https.onRequest((req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'marching.art functions',
    version: '1.0.0'
  });
});

/**
 * Get current season info (public endpoint)
 */
exports.getCurrentSeason = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    try {
      const db = admin.firestore();
      const seasonDoc = await db.doc('game-settings/current').get();
      
      if (!seasonDoc.exists()) {
        return {
          success: false,
          message: 'No active season found'
        };
      }
      
      return {
        success: true,
        season: seasonDoc.data()
      };
    } catch (error) {
      functions.logger.error('Error getting current season:', error);
      throw new functions.https.HttpsError('internal', 'Failed to get current season');
    }
  });

// ============================================================================
// EXPORTS COMPLETE
// ============================================================================

functions.logger.info('marching.art Cloud Functions loaded successfully');