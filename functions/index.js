'use strict';

const admin = require('firebase-admin');
admin.initializeApp();

/**
 * This is the main entry point for all Firebase Functions.
 * All functions are organized by category for maximum efficiency and scalability.
 */

// === CALLABLE FUNCTIONS ===
// Functions that are called directly from the client-side application.
exports.lineups = require('./src/callable/lineups');
exports.users = require('./src/callable/users');
exports.staff = require('./src/callable/staff');
// exports.leagues = require('./src/callable/leagues');
// exports.comments = require('./src/callable/comments');
// exports.staffMarketplace = require('./src/callable/staffMarketplace');
// exports.admin = require('./src/callable/admin');
// exports.scoring = require('./src/callable/scoring');

// === TRIGGER FUNCTIONS ===
// Functions that execute in response to an event (e.g., user creation, document write).
exports.authTriggers = require('./src/triggers/auth');
// exports.scoreProcessing = require('./src/triggers/scoreProcessing');
// exports.leagueMatchups = require('./src/triggers/leagueMatchups');

// === SCHEDULED FUNCTIONS ===
// Functions that run on a recurring schedule (cron jobs).
// exports.dailyProcessors = require('./src/scheduled/dailyProcessors');
// exports.seasonScheduler = require('./src/scheduled/seasonScheduler');
// exports.liveScraper = require('./src/scheduled/liveScraper');
// exports.weeklyUpdates = require('./src/scheduled/weeklyUpdates');

// === HTTP FUNCTIONS ===
// Functions accessible via HTTP endpoints
// exports.webhooks = require('./src/http/webhooks');
// exports.api = require('./src/http/api');