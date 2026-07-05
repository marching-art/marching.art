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
  fixProfileFields,
} = require("./src/callable/users");
const {
  validateLineup,
  getActiveLineupKeys,
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
  syncClassUnlocks,
} = require("./src/callable/economy");
const { registerCorps } = require("./src/callable/registerCorps");
const {
  processCorpsDecisions,
  retireCorps,
  unretireCorps,
  transferCorps,
  renameCorps,
} = require("./src/callable/corps");
const {
  detectMyDuplicateCorps,
  sweepDuplicateCorps,
} = require("./src/callable/corpsDuplicates");
const {
  createLeague,
  joinLeague,
  joinLeagueByCode,
  leaveLeague,
  generateMatchups,
  updateMatchupResults,
  postLeagueMessage,
} = require("./src/callable/leagues");
const {
  inviteDirectorToLeague,
  respondToLeagueInvitation,
  rescindLeagueInvitation,
} = require("./src/callable/leagueInvitations");
const {
  sendCommentNotification,
  deleteComment,
  reportComment,
} = require("./src/callable/comments");
const {
  toggleArticleReaction,
  getArticleReactions,
  addArticleComment,
  getArticleComments,
  editArticleComment,
  deleteArticleComment,
  reportArticleComment,
  getArticleEngagement,
} = require("./src/callable/articleComments");
const {
  listCommentsForModeration,
  moderateComment,
  bulkModerateComments,
} = require("./src/callable/commentModeration");
const {
  updateProfile,
  updateUsername,
  updateEmail,
  getPublicProfile,
  deleteAccount,
} = require("./src/callable/profile");
const {
  claimDailyLogin,
  completeDailyChallenge,
  purchaseStreakFreeze,
  getStreakStatus,
} = require("./src/callable/dailyOps");
const {
  startNewOffSeason,
  startNewLiveSeason,
  manualTrigger,
  sendTestEmail,
  scrapeLiveScoresNow,
} = require("./src/callable/admin");
const { searchYoutubeVideo } = require("./src/callable/youtube");

// Scheduled Functions
const { seasonScheduler } = require("./src/scheduled/seasonScheduler");
const {
  dailyOffSeasonProcessor,
  processDailyLiveScores,
} = require("./src/scheduled/dailyProcessors");
const {
  generateWeeklyMatchups,
  generateWeeklyRecaps,
  updateLeagueRivalries,
  triggerMatchupGeneration,
} = require("./src/scheduled/leagueAutomation");
const {
  updateLifetimeLeaderboard,
  scheduledLifetimeLeaderboardUpdate
} = require("./src/scheduled/lifetimeLeaderboard");
const {
  scheduledRivalsUpdate,
  updateRivalsNow,
} = require("./src/scheduled/rivalsComputation");
const {
  weeklyDigestEmailJob,
  winBackEmailJob,
  streakBrokenEmailJob,
} = require("./src/scheduled/emailNotifications");
const {
  showReminderPushJob,
  weeklyMatchupPushJob,
} = require("./src/scheduled/pushNotifications");

// Trigger Functions
const {
  processDciScores,
  processLiveScoreRecap,
  processDciRecap,
} = require("./src/triggers/scoreProcessing");
const { discoverAndQueueUrls } = require("./src/helpers/scraping");

// Live Scraper (1:30 AM - scrapes DCI scores before 2 AM processing)
const { scrapeDciScores } = require("./src/scheduled/liveScraper");
const {
  processNewsGeneration,
  onFantasyRecapUpdated,
  triggerNewsGeneration,
  triggerDailyNews,
  getDailyNews,
  getRecentNews,
  getNewsFeedHttp,
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
  validateLineup,
  getActiveLineupKeys,
  saveLineup,
  selectUserShows,
  saveShowConcept,
  getLineupAnalytics,
  getHotCorps,
  createLeague,
  joinLeague,
  joinLeagueByCode,
  leaveLeague,
  generateMatchups,
  updateMatchupResults,
  postLeagueMessage,
  inviteDirectorToLeague,
  respondToLeagueInvitation,
  rescindLeagueInvitation,
  sendCommentNotification,
  deleteComment,
  reportComment,

  // Article Reactions
  toggleArticleReaction,
  getArticleReactions,

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
  scrapeLiveScoresNow,
  dailyXPCheckIn,
  awardXP,
  fixProfileFields,
  unlockClassWithCorpsCoin,
  getCorpsCoinHistory,
  getEarningOpportunities,
  syncClassUnlocks,
  registerCorps,
  processCorpsDecisions,
  retireCorps,
  unretireCorps,
  transferCorps,
  detectMyDuplicateCorps,
  renameCorps,
  sweepDuplicateCorps,
  claimDailyLogin,
  completeDailyChallenge,
  purchaseStreakFreeze,
  getStreakStatus,

  // Scheduled
  seasonScheduler,
  dailyOffSeasonProcessor,
  processDailyLiveScores,
  updateLifetimeLeaderboard,
  scheduledLifetimeLeaderboardUpdate,

  // Rivals
  scheduledRivalsUpdate,
  updateRivalsNow,

  // League Automation (scheduled)
  generateWeeklyMatchups,
  generateWeeklyRecaps,
  updateLeagueRivalries,
  triggerMatchupGeneration,

  // Email Scheduled Jobs
  weeklyDigestEmailJob,
  winBackEmailJob,
  streakBrokenEmailJob,

  // Triggers
  processDciScores,
  processLiveScoreRecap,
  processDciRecap,

  // Deep scrape (admin: all events / all years)
  discoverAndQueueUrls,

  // Live Scraper (1:30 AM)
  scrapeDciScores,

  // News Generation
  processNewsGeneration,
  onFantasyRecapUpdated,
  triggerNewsGeneration,
  triggerDailyNews,
  getDailyNews,
  getRecentNews,
  // Backs the /api/news hosting rewrite (firebase.json) that gives the news
  // feed CDN caching; without this export the rewrite 404s and every client
  // silently falls back to the slower getRecentNews callable.
  getNewsFeedHttp,

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
  showReminderPushJob,
  weeklyMatchupPushJob,

  // Push Triggers
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
