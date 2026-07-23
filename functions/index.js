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
  registerPodiumCorps,
  allocateRehearsalBlock,
  setPodiumRestDay,
  setPodiumShows,
  setPodiumFoodPlan,
  setPodiumPlanTemplate,
  commitPodiumBudget,
  hirePodiumClinician,
} = require("./src/callable/podium");
const { hostEvent } = require("./src/callable/podiumHost");
const { getPodiumState, getPodiumRegistrationPreview } = require("./src/callable/podiumRoute");
const {
  getPodiumStaffMarket,
  hirePodiumStaff,
  releasePodiumStaff,
  retrainPodiumStaff,
  acknowledgePodiumStaffOutlook,
} = require("./src/callable/podiumStaff");
const {
  getJointOverlaps,
  proposeJointRehearsal,
  respondJointRehearsal,
  getJointRehearsals,
} = require("./src/callable/podiumJoint");
const { getFanFavorite, castFanFavoriteVote } = require("./src/callable/podiumFan");
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
const { joinRookieLeague } = require("./src/callable/rookieLeague");
const { joinLeaguePool } = require("./src/callable/leaguePools");
const { completeJourneyStep } = require("./src/callable/journey");
const { purchaseShopItem, equipShopItem } = require("./src/callable/shop");
const { purchaseRetirementPlaque, purchaseHallBanner } = require("./src/callable/prestige");
const { claimLadderTier } = require("./src/callable/seasonLadder");
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
  submitPrediction,
  resolvePredictions,
} = require("./src/callable/dailyPredictions");
const {
  startNewOffSeason,
  startNewLiveSeason,
  manualTrigger,
  sendTestEmail,
  scrapeLiveScoresNow,
  backfillLiveScoresForDayRange,
} = require("./src/callable/admin");
const { searchYoutubeVideo, resetYoutubeVideo } = require("./src/callable/youtube");

// Scheduled Functions
const { seasonScheduler } = require("./src/scheduled/seasonScheduler");
const {
  dailyOffSeasonProcessor,
  processDailyLiveScores,
} = require("./src/scheduled/dailyProcessors");
const { scoringWatchdog } = require("./src/scheduled/scoringWatchdog");
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
const { economyStatsJob } = require("./src/scheduled/economyStats");
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
  scoreDropPushJob,
} = require("./src/scheduled/pushNotifications");
const {
  autoPublishScheduledSubmissions,
} = require("./src/scheduled/newsAutoPublish");

// Trigger Functions
const {
  processDciScores,
  processLiveScoreRecap,
  processDciRecap,
} = require("./src/triggers/scoreProcessing");
const { processDciEvent } = require("./src/triggers/scheduleProcessing");
const { discoverAndQueueUrls, discoverAndQueueEventUrls } = require("./src/helpers/scraping");
const { buildLearnedSchedules } = require("./src/helpers/learnedSchedules");
const { getScheduleCoverage } = require("./src/helpers/scheduleCoverage");

// Live Scraper (1:30 AM - scrapes DCI scores before 2 AM processing)
const { scrapeDciScores } = require("./src/scheduled/liveScraper");
const {
  processNewsGeneration,
  onFantasyRecapUpdated,
  triggerNewsGeneration,
  triggerDailyNews,
  triggerSeasonSummary,
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
const {
  bmacWebhook,
  linkBmacSupport,
  setSupporterVisibility,
  setSupporterMessage,
  getSupportersWall,
} = require("./src/callable/supporters");
const { reconcileSupporters } = require("./src/scheduled/supporterReconcile");

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
  joinRookieLeague,
  joinLeaguePool,
  completeJourneyStep,
  purchaseShopItem,
  equipShopItem,
  purchaseRetirementPlaque,
  purchaseHallBanner,
  claimLadderTier,
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
  backfillLiveScoresForDayRange,
  fixProfileFields,
  unlockClassWithCorpsCoin,
  getCorpsCoinHistory,
  getEarningOpportunities,
  syncClassUnlocks,
  registerCorps,
  registerPodiumCorps,
  allocateRehearsalBlock,
  setPodiumRestDay,
  setPodiumShows,
  setPodiumFoodPlan,
  setPodiumPlanTemplate,
  commitPodiumBudget,
  hirePodiumClinician,
  getPodiumStaffMarket,
  hirePodiumStaff,
  releasePodiumStaff,
  retrainPodiumStaff,
  acknowledgePodiumStaffOutlook,
  hostEvent,
  getPodiumState,
  getPodiumRegistrationPreview,
  getJointOverlaps,
  proposeJointRehearsal,
  respondJointRehearsal,
  getJointRehearsals,
  getFanFavorite,
  castFanFavoriteVote,
  processCorpsDecisions,
  retireCorps,
  unretireCorps,
  transferCorps,
  detectMyDuplicateCorps,
  renameCorps,
  sweepDuplicateCorps,
  claimDailyLogin,
  completeDailyChallenge,
  submitPrediction,
  resolvePredictions,
  purchaseStreakFreeze,
  getStreakStatus,

  // Scheduled
  seasonScheduler,
  dailyOffSeasonProcessor,
  processDailyLiveScores,
  scoringWatchdog,
  updateLifetimeLeaderboard,
  scheduledLifetimeLeaderboardUpdate,
  economyStatsJob,

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

  // User-article auto-publish (2 PM ET, trusted authors)
  autoPublishScheduledSubmissions,

  // Triggers
  processDciScores,
  processLiveScoreRecap,
  processDciRecap,
  processDciEvent,

  // Deep scrape (admin: all events / all years)
  discoverAndQueueUrls,
  discoverAndQueueEventUrls,

  // Learned schedules (admin: synthesize running orders for archived events)
  buildLearnedSchedules,
  getScheduleCoverage,

  // Live Scraper (1:30 AM)
  scrapeDciScores,

  // News Generation
  processNewsGeneration,
  onFantasyRecapUpdated,
  triggerNewsGeneration,
  triggerDailyNews,
  triggerSeasonSummary,
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
  scoreDropPushJob,

  // Push Triggers
  onLeagueMemberJoined,
  onLeagueChatMessage,

  // Avatar Generation
  onUniformDesignUpdated,
  generateCorpsAvatar,
  regenerateAllAvatars,

  // YouTube Search
  searchYoutubeVideo,
  resetYoutubeVideo,

  // Buy Me a Coffee supporters
  bmacWebhook,
  linkBmacSupport,
  setSupporterVisibility,
  setSupporterMessage,
  getSupportersWall,
  reconcileSupporters,
};
