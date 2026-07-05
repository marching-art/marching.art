#!/bin/bash
# Deploy Cloud Functions in batches to avoid quota errors
# Google Cloud Run has a limit on "Write requests per minute per region"
# Deploying all ~110 functions at once exceeds this limit
# This script deploys in batches with delays between batches
#
# The function list is derived from functions/index.js exports at run time,
# so this script cannot drift from what the codebase actually deploys. (The
# previous hand-maintained batch lists had drifted: ~30 exported functions
# were missing and 4 removed ones were still listed, so anything not in a
# batch only ever shipped via a full `firebase deploy --only functions`.)
#
# SCORE PROCESSING TIMELINE (all times Eastern):
#   1:30 AM - scrapeDciScores (scrapes DCI website)
#   2:00 AM - processDailyLiveScores / dailyOffSeasonProcessor (calculates user scores)
#   2:00 AM - processLiveScoreRecap / processDciScores triggers (save to historical_scores)
#   2:00 AM - onFantasyRecapUpdated trigger → processNewsGeneration
#   3:00 AM - seasonScheduler, scheduledLifetimeLeaderboardUpdate
#
# Score-critical functions are pinned to the first batches to minimize
# risk if deploying near the 1:30-2:00 AM window.

set -e

DELAY_SECONDS=75  # Delay between batches to avoid quota errors (Cloud Run: 600 writes/min)
BATCH_SIZE=5      # Functions per batch (each deploy = ~10 write requests)

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

# Install dependencies (also required to `require` index.js below)
echo ""
echo "Installing function dependencies..."
cd functions && npm install && cd ..

# =============================================================================
# FUNCTION LIST: derived from functions/index.js exports
# =============================================================================

ALL_FUNCTIONS=$(cd functions && node -e "console.log(Object.keys(require('./index.js')).join('\n'))")

declare -A IS_EXPORTED
while IFS= read -r fn; do
    IS_EXPORTED[$fn]=1
done <<< "$ALL_FUNCTIONS"

# Score-critical functions, in nightly-pipeline order (see timeline above).
# These deploy first; everything else follows in export order. Names listed
# here must exist in index.js — a stale entry is skipped with a warning.
PRIORITY_FUNCTIONS=(
    scrapeDciScores
    processDailyLiveScores
    dailyOffSeasonProcessor
    processLiveScoreRecap
    processDciScores
    processDciRecap
    onFantasyRecapUpdated
    processNewsGeneration
    triggerNewsGeneration
    triggerDailyNews
    seasonScheduler
    updateLifetimeLeaderboard
    scheduledLifetimeLeaderboardUpdate
    generateWeeklyMatchups
)

ORDERED_FUNCTIONS=()
declare -A QUEUED

for fn in "${PRIORITY_FUNCTIONS[@]}"; do
    if [[ -n "${IS_EXPORTED[$fn]:-}" ]]; then
        ORDERED_FUNCTIONS+=("$fn")
        QUEUED[$fn]=1
    else
        echo "WARNING: priority function '$fn' is not exported by functions/index.js; dropping it from the deploy."
    fi
done

while IFS= read -r fn; do
    if [[ -z "${QUEUED[$fn]:-}" ]]; then
        ORDERED_FUNCTIONS+=("$fn")
    fi
done <<< "$ALL_FUNCTIONS"

# Chunk the ordered list into comma-separated batches of BATCH_SIZE
BATCHES=()
current=""
count=0
for fn in "${ORDERED_FUNCTIONS[@]}"; do
    if [ $count -eq 0 ]; then
        current="$fn"
    else
        current="$current,$fn"
    fi
    count=$((count + 1))
    if [ $count -ge $BATCH_SIZE ]; then
        BATCHES+=("$current")
        current=""
        count=0
    fi
done
if [ -n "$current" ]; then
    BATCHES+=("$current")
fi

TOTAL_BATCHES=${#BATCHES[@]}
CURRENT_BATCH=0
FAILED_BATCHES=()

# Calculate estimated time
ESTIMATED_MINUTES=$(( (TOTAL_BATCHES - 1) * DELAY_SECONDS / 60 ))
echo ""
echo "Starting deployment of ${#ORDERED_FUNCTIONS[@]} functions in $TOTAL_BATCHES batches..."
echo "Estimated time: ~$ESTIMATED_MINUTES minutes"
echo ""
echo "NOTE: Score-critical functions are in the first batches (deployed first)"
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
