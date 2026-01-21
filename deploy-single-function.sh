#!/bin/bash
# Deploy a single Cloud Function or a few specific functions
# Usage: ./deploy-single-function.sh functionName1 functionName2 ...
# Example: ./deploy-single-function.sh onLeagueChatMessage onMatchupCompleted

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 functionName1 [functionName2] ..."
    echo "Example: $0 onLeagueChatMessage onMatchupCompleted"
    echo ""
    echo "Available functions:"
    echo ""
    echo "  SCORE CRITICAL (1:30-2:00 AM):"
    echo "    scrapeDciScores, processDailyLiveScores, dailyOffSeasonProcessor"
    echo "    processLiveScoreRecap, processDciScores, processPaginationPage"
    echo ""
    echo "  User: checkUsername, setUserRole, getShowRegistrations, getUserRankings, migrateUserProfiles"
    echo "  Profile: createUserProfile, dailyXPCheckIn, awardXP, updateProfile, getPublicProfile"
    echo "  Lineups: validateAndSaveLineup, saveLineup, selectUserShows, saveShowConcept, getLineupAnalytics, getHotCorps"
    echo "  Economy: unlockClassWithCorpsCoin, getCorpsCoinHistory, getEarningOpportunities, registerCorps"
    echo "  Corps: processCorpsDecisions, retireCorps, unretireCorps"
    echo "  Leagues: createLeague, joinLeague, leaveLeague, generateMatchups, updateMatchupResults, postLeagueMessage"
    echo "  Comments: sendCommentNotification, deleteComment, reportComment"
    echo "  Daily: claimDailyLogin, purchaseStreakFreeze, getStreakStatus"
    echo "  Admin: startNewOffSeason, startNewLiveSeason, manualTrigger, sendTestEmail"
    echo "  Scheduled: seasonScheduler, dailyOffSeasonProcessor, processDailyLiveScores, generateWeeklyMatchups"
    echo "  Scheduled: updateLifetimeLeaderboard, scheduledLifetimeLeaderboardUpdate"
    echo "  Email Jobs: streakAtRiskEmailJob, weeklyDigestEmailJob, winBackEmailJob, streakBrokenEmailJob"
    echo "  Push Jobs: streakAtRiskPushJob, showReminderPushJob, weeklyMatchupPushJob"
    echo "  Triggers: processDciScores, processLiveScoreRecap, processPaginationPage"
    echo "  News: processNewsGeneration, onFantasyRecapUpdated, triggerNewsGeneration, triggerDailyNews"
    echo "  News: getDailyNews, getRecentNews, listAllArticles, getArticleForEdit, updateArticle"
    echo "  News: archiveArticle, deleteArticle, submitNewsForApproval"
    echo "  Email Triggers: onProfileCreated, onStreakMilestoneReached"
    echo "  Push Triggers: onMatchupCompleted, onTradeProposalCreated, onLeagueMemberJoined, onLeagueChatMessage"
    echo "  Webhooks: stripeWebhook"
    exit 1
fi

# Build the functions list
FUNCTIONS=""
for func in "$@"; do
    if [ -z "$FUNCTIONS" ]; then
        FUNCTIONS="functions:$func"
    else
        FUNCTIONS="$FUNCTIONS,functions:$func"
    fi
done

echo "Deploying functions: $@"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Deploy
firebase deploy --only "$FUNCTIONS" --force

if [ $? -eq 0 ]; then
    echo ""
    echo "Deployment successful!"
else
    echo ""
    echo "Deployment failed. Check the errors above."
    exit 1
fi
