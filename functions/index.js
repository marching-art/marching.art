'use strict';

const admin = require('firebase-admin');
admin.initializeApp();

/**
 * This is the main entry point for all Firebase Functions.
 * Export groups are organized by functionality for better organization and cost efficiency.
 */

// === CALLABLE FUNCTIONS ===
// Functions that are called directly from the client-side application.

// Lineup management
exports.lineups = require('./src/callable/lineups');

// User management
exports.users = require('./src/callable/users');

// Staff management (includes marketplace functionality)
exports.staff = require('./src/callable/staff');

// Admin functions
exports.admin = require('./src/admin/initializeStaff');

// -- To be created later --
// exports.leagues = require('./src/callable/leagues');
// exports.comments = require('./src/callable/comments');


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