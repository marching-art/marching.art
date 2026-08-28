/**
 * One-time backfill: retire the legacy prose `uniformDesign` (v1) so the equipped
 * Uniform Studio (v2) snapshot is the single source of truth for every corps'
 * look. Run from the Actions tab — see
 * .github/workflows/migrate-uniforms-v1-to-v2.yml.
 *
 * For each corps on each profile (see src/utils/uniformMigration.ts for the pure
 * planner):
 *   - has a v2 `uniform` snapshot  → keep it untouched (v2 is authoritative);
 *     fold in any aiHints the snapshot lacks from the old v1; delete uniformDesign.
 *   - has only a v1 `uniformDesign` → convert it to a v2 design with the SAME
 *     client converter the Studio uses (migrateV1Design), equip the snapshot,
 *     and delete uniformDesign.
 *   - has neither → no change.
 *
 * v2-FIRST: an equipped v2 snapshot is NEVER overwritten by v1 data, so the
 * migration can't clobber a design a director built in the new Studio.
 * Idempotent: a profile with no v1 left produces no writes, so re-running is a
 * safe no-op. Runs as a dry run by default; pass --commit to write.
 *
 *   npx tsx scripts/migrateUniformsV1toV2.mts            # dry run (report only)
 *   npx tsx scripts/migrateUniformsV1toV2.mts --commit   # apply writes
 */

import admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { planUniformMigration } from '../src/utils/uniformMigration';

const DATA_NAMESPACE = process.env.DATA_NAMESPACE || 'marching-art';

// Firestore batches cap at 500 writes; each changed profile is a single update.
const BATCH_LIMIT = 400;

async function migrateUniformsV1toV2({ dryRun = false } = {}) {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  // Defense in depth: the planner already drops undefined from migrated
  // snapshots, but never let a stray undefined abort the whole run.
  db.settings({ ignoreUndefinedProperties: true });

  const label = dryRun ? '[uniform-migrate:dry-run]' : '[uniform-migrate]';
  console.log(`${label} Scanning profiles under artifacts/${DATA_NAMESPACE}/users ...`);

  const snapshot = await db.collectionGroup('profile').get();
  const profiles = snapshot.docs.filter((doc) =>
    doc.ref.path.startsWith(`artifacts/${DATA_NAMESPACE}/users/`)
  );

  const stats = {
    scanned: profiles.length,
    profilesChanged: 0,
    migratedFromV1: 0,
    foldedAiHints: 0,
    droppedV1: 0,
  };

  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops === 0) return;
    if (!dryRun) await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  for (const doc of profiles) {
    const plan = planUniformMigration(doc.data() as { corps?: Record<string, any> });
    if (!plan.changed) continue;

    stats.profilesChanged++;
    stats.migratedFromV1 += plan.migratedFromV1;
    stats.foldedAiHints += plan.foldedAiHints;
    stats.droppedV1 += plan.droppedV1;

    const update: Record<string, unknown> = { ...plan.sets };
    for (const path of plan.deletes) update[path] = FieldValue.delete();

    if (!dryRun) batch.update(doc.ref, update);
    ops++;
    if (ops >= BATCH_LIMIT) await flush();
  }

  await flush();

  console.log(
    `${label} Done. Scanned ${stats.scanned} profile(s); ` +
      `${stats.profilesChanged} changed — ${stats.migratedFromV1} legacy corps migrated to v2, ` +
      `${stats.foldedAiHints} aiHints folded, ${stats.droppedV1} v1 design(s) ` +
      `${dryRun ? 'would be' : ''} retired. ✅`
  );
  return stats;
}

const dryRun = !process.argv.includes('--commit');
migrateUniformsV1toV2({ dryRun })
  .then((result) => {
    console.log('[uniform-migrate] Result:', result);
    process.exit(0);
  })
  .catch((err) => {
    console.error('[uniform-migrate] Failed:', err);
    process.exit(1);
  });
