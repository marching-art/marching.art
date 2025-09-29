'use strict';

const admin = require('firebase-admin');
const functions = require('firebase-functions');

// Initialize Firebase Admin
admin.initializeApp();

// Import config
const config = require('./config');
const { DATA_NAMESPACE, ADMIN_USER_ID, getFunctionConfig } = config;

/**
 * marching.art Firebase Functions - CLEAN DEPLOYMENT
 * Single, consistent naming convention for all functions
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
      logger.error('No active season found.');
      return;
    }
    
    const seasonData = seasonDoc.data();
    const now = new Date();
    const seasonStart = seasonData.startDate.toDate();
    const diffInMillis = now.getTime() - seasonStart.getTime();
    const currentWeek = Math.ceil((Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1) / 7);

    const leaguesSnapshot = await db.collection('leagues').get();
    if (leaguesSnapshot.empty) return;

    const batch = db.batch();
    const corpsClasses = ['worldClass', 'openClass', 'aClass'];

    for (const leagueDoc of leaguesSnapshot.docs) {
      const league = leagueDoc.data();
      const members = league.members || [];
      if (members.length < 2) continue;

      const weeklyMatchupData = {
        week: currentWeek,
        seasonId: seasonData.activeSeasonId
      };

      const profilePromises = members.map(uid => 
        db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`).get()
      );
      const profileDocs = await Promise.all(profilePromises);

      for (const corpsClass of corpsClasses) {
        const eligibleMembers = profileDocs
          .filter(pDoc => pDoc.exists() && pDoc.data().corps && pDoc.data().corps[corpsClass])
          .map(pDoc => pDoc.ref.parent.parent.id);

        if (eligibleMembers.length < 2) continue;

        const shuffledMembers = [...eligibleMembers].sort(() => 0.5 - Math.random());
        const matchups = [];
        
        while (shuffledMembers.length > 1) {
          const p1 = shuffledMembers.pop();
          const p2 = shuffledMembers.pop();
          matchups.push({ pair: [p1, p2], scores: { [p1]: 0, [p2]: 0 }, winner: null });
        }
        
        if (shuffledMembers.length === 1) {
          const p = shuffledMembers.pop();
          matchups.push({ pair: [p, 'BYE'], scores: { [p]: 0 }, winner: p });
        }

        weeklyMatchupData[`${corpsClass}Matchups`] = matchups;
      }

      const matchupDocRef = db.doc(`leagues/${leagueDoc.id}/matchups/week${currentWeek}`);
      batch.set(matchupDocRef, weeklyMatchupData);
    }

    await batch.commit();
    logger.info('Weekly matchup generation complete.');
  });

// ============================================================================
// CALLABLE FUNCTIONS - LINEUPS
// ============================================================================

const lineups = require('./src/callable/lineups');
exports.saveLineup = lineups.saveLineup;
exports.validateAndSaveLineup = lineups.validateAndSaveLineup;
exports.checkLineupValidity = lineups.checkLineupValidity;
exports.getAvailableCorps = lineups.getAvailableCorps;

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
exports.awardXPTrigger = authTriggers.awardXP;

// ============================================================================
// ENHANCED USER CREATION
// ============================================================================

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
      corpsCoin: 1000,
      unlockedClasses: ['SoundSport', 'A Class'],
      corps: {
        corpsName: 'New Corps',
        corpsClass: 'SoundSport',
        alias: 'Director'
      },
      isPublic: true,
      preferences: {
        emailNotifications: true,
        pushNotifications: false
      },
      trophies: {
        regionals: [],
        championships: [],
        finalistMedals: []
      },
      achievements: [],
      seasonHistory: {}
    };

    try {
      await profileRef.set(newUserProfile);
      logger.info(`Profile created for user: ${uid}`);
    } catch (error) {
      logger.error(`Error creating profile for user ${uid}:`, error);
    }
  });