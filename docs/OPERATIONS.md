# Operations Runbook — backups, restore, and rollback

The game's state lives in one Firestore database: player economy (CorpsCoin,
XP, unlocks), the scraped `historical_scores` corpus (expensive to rebuild),
season archives, and league history. This runbook covers how that data is
protected and how to recover — read it before an incident, not during one.

## Backup posture

Applied by [`scripts/setup-firestore-backups.sh`](../scripts/setup-firestore-backups.sh)
(idempotent; re-run after creating a new project or to verify the policy):

| Layer                          | Cadence    | Retention | Protects against                                                                                     |
| ------------------------------ | ---------- | --------- | ---------------------------------------------------------------------------------------------------- |
| Point-in-time recovery (PITR)  | continuous | 7 days    | Bad nightly run / runaway script — read or restore any microsecond-precision moment in the last week |
| Scheduled backup (daily)       | daily      | 14 days   | Full-database restore after data corruption discovered within two weeks                              |
| Scheduled backup (weekly, Sun) | weekly     | 14 weeks  | Long-tail corruption (e.g. a season archive or `historical_scores` damage noticed a season later)    |

Verify backups are landing (do this after setup, and occasionally):

```bash
gcloud firestore backups list --project=marching-art \
  --format='table(name, database, state, snapshotTime, expireTime)'
```

## Restore procedures

Firestore restores always go **into a new database** — production is never
overwritten in place. That means a restore is a two-phase operation: restore,
then either point the app at the new database or copy documents back.

### A. Restore a scheduled backup

```bash
# 1. Find the backup to restore (note its full name, incl. location)
gcloud firestore backups list --project=marching-art

# 2. Restore it into a NEW database
gcloud firestore databases restore \
  --project=marching-art \
  --source-backup='projects/marching-art/locations/<loc>/backups/<backup-id>' \
  --destination-database=restore-$(date +%Y%m%d)
```

### B. Point-in-time restore (PITR)

For surgical recovery inside the 7-day window — e.g. "the 2 AM scoring run on
the 18th double-paid coins":

```bash
# Clone the database as it existed at an exact moment (UTC)
gcloud firestore databases clone \
  --project=marching-art \
  --source-database='(default)' \
  --snapshot-time='2026-07-18T05:55:00Z' \
  --destination-database=pitr-recovery
```

PITR data can also be **read without restoring** (Admin SDK reads with
`readTime`) to diff exactly what a bad run changed before deciding to
restore — usually the right first move.

### C. After the restore

Pick one, depending on blast radius:

- **Surgical (preferred):** write a one-off script (pattern:
  `functions/src/scripts/`, with `--dry-run` first) that reads the affected
  documents from the restored database and writes corrections back to
  production. Scope stays reviewable; nobody loses unrelated progress.
- **Full swap (catastrophic loss only):** repoint the app (client config,
  functions `getDb()`, rules deploy) at the restored database. Every write
  since the snapshot is lost — treat as a last resort and announce a
  maintenance window first.

Freeze the damage while working: pause scoring by disabling the scheduler
jobs (Cloud Console → Cloud Scheduler) or flipping the relevant
`game-settings/features` kill switch, so the nightly pipeline doesn't build
on top of corrupted state.

## Functions deploy rollback

Every functions deploy (full or single-function) pushes an annotated
`functions-deploy/*` git tag pointing at the exact deployed ref (see
`.github/workflows/deploy-functions.yml`). To roll back a bad deploy:

```bash
git tag -l 'functions-deploy/*' | sort | tail   # find the last good tag
```

Then re-run the **Deploy Functions** workflow (workflow_dispatch) with the
ref set to that tag — workflow_dispatch accepts tags — and the same deploy
target. A bad deploy near the 1:30–2:00 AM ET scoring window should be
rolled back first and diagnosed second; the scoring watchdog (4:30 AM ET,
`scoringWatchdog`) emails admins if the night still failed, and the
`scoring_runs` lease/ledger design makes a re-run after rollback safe
(coin/XP/caption awards are idempotent per day).

## Hosting rollback

- **Vercel:** promote the previous deployment from the Vercel dashboard
  (Deployments → ⋯ → Promote to Production).
- **Firebase Hosting:** `firebase hosting:rollback` (interactive channel
  picker), or redeploy the prior ref.

Frontend rollbacks are low-risk: the service worker's build-stamped
versioning (vite.config.js `closeBundle` plugin) busts caches in both
directions, and `lazyWithRetry` reloads clients holding stale chunk maps.
