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
const { battlePassSeasonRotation } = require("./src/scheduled/battlePassRotation");

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

  // Triggers
  processDciScores,
  processLiveScoreRecap,

  // Webhooks
  stripeWebhook,
};
