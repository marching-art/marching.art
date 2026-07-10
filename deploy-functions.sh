#!/bin/bash
# Deploy Cloud Functions in batches to avoid quota errors
# Google Cloud Run has a limit on "Write requests per minute per region"
# (run.googleapis.com/write_regional, WritePerMinutePerProjectRegion).
# Every 2nd-gen (Cloud Run) function deploy costs ~2 regional writes: one
# UpdateFunction on the underlying Cloud Run service plus one SetIamPolicy for
# the public invoker binding. Deploying all ~140 functions at once bursts
# ~280 writes and trips the per-minute quota (INSUFFICIENT_TOKENS), which
# leaves functions half-deployed. This script deploys in small batches with a
# delay between batches so the burst stays under the quota.
#
# The function list is derived from functions/index.js exports at run time,
# so this script cannot drift from what the codebase actually deploys. (The
# previous hand-maintained batch lists had drifted: ~30 exported functions
# were missing and 4 removed ones were still listed, so anything not in a
# batch only ever shipped via a full `firebase deploy --only functions`.)
#
# CI vs. local:
#   - Locally it uses your interactive `firebase login` and installs anything
#     that is missing (Firebase CLI, function deps).
#   - In CI (CI=true, e.g. GitHub Actions) it authenticates with the service
#     account in GOOGLE_APPLICATION_CREDENTIALS and skips the interactive
#     login check and the global install steps the workflow already handled.
#
# Tunables (env-overridable):
#   BATCH_SIZE       functions per `firebase deploy` invocation (default 5)
#   DELAY_SECONDS    pause between batches that actually wrote (default 75)
#   FIREBASE_PROJECT project to deploy to (default marching-art)
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

DELAY_SECONDS="${DELAY_SECONDS:-75}"  # Delay between batches to stay under the Cloud Run write quota
BATCH_SIZE="${BATCH_SIZE:-5}"         # Functions per batch (each deploy = ~2 Cloud Run writes/function)
FIREBASE_PROJECT="${FIREBASE_PROJECT:-marching-art}"

echo "Deploying Cloud Functions to Firebase in batches..."
echo "Project: $FIREBASE_PROJECT"
echo "Batch size: $BATCH_SIZE functions"
echo "Delay between (changed) batches: $DELAY_SECONDS seconds"
echo ""

# In CI the workflow already installed the CLI + deps and provides service
# account credentials via GOOGLE_APPLICATION_CREDENTIALS, so skip the
# interactive login check and the redundant installs.
if [ "${CI:-}" = "true" ]; then
    echo "CI detected: using service account credentials (skipping interactive login/install)."
else
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
fi

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
echo "Estimated max time: ~$ESTIMATED_MINUTES minutes (batches with no changes skip the delay)"
echo ""
echo "NOTE: Score-critical functions are in the first batches (deployed first)"
echo ""

for batch in "${BATCHES[@]}"; do
    CURRENT_BATCH=$((CURRENT_BATCH + 1))

    # Convert comma-separated list to functions: prefix format
    FUNCTIONS_TO_DEPLOY=$(echo "$batch" | sed 's/,/,functions:/g' | sed 's/^/functions:/')

    echo "[$CURRENT_BATCH/$TOTAL_BATCHES] Deploying: $batch"

    # Capture output so we can tell whether the batch actually wrote anything.
    # firebase-tools skips functions whose source hash is unchanged and only
    # prints "Successful create/update/delete operation" for ones it truly
    # deployed — so a batch with no such line consumed no Cloud Run write
    # quota and needs no cooldown before the next batch.
    BATCH_LOG=$(mktemp)
    # Pipe through tee to keep streaming logs while capturing them. The pipe's
    # exit status is tee's (always 0), so read firebase's real status from
    # PIPESTATUS[0] on the very next line before any other command runs.
    firebase deploy --only "$FUNCTIONS_TO_DEPLOY" --force --project "$FIREBASE_PROJECT" 2>&1 | tee "$BATCH_LOG"
    DEPLOY_STATUS=${PIPESTATUS[0]}
    if [ "$DEPLOY_STATUS" -eq 0 ]; then
        echo "  Batch $CURRENT_BATCH completed successfully"
    else
        echo "  Batch $CURRENT_BATCH failed"
        FAILED_BATCHES+=("$batch")
    fi

    if grep -qE "Successful (create|update|delete) operation" "$BATCH_LOG"; then
        BATCH_WROTE=1
    else
        BATCH_WROTE=0
    fi
    rm -f "$BATCH_LOG"

    # Only pause when this batch actually deployed something (and it isn't the
    # last batch). No writes → no quota consumed → no reason to wait.
    if [ $CURRENT_BATCH -lt $TOTAL_BATCHES ]; then
        if [ "$BATCH_WROTE" = "1" ]; then
            echo "  Waiting $DELAY_SECONDS seconds before next batch (staying under the Cloud Run write quota)..."
            sleep $DELAY_SECONDS
        else
            echo "  No changes in this batch; skipping the cooldown."
        fi
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
