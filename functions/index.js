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
  dailyRehearsal,
  awardXP,
} = require("./src/callable/users");
const {
  validateAndSaveLineup,
  saveLineup,
  selectUserShows,
} = require("./src/callable/lineups");
const {
  unlockClassWithCorpsCoin,
  purchaseStaff,
  assignStaff,
  getStaffMarketplace,
} = require("./src/callable/economy");
const {
  dailyRehearsal: execDailyRehearsal,
  repairEquipment,
  upgradeEquipment,
  setShowDifficulty,
  getExecutionStatus,
  boostMorale,
} = require("./src/callable/execution");
const {
  purchaseBattlePass,
  claimBattlePassReward,
  getBattlePassProgress,
  getAvailableRewards,
} = require("./src/callable/battlePass");
const { registerCorps } = require("./src/callable/registerCorps");
const {
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
const { battlePassSeasonRotation } = require("./src/scheduled/battlePassRotation");
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
  dailyRehearsal,
  awardXP,
  unlockClassWithCorpsCoin,
  purchaseStaff,
  assignStaff,
  getStaffMarketplace,
  registerCorps,
  retireCorps,
  unretireCorps,
  execDailyRehearsal,
  repairEquipment,
  upgradeEquipment,
  setShowDifficulty,
  getExecutionStatus,
  boostMorale,
  purchaseBattlePass,
  claimBattlePassReward,
  getBattlePassProgress,
  getAvailableRewards,

  // Scheduled
  seasonScheduler,
  dailyOffSeasonProcessor,
  processDailyLiveScores,
  generateWeeklyMatchups,
  battlePassSeasonRotation,
  updateLifetimeLeaderboard,
  scheduledLifetimeLeaderboardUpdate,

  // Triggers
  processDciScores,
  processLiveScoreRecap,

  // Webhooks
  stripeWebhook,
};
