const admin = require("firebase-admin");
admin.initializeApp();

// Callable Functions
const {
  checkUsername,
  setUserRole,
  getShowRegistrations,
  getUserRankings,
  migrateUserProfiles,
  createUserProfile,
  dailyRehearsal,
  awardXP,
} = require("./src/callable/users");
const {
  validateAndSaveLineup,
  selectUserShows,
} = require("./src/callable/lineups");
const {
  unlockClassWithCorpsCoin,
  purchaseStaff,
  assignStaff,
  getStaffMarketplace,
} = require("./src/callable/economy");
const { registerCorps } = require("./src/callable/registerCorps");
const {
  createLeague,
  joinLeague,
  leaveLeague,
} = require("./src/callable/leagues");
const {
  sendCommentNotification,
  deleteComment,
  reportComment,
} = require("./src/callable/comments");
const {
  startNewOffSeason,
  startNewLiveSeason,
  manualTrigger,
} = require("./src/callable/admin");

// Scheduled Functions
const { seasonScheduler } = require("./src/scheduled/seasonScheduler");
const {
  dailyOffSeasonProcessor,
  processDailyLiveScores,
  generateWeeklyMatchups,
} = require("./src/scheduled/dailyProcessors");

// Trigger Functions
const {
  processDciScores,
  processLiveScoreRecap,
} = require("./src/triggers/scoreProcessing");


// Export all functions for deployment
module.exports = {
  // Callable
  checkUsername,
  setUserRole,
  getShowRegistrations,
  getUserRankings,
  validateAndSaveLineup,
  selectUserShows,
  createLeague,
  joinLeague,
  leaveLeague,
  sendCommentNotification,
  deleteComment,
  reportComment,
  manualTrigger,
  migrateUserProfiles,
  createUserProfile,
  startNewOffSeason,
  startNewLiveSeason,
  dailyRehearsal,
  awardXP,
  unlockClassWithCorpsCoin,
  purchaseStaff,
  assignStaff,
  getStaffMarketplace,
  registerCorps,

  // Scheduled
  seasonScheduler,
  dailyOffSeasonProcessor,
  processDailyLiveScores,
  generateWeeklyMatchups,

  // Triggers
  processDciScores,
  processLiveScoreRecap,
};
