// @ts-nocheck -- grandfathered when functions checkJs landed (functions/tsconfig.json); remove when this file is typed or cleaned up
const admin = require("firebase-admin");
const { setGlobalOptions } = require("firebase-functions/v2");
admin.initializeApp();

// Configure Firestore to ignore undefined properties
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// App Check enforcement for every callable. `false` = current behavior:
// callables require auth but do not verify App Check attestation. The client
// already attests (src/api/client.ts initializes reCAPTCHA v3 App Check
// "IfConfigured"), so the rollout is: watch the Firebase console's App Check
// metrics for Functions until real traffic shows as verified, then change
// this literal to `true` and run a full deploy — flipping it blind would
// lock out users on stale cached bundles. onRequest endpoints (news feed,
// webhooks, scraper) and event triggers are unaffected either way.
//
// NOTE: deliberately a plain literal, NOT a defineBoolean param. The SDK
// resolves enforceAppCheck during deploy DISCOVERY (params.X.value()
// warnings, once per callable), and the CLI then hard-fails non-interactive
// deploys unless the param has a dotenv value — a params-based flip broke
// the deploy workflow exactly that way. A one-line literal is just as easy
// to flip and can never fail a deploy.
// maxInstances is a spend ceiling: 10 instances x 80 concurrent requests per
// instance is far above real traffic, and per-function options still win where
// a tighter cap matters (the scraper pubsub triggers set maxInstances: 3).
// Scheduled jobs run a single instance regardless.
setGlobalOptions({ enforceAppCheck: false, maxInstances: 10 });

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
} = require("./src/callable/podium");
const {
  setPodiumFoodPlan,
  setPodiumPlanTemplate,
  commitPodiumBudget,
  hirePodiumClinician,
} = require("./src/callable/podiumBudget");
const { hostEvent, getHostingHistory } = require("./src/callable/podiumHost");
const {
  getPodiumState,
  getPodiumRegistrationPreview,
  setPodiumAirfare,
} = require("./src/callable/podiumRoute");
const { retirePodiumCorps, unretirePodiumCorps } = require("./src/callable/podiumLifecycle");
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
} = require("./src/callable/leagues");
const { postLeagueMessage, deleteLeagueMessage } = require("./src/callable/leagueChat");
const {
  updateLeagueSettings,
  transferCommissioner,
  setCoCommissioner,
} = require("./src/callable/leagueAdmin");
const { setLeagueScoringFormat } = require("./src/callable/leagueFormat");
const { removeLeagueMember } = require("./src/callable/leagueRoster");
const {
  recomputeLeagueStandings,
  overrideMatchupResult,
} = require("./src/callable/leagueResults");
const { joinRookieLeague } = require("./src/callable/rookieLeague");
const { joinLeaguePool } = require("./src/callable/leaguePools");
const { completeJourneyStep } = require("./src/callable/journey");
const { purchaseShopItem, equipShopItem } = require("./src/callable/shop");
const { purchaseRetirementPlaque, purchaseHallBanner } = require("./src/callable/prestige");
const { makeLegacyEndowment } = require("./src/callable/legacy");
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
const {
  scoreDropDispatcher,
  podiumNightly,
} = require("./src/scheduled/dropDispatcher");
const { scoringWatchdog } = require("./src/scheduled/scoringWatchdog");
const { scrapeCanary } = require("./src/scheduled/scrapeCanary");
const { pendingApprovalsDigest } = require("./src/scheduled/pendingApprovalsDigest");
const {
  generateWeeklyMatchups,
  generateWeeklyRecaps,
  updateLeagueRivalries,
  triggerMatchupGeneration,
  refreshLeagueActivityJob,
} = require("./src/scheduled/leagueAutomation");
const {
  updateLifetimeLeaderboard,
  scheduledLifetimeLeaderboardUpdate
} = require("./src/scheduled/lifetimeLeaderboard");
const { economyStatsJob } = require("./src/scheduled/economyStats");
const { retentionStatsJob } = require("./src/scheduled/retentionStats");
const {
  scheduledRivalsUpdate,
  updateRivalsNow,
} = require("./src/scheduled/rivalsComputation");
const {
  scheduledScheduleWeather,
  scheduledScheduleWeatherEvening,
  refreshScheduleWeatherNow,
} = require("./src/scheduled/scheduleWeather");
const {
  weeklyDigestEmailJob,
  winBackEmailJob,
  streakBrokenEmailJob,
} = require("./src/scheduled/emailNotifications");
const {
  showReminderPushJob,
  weeklyMatchupPushJob,
  scoreDropPushJob,
  lineupLockReminderPushJob,
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
  publishPressRelease,
  deleteMyPressRelease,
  listPendingSubmissions,
  approveSubmission,
  rejectSubmission,
} = require("./src/triggers/newsGeneration");
const { getSitemapHttp } = require("./src/triggers/sitemap");
const { announceArticleToDiscord } = require("./src/triggers/newsDiscord");
const { getOgCardHttp, getShareHttp } = require("./src/triggers/shareCards");
const { getResultsPageHttp } = require("./src/triggers/resultsPages");
const { getPublicProfilePageHttp } = require("./src/triggers/publicProfilePages");
const {
  onProfileCreated,
  onStreakMilestoneReached,
} = require("./src/triggers/emailTriggers");
const {
  onLeagueMemberJoined,
  onLeagueChatMessage,
} = require("./src/triggers/pushTriggers");
const {
  generateCorpsAvatar,
  regenerateAllAvatars,
  setCorpsAvatarFromUrl,
  adminModerateCorpsAvatar,
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
  makeLegacyEndowment,
  claimLadderTier,
  leaveLeague,
  removeLeagueMember,
  recomputeLeagueStandings,
  overrideMatchupResult,
  updateLeagueSettings,
  transferCommissioner,
  setCoCommissioner,
  setLeagueScoringFormat,
  generateMatchups,
  updateMatchupResults,
  postLeagueMessage,
  deleteLeagueMessage,
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
  setPodiumAirfare,
  setPodiumPlanTemplate,
  commitPodiumBudget,
  hirePodiumClinician,
  getPodiumStaffMarket,
  hirePodiumStaff,
  releasePodiumStaff,
  retrainPodiumStaff,
  acknowledgePodiumStaffOutlook,
  hostEvent,
  getHostingHistory,
  getPodiumState,
  getPodiumRegistrationPreview,
  retirePodiumCorps,
  unretirePodiumCorps,
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
  scoreDropDispatcher,
  podiumNightly,
  scoringWatchdog,
  // Afternoon dci.org markup-drift canary — turns a scraper-breaking site
  // redesign into a 1 PM email instead of a 2 AM scoring incident.
  scrapeCanary,
  // Twice-daily reminder of anything sitting in the moderation queues
  // (pending article submissions, comments awaiting moderation, reported
  // comments) — the safety net behind the immediate per-event admin emails.
  pendingApprovalsDigest,
  updateLifetimeLeaderboard,
  scheduledLifetimeLeaderboardUpdate,
  economyStatsJob,
  retentionStatsJob,

  // Rivals
  scheduledRivalsUpdate,
  updateRivalsNow,

  // Schedule weather (scheduled + admin refresh)
  scheduledScheduleWeather,
  scheduledScheduleWeatherEvening,
  refreshScheduleWeatherNow,

  // League Automation (scheduled)
  generateWeeklyMatchups,
  generateWeeklyRecaps,
  updateLeagueRivalries,
  triggerMatchupGeneration,
  refreshLeagueActivityJob,

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
  // Backs the /sitemap.xml hosting rewrite (firebase.json + vercel.json):
  // static public routes plus one URL per published article. Without this
  // export the rewrite 404s and crawlers lose the sitemap entirely.
  getSitemapHttp,
  // Back the /api/og/** and /share/** hosting rewrites (both hosts): PNG
  // score/champion cards and the share pages whose OG tags social scrapers
  // read. Without these exports every shared link falls back to the static
  // homepage card.
  getOgCardHttp,
  getShareHttp,
  // Backs the /results/** rewrite (both hosts): crawlable server-rendered
  // season/day results pages — the public SEO surface for nightly scores.
  getResultsPageHttp,
  // Backs the /d/** rewrite (both hosts): crawlable server-rendered director
  // pages, so a director's identity is a shareable, indexable URL instead of
  // living behind the auth wall.
  getPublicProfilePageHttp,

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

  // Director Press Releases (instant, un-reviewed community content)
  publishPressRelease,
  deleteMyPressRelease,

  // Email Triggers
  onProfileCreated,
  onStreakMilestoneReached,

  // Push Scheduled Jobs
  showReminderPushJob,
  weeklyMatchupPushJob,
  scoreDropPushJob,
  lineupLockReminderPushJob,

  // Push Triggers
  onLeagueMemberJoined,
  onLeagueChatMessage,

  // Published articles -> Discord #news
  announceArticleToDiscord,

  // Avatar Generation
  generateCorpsAvatar,
  regenerateAllAvatars,
  setCorpsAvatarFromUrl,
  adminModerateCorpsAvatar,

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
