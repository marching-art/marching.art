#!/bin/bash
# Deploy Cloud Functions in batches to avoid quota errors
# Google Cloud Run has a limit on "Write requests per minute per region"
# Deploying all ~70 functions at once exceeds this limit
# This script deploys in batches of 5-8 functions with delays between batches

set -e

DELAY_SECONDS=60  # Delay between batches to avoid quota errors
BATCH_SIZE=5      # Number of functions per batch

echo "Deploying Cloud Functions to Firebase in batches..."
echo "Batch size: $BATCH_SIZE functions"
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

# Define function batches (grouped logically)
# Batch 1: User management
BATCH1="checkUsername,setUserRole,getShowRegistrations,getUserRankings,migrateUserProfiles"

# Batch 2: User profile operations
BATCH2="createUserProfile,dailyXPCheckIn,awardXP,updateProfile,getPublicProfile"

# Batch 3: Lineup functions
BATCH3="validateAndSaveLineup,saveLineup,selectUserShows,saveShowConcept,getLineupAnalytics,getHotCorps"

# Batch 4: Economy functions
BATCH4="unlockClassWithCorpsCoin,getCorpsCoinHistory,getEarningOpportunities,registerCorps"

# Batch 5: Corps functions
BATCH5="processCorpsDecisions,retireCorps,unretireCorps"

# Batch 6: League functions part 1
BATCH6="createLeague,joinLeague,leaveLeague,generateMatchups,updateMatchupResults"

# Batch 7: League functions part 2
BATCH7="proposeStaffTrade,respondToStaffTrade,postLeagueMessage"

# Batch 8: Comments and daily ops
BATCH8="sendCommentNotification,deleteComment,reportComment,claimDailyLogin,purchaseStreakFreeze,getStreakStatus"

# Batch 9: Admin functions
BATCH9="startNewOffSeason,startNewLiveSeason,manualTrigger,sendTestEmail"

# Batch 10: Scheduled functions
BATCH10="seasonScheduler,dailyOffSeasonProcessor,processDailyLiveScores,generateWeeklyMatchups"

# Batch 11: Leaderboard and email scheduled
BATCH11="updateLifetimeLeaderboard,scheduledLifetimeLeaderboardUpdate,streakAtRiskEmailJob,weeklyDigestEmailJob"

# Batch 12: More email scheduled
BATCH12="winBackEmailJob,streakBrokenEmailJob"

# Batch 13: Score processing triggers
BATCH13="processDciScores,processLiveScoreRecap"

# Batch 14: News generation
BATCH14="processNewsGeneration,onFantasyRecapUpdated,triggerNewsGeneration,triggerDailyNews,getDailyNews,getRecentNews"

# Batch 15: Article management
BATCH15="listAllArticles,getArticleForEdit,updateArticle,archiveArticle,deleteArticle,submitNewsForApproval"

# Batch 16: Email triggers
BATCH16="onProfileCreated,onStreakMilestoneReached"

# Batch 17: Push scheduled jobs
BATCH17="streakAtRiskPushJob,showReminderPushJob,weeklyMatchupPushJob"

# Batch 18: Push triggers and webhooks
BATCH18="onMatchupCompleted,onTradeProposalCreated,onLeagueMemberJoined,onLeagueChatMessage,stripeWebhook"

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

echo ""
echo "Starting deployment of $TOTAL_BATCHES batches..."
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
