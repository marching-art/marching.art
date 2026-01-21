#!/bin/bash
# Deploy Cloud Functions in batches to avoid quota errors
# Google Cloud Run has a limit on "Write requests per minute per region"
# Deploying all ~70 functions at once exceeds this limit
# This script deploys in batches of 4-6 functions with delays between batches
#
# SCORE PROCESSING TIMELINE (all times Eastern):
#   1:30 AM - scrapeDciScores (scrapes DCI website)
#   2:00 AM - processDailyLiveScores / dailyOffSeasonProcessor (calculates user scores)
#   2:00 AM - processLiveScoreRecap / processDciScores triggers (save to historical_scores)
#   2:00 AM - onFantasyRecapUpdated trigger → processNewsGeneration
#   3:00 AM - seasonScheduler, scheduledLifetimeLeaderboardUpdate
#
# Score-critical functions are deployed in the first 3 batches to minimize
# risk if deploying near the 1:30-2:00 AM window.

set -e

DELAY_SECONDS=75  # Delay between batches to avoid quota errors (Cloud Run: 600 writes/min)
BATCH_SIZE=4      # Target number of functions per batch (each deploy = ~10 write requests)

echo "Deploying Cloud Functions to Firebase in batches..."
echo "Batch size: ~$BATCH_SIZE functions"
echo "Delay between batches: $DELAY_SECONDS seconds"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Check if logged in
echo "Checking Firebase authentication..."
firebase login:list

# Install dependencies
echo ""
echo "Installing function dependencies..."
cd functions && npm install && cd ..

# =============================================================================
# BATCH ORDERING: Score-critical functions FIRST
# =============================================================================

# Batch 1: CRITICAL - Score scraping and processing (1:30 AM - 2:00 AM window)
BATCH1="scrapeDciScores,processDailyLiveScores,dailyOffSeasonProcessor,processLiveScoreRecap,processDciScores"

# Batch 2: CRITICAL - Score triggers and news generation
BATCH2="processPaginationPage,onFantasyRecapUpdated,processNewsGeneration,triggerNewsGeneration,triggerDailyNews"

# Batch 3: CRITICAL - Season scheduler and leaderboard (3:00 AM)
BATCH3="seasonScheduler,updateLifetimeLeaderboard,scheduledLifetimeLeaderboardUpdate,generateWeeklyMatchups"

# Batch 4: News functions
BATCH4="getDailyNews,getRecentNews,listAllArticles,getArticleForEdit,updateArticle,archiveArticle"

# Batch 5: More news functions
BATCH5="deleteArticle,submitNewsForApproval"

# Batch 6: Email scheduled jobs
BATCH6="streakAtRiskEmailJob,weeklyDigestEmailJob,winBackEmailJob,streakBrokenEmailJob"

# Batch 7: Push scheduled jobs and triggers
BATCH7="streakAtRiskPushJob,showReminderPushJob,weeklyMatchupPushJob"

# Batch 8: Push triggers
BATCH8="onMatchupCompleted,onTradeProposalCreated,onLeagueMemberJoined,onLeagueChatMessage"

# Batch 9: Email triggers
BATCH9="onProfileCreated,onStreakMilestoneReached"

# Batch 10: User management
BATCH10="checkUsername,setUserRole,getShowRegistrations,getUserRankings,migrateUserProfiles"

# Batch 11: User profile operations
BATCH11="createUserProfile,dailyXPCheckIn,awardXP,updateProfile,getPublicProfile"

# Batch 12: Lineup functions
BATCH12="validateAndSaveLineup,saveLineup,selectUserShows,saveShowConcept,getLineupAnalytics,getHotCorps"

# Batch 13: Economy functions
BATCH13="unlockClassWithCorpsCoin,getCorpsCoinHistory,getEarningOpportunities,registerCorps"

# Batch 14: Corps functions
BATCH14="processCorpsDecisions,retireCorps,unretireCorps"

# Batch 15: League functions part 1
BATCH15="createLeague,joinLeague,leaveLeague,generateMatchups,updateMatchupResults"

# Batch 16: League functions part 2
BATCH16="postLeagueMessage"

# Batch 17: Comments and daily ops
BATCH17="sendCommentNotification,deleteComment,reportComment,claimDailyLogin,purchaseStreakFreeze,getStreakStatus"

# Batch 18: Admin functions and webhook
BATCH18="startNewOffSeason,startNewLiveSeason,manualTrigger,sendTestEmail,stripeWebhook"

# Array of all batches
BATCHES=(
    "$BATCH1"
    "$BATCH2"
    "$BATCH3"
    "$BATCH4"
    "$BATCH5"
    "$BATCH6"
    "$BATCH7"
    "$BATCH8"
    "$BATCH9"
    "$BATCH10"
    "$BATCH11"
    "$BATCH12"
    "$BATCH13"
    "$BATCH14"
    "$BATCH15"
    "$BATCH16"
    "$BATCH17"
    "$BATCH18"
)

TOTAL_BATCHES=${#BATCHES[@]}
CURRENT_BATCH=0
FAILED_BATCHES=()

# Calculate estimated time
ESTIMATED_MINUTES=$(( (TOTAL_BATCHES - 1) * DELAY_SECONDS / 60 ))
echo ""
echo "Starting deployment of $TOTAL_BATCHES batches..."
echo "Estimated time: ~$ESTIMATED_MINUTES minutes"
echo ""
echo "NOTE: Score-critical functions are in batches 1-3 (deployed first)"
echo ""

for batch in "${BATCHES[@]}"; do
    CURRENT_BATCH=$((CURRENT_BATCH + 1))

    # Convert comma-separated list to functions: prefix format
    FUNCTIONS_TO_DEPLOY=$(echo "$batch" | sed 's/,/,functions:/g' | sed 's/^/functions:/')

    echo "[$CURRENT_BATCH/$TOTAL_BATCHES] Deploying: $batch"

    if firebase deploy --only "$FUNCTIONS_TO_DEPLOY" --force; then
        echo "  Batch $CURRENT_BATCH completed successfully"
    else
        echo "  Batch $CURRENT_BATCH failed"
        FAILED_BATCHES+=("$batch")
    fi

    # Add delay between batches (except for the last one)
    if [ $CURRENT_BATCH -lt $TOTAL_BATCHES ]; then
        echo "  Waiting $DELAY_SECONDS seconds before next batch..."
        sleep $DELAY_SECONDS
    fi

    echo ""
done

# Summary
echo "=========================================="
echo "Deployment Summary"
echo "=========================================="
echo "Total batches: $TOTAL_BATCHES"
echo "Successful: $((TOTAL_BATCHES - ${#FAILED_BATCHES[@]}))"
echo "Failed: ${#FAILED_BATCHES[@]}"

if [ ${#FAILED_BATCHES[@]} -gt 0 ]; then
    echo ""
    echo "Failed batches:"
    for failed in "${FAILED_BATCHES[@]}"; do
        echo "  - $failed"
    done
    echo ""
    echo "To retry failed batches, run:"
    for failed in "${FAILED_BATCHES[@]}"; do
        RETRY_CMD=$(echo "$failed" | sed 's/,/,functions:/g' | sed 's/^/functions:/')
        echo "  firebase deploy --only $RETRY_CMD --force"
    done
    exit 1
else
    echo ""
    echo "All functions deployed successfully!"
fi
