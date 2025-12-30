const admin = require("firebase-admin");
admin.initializeApp();

// Configure Firestore to ignore undefined properties
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// Callable Functions
const {
  checkUsername,
  setUserRole,
  getShowRegistrations,
  getUserRankings,
  migrateUserProfiles,
  createUserProfile,
  dailyXPCheckIn,
  awardXP,
} = require("./src/callable/users");
const {
  validateAndSaveLineup,
  saveLineup,
  selectUserShows,
  saveShowConcept,
  getLineupAnalytics,
  getHotCorps,
} = require("./src/callable/lineups");
const {
  unlockClassWithCorpsCoin,
  getCorpsCoinHistory,
  getEarningOpportunities,
} = require("./src/callable/economy");
const { registerCorps } = require("./src/callable/registerCorps");
const {
  processCorpsDecisions,
  retireCorps,
  unretireCorps,
} = require("./src/callable/corps");
const {
  createLeague,
  joinLeague,
  leaveLeague,
  generateMatchups,
  updateMatchupResults,
  proposeStaffTrade,
  respondToStaffTrade,
  postLeagueMessage,
} = require("./src/callable/leagues");
const {
  sendCommentNotification,
  deleteComment,
  reportComment,
} = require("./src/callable/comments");
const {
  updateProfile,
  getPublicProfile,
} = require("./src/callable/profile");
const {
  claimDailyLogin,
  purchaseStreakFreeze,
  getStreakStatus,
} = require("./src/callable/dailyOps");
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
const {
  updateLifetimeLeaderboard,
  scheduledLifetimeLeaderboardUpdate
} = require("./src/scheduled/lifetimeLeaderboard");

// Trigger Functions
const {
  processDciScores,
  processLiveScoreRecap,
} = require("./src/triggers/scoreProcessing");

// Webhooks
const { stripeWebhook } = require("./src/webhooks/stripe");

// Export all functions for deployment
module.exports = {
  // Callable
  checkUsername,
  setUserRole,
  getShowRegistrations,
  getUserRankings,
  validateAndSaveLineup,
  saveLineup,
  selectUserShows,
  saveShowConcept,
  getLineupAnalytics,
  getHotCorps,
  createLeague,
  joinLeague,
  leaveLeague,
  generateMatchups,
  updateMatchupResults,
  proposeStaffTrade,
  respondToStaffTrade,
  postLeagueMessage,
  sendCommentNotification,
  deleteComment,
  reportComment,
  updateProfile,
  getPublicProfile,
  manualTrigger,
  migrateUserProfiles,
  createUserProfile,
  startNewOffSeason,
  startNewLiveSeason,
  dailyXPCheckIn,
  awardXP,
  unlockClassWithCorpsCoin,
  getCorpsCoinHistory,
  getEarningOpportunities,
  registerCorps,
  processCorpsDecisions,
  retireCorps,
  unretireCorps,
  claimDailyLogin,
  purchaseStreakFreeze,
  getStreakStatus,

  // Scheduled
  seasonScheduler,
  dailyOffSeasonProcessor,
  processDailyLiveScores,
  generateWeeklyMatchups,
  updateLifetimeLeaderboard,
  scheduledLifetimeLeaderboardUpdate,

  // Triggers
  processDciScores,
  processLiveScoreRecap,

  // Webhooks
  stripeWebhook,
};
