#!/bin/bash
# Codify the Firestore disaster-recovery posture: point-in-time recovery
# (PITR) plus scheduled backups. Before this script existed the backup policy
# lived nowhere in the repo — whether the production database could be
# restored after a bad deploy or a runaway script depended on someone having
# clicked the right console buttons once. This makes the policy explicit,
# reviewable, and re-appliable.
#
# What it enables (idempotent — safe to re-run):
#   1. PITR on the default database: continuous 7-day version history, so any
#      moment in the last week can be read or restored (protects against the
#      "bad nightly run corrupted the economy at 2 AM" class of incident).
#   2. A DAILY scheduled backup retained 14 days (fast full-database restore).
#   3. A WEEKLY scheduled backup retained 14 weeks (long-tail history; covers
#      a corruption discovered a season later, e.g. in the historical_scores
#      corpus, which is expensive to re-scrape).
#
# Restore procedures live in docs/OPERATIONS.md — read them BEFORE an
# incident, not during.
#
# Requirements: gcloud >= 468 authenticated with owner/datastore.owner on the
# project. Run: ./scripts/setup-firestore-backups.sh [PROJECT_ID]

set -euo pipefail

PROJECT="${1:-${FIREBASE_PROJECT:-marching-art}}"
DATABASE="(default)"

echo "Project:  $PROJECT"
echo "Database: $DATABASE"
echo

# --- 1. Point-in-time recovery ----------------------------------------------
echo "Enabling point-in-time recovery (7-day version retention)..."
gcloud firestore databases update \
  --project="$PROJECT" \
  --database="$DATABASE" \
  --enable-pitr

# --- 2. Scheduled backups ----------------------------------------------------
# `backups schedules create` is not idempotent, so check what exists first.
existing_schedules=$(gcloud firestore backups schedules list \
  --project="$PROJECT" \
  --database="$DATABASE" \
  --format="value(name,recurrence)" 2>/dev/null || true)

if echo "$existing_schedules" | grep -qi "daily"; then
  echo "Daily backup schedule already exists — leaving it as-is."
else
  echo "Creating DAILY backup schedule (14-day retention)..."
  gcloud firestore backups schedules create \
    --project="$PROJECT" \
    --database="$DATABASE" \
    --recurrence=daily \
    --retention=14d
fi

if echo "$existing_schedules" | grep -qi "weekly"; then
  echo "Weekly backup schedule already exists — leaving it as-is."
else
  echo "Creating WEEKLY backup schedule (14-week retention, Sundays)..."
  gcloud firestore backups schedules create \
    --project="$PROJECT" \
    --database="$DATABASE" \
    --recurrence=weekly \
    --day-of-week=SUN \
    --retention=14w
fi

echo
echo "Current schedules:"
gcloud firestore backups schedules list \
  --project="$PROJECT" \
  --database="$DATABASE"

echo
echo "Done. Verify backups are landing with:"
echo "  gcloud firestore backups list --project=$PROJECT --format='table(name,database,state,snapshotTime,expireTime)'"
echo "Restore procedures: docs/OPERATIONS.md"
