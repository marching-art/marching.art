'use strict';

const admin = require('firebase-admin');
admin.initializeApp();

/**
 * This is the main entry point for all Firebase Functions.
 * NOTE: Only uncomment exports for files that have been created.
 */

// === CALLABLE FUNCTIONS ===
// Functions that are called directly from the client-side application.
exports.lineups = require('./src/callable/lineups');

// -- To be created later --
exports.users = require('./src/callable/users');
// exports.leagues = require('./src/callable/leagues');
// exports.comments = require('./src/callable/comments');
// exports.staff = require('./src/callable/staff');
// exports.staffMarketplace = require('./src/callable/staffMarketplace');
// exports.staffScoring = require('./src/callable/staffScoring');
// exports.admin = require('./src/callable/admin');


// === TRIGGER FUNCTIONS ===
// Functions that execute in response to an event (e.g., user creation, document write).
exports.authTriggers = require('./src/triggers/auth');

// -- To be created later --
// exports.scoreProcessing = require('./src/triggers/scoreProcessing');


// === SCHEDULED FUNCTIONS ===
// Functions that run on a recurring schedule (cron jobs).

// -- To be created later --
// exports.dailyProcessors = require('./src/scheduled/dailyProcessors');
// exports.seasonScheduler = require('./src/scheduled/seasonScheduler');
// exports.liveScraper = require('./src/scheduled/liveScraper');