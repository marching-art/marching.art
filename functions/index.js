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
  addArticleComment,
  getArticleComments,
  editArticleComment,
  deleteArticleComment,
  reportArticleComment,
  listCommentsForModeration,
  moderateComment,
  bulkModerateComments,
  getArticleEngagement,
} = require("./src/callable/articleComments");
const {
  updateProfile,
  updateUsername,
  updateEmail,
  getPublicProfile,
  deleteAccount,
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
  sendTestEmail,
} = require("./src/callable/admin");
const { searchYoutubeVideo } = require("./src/callable/youtube");

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
const {
  streakAtRiskEmailJob,
  weeklyDigestEmailJob,
  winBackEmailJob,
  streakBrokenEmailJob,
} = require("./src/scheduled/emailNotifications");
const {
  streakAtRiskPushJob,
  showReminderPushJob,
  weeklyMatchupPushJob,
} = require("./src/scheduled/pushNotifications");

// Trigger Functions
const {
  processDciScores,
  processLiveScoreRecap,
  processPaginationPage,
} = require("./src/triggers/scoreProcessing");

// Live Scraper (1:30 AM - scrapes DCI scores before 2 AM processing)
const { scrapeDciScores } = require("./src/scheduled/liveScraper");
const {
  processNewsGeneration,
  onFantasyRecapUpdated,
  triggerNewsGeneration,
  triggerDailyNews,
  getDailyNews,
  getRecentNews,
  listAllArticles,
  getArticleForEdit,
  updateArticle,
  archiveArticle,
  deleteArticle,
  regenerateArticleImage,
  submitNewsForApproval,
  listPendingSubmissions,
  approveSubmission,
  rejectSubmission,
} = require("./src/triggers/newsGeneration");
const {
  onProfileCreated,
  onStreakMilestoneReached,
} = require("./src/triggers/emailTriggers");
const {
  onMatchupCompleted,
  onTradeProposalCreated,
  onLeagueMemberJoined,
  onLeagueChatMessage,
} = require("./src/triggers/pushTriggers");
const {
  onUniformDesignUpdated,
  generateCorpsAvatar,
  regenerateAllAvatars,
} = require("./src/triggers/avatarGeneration");

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

  // Article Comments & Moderation
  addArticleComment,
  getArticleComments,
  editArticleComment,
  deleteArticleComment,
  reportArticleComment,
  listCommentsForModeration,
  moderateComment,
  bulkModerateComments,
  getArticleEngagement,

  updateProfile,
  updateUsername,
  updateEmail,
  getPublicProfile,
  deleteAccount,
  manualTrigger,
  migrateUserProfiles,
  createUserProfile,
  startNewOffSeason,
  startNewLiveSeason,
  sendTestEmail,
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

  // Email Scheduled Jobs
  streakAtRiskEmailJob,
  weeklyDigestEmailJob,
  winBackEmailJob,
  streakBrokenEmailJob,

  // Triggers
  processDciScores,
  processLiveScoreRecap,
  processPaginationPage,

  // Live Scraper (1:30 AM)
  scrapeDciScores,

  // News Generation
  processNewsGeneration,
  onFantasyRecapUpdated,
  triggerNewsGeneration,
  triggerDailyNews,
  getDailyNews,
  getRecentNews,

  // Article Management (Admin)
  listAllArticles,
  getArticleForEdit,
  updateArticle,
  archiveArticle,
  deleteArticle,
  regenerateArticleImage,

  // User News Submissions
  submitNewsForApproval,
  listPendingSubmissions,
  approveSubmission,
  rejectSubmission,

  // Email Triggers
  onProfileCreated,
  onStreakMilestoneReached,

  // Push Scheduled Jobs
  streakAtRiskPushJob,
  showReminderPushJob,
  weeklyMatchupPushJob,

  // Push Triggers
  onMatchupCompleted,
  onTradeProposalCreated,
  onLeagueMemberJoined,
  onLeagueChatMessage,

  // Avatar Generation
  onUniformDesignUpdated,
  generateCorpsAvatar,
  regenerateAllAvatars,

  // Webhooks
  stripeWebhook,

  // YouTube Search
  searchYoutubeVideo,
};
