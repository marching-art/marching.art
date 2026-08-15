/**
 * One-time backfill: split existing `corps.{class}.seasonHistory` rows into lean
 * summary rows (kept on the profile) + heavy `seasonDetail` docs.
 *
 * Historically every archived season stored its full caption lineup and
 * week-by-week show picks directly on the profile's seasonHistory rows. Those
 * fields are read in exactly one place — a single season's detail panel
 * (src/pages/CorpsHistory.jsx) — yet rode along on every write to the profile
 * document, which sits behind a live client listener (src/store/profileStore.ts).
 * helpers/season.js now writes new seasons pre-split; this script migrates the
 * history that was archived before that change.
 *
 * For each profile it:
 *   1. splits every seasonHistory row via helpers/seasonHistoryRecord.js,
 *   2. writes a `seasonDetail/{seasonId}__{class}` doc for each row that has a
 *      lineup / show picks,
 *   3. rewrites the profile's seasonHistory arrays with the slimmed summaries.
 *
 * Non-destructive: no season is dropped and no summary field is lost — only the
 * heavy fields move, and they are copied to the detail doc before being removed.
 * Idempotent: a profile whose rows are already slim (no heavy fields, `weeks`
 * present) produces no writes, so the script is safe to run repeatedly and to
 * resume after an interruption.
 *
 * Run it from the Actions tab (no console needed) — see
 * .github/workflows/migrate-season-history-detail.yml. It defaults to a dry
 * run; pass --commit (or check "commit" in the workflow) to apply:
 *   node src/scripts/migrateSeasonHistoryDetail.js            # dry run (report only)
 *   node src/scripts/migrateSeasonHistoryDetail.js --commit   # apply writes
 */

// firebase-admin is acquired lazily inside the runner (not at module load) so
// the pure planner below can be unit-tested without the Admin SDK / credentials.
const { seasonDetailId, splitSeasonRecord } = require("../helpers/seasonHistoryRecord");

const DATA_NAMESPACE = process.env.DATA_NAMESPACE || "marching-art";

// Firestore batches cap at 500 writes. Each migrated profile contributes one
// profile update plus one set per detail doc, so stay well under the ceiling.
const BATCH_LIMIT = 400;

/**
 * Plan the split for one profile (pure). Returns the slimmed corps arrays, the
 * detail docs to write, and whether anything actually changed.
 *
 * @param {Object} profileData a profile/data document's data
 * @returns {{changed: boolean, profileUpdate: Object, detailDocs: Array<{id: string, data: Object}>, rowCount: number}}
 */
function planProfile(profileData) {
  const corps = (profileData && profileData.corps) || {};
  const profileUpdate = {};
  const detailDocs = [];
  let changed = false;
  let rowCount = 0;

  for (const [corpsClass, corpsData] of Object.entries(corps)) {
    const history = corpsData && Array.isArray(corpsData.seasonHistory) ? corpsData.seasonHistory : null;
    if (!history || history.length === 0) continue;

    const slimmed = [];
    let classChanged = false;

    for (const row of history) {
      if (!row || typeof row !== "object") {
        slimmed.push(row);
        continue;
      }
      rowCount++;
      const { summary, detail } = splitSeasonRecord(row);
      slimmed.push(summary);

      // Detected a change if a heavy field was extracted or the summary gained
      // fields (e.g. a `weeks` count) the original row lacked.
      if (detail || summaryDiffers(row, summary)) classChanged = true;

      if (detail) {
        const seasonId = row.seasonId || row.seasonName;
        if (!seasonId) {
          // A row with heavy data but no id can't be keyed to a stable detail
          // doc; leave it inline rather than risk a colliding/blank id.
          slimmed[slimmed.length - 1] = row;
          continue;
        }
        detailDocs.push({
          id: seasonDetailId(seasonId, row.corpsClass || corpsClass),
          data: {
            seasonId,
            corpsClass: row.corpsClass || corpsClass,
            ...detail,
            archivedAt: row.archivedAt || null,
          },
        });
      }
    }

    if (classChanged) {
      profileUpdate[`corps.${corpsClass}.seasonHistory`] = slimmed;
      changed = true;
    }
  }

  return { changed, profileUpdate, detailDocs, rowCount };
}

/** Shallow "did the summary drop or add a top-level key" check. */
function summaryDiffers(row, summary) {
  const rowKeys = Object.keys(row);
  const sumKeys = Object.keys(summary);
  if (rowKeys.length !== sumKeys.length) return true;
  return sumKeys.some((k) => !(k in row));
}

async function migrateSeasonHistoryDetail({ dryRun = false } = {}) {
  const admin = require("firebase-admin");
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  const db = admin.firestore();

  const label = dryRun ? "[migrate:dry-run]" : "[migrate]";
  console.log(
    `${label} Scanning profiles under artifacts/${DATA_NAMESPACE}/users for seasonHistory to split...`
  );

  const snapshot = await db.collectionGroup("profile").get();
  const profiles = snapshot.docs.filter((doc) =>
    doc.ref.path.startsWith(`artifacts/${DATA_NAMESPACE}/users/`)
  );

  const stats = {
    scanned: profiles.length,
    profilesChanged: 0,
    detailDocsWritten: 0,
    rowsInspected: 0,
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
    const plan = planProfile(doc.data());
    stats.rowsInspected += plan.rowCount;
    if (!plan.changed) continue;

    stats.profilesChanged++;
    const uid = doc.ref.path.split("/")[3];

    for (const detailDoc of plan.detailDocs) {
      stats.detailDocsWritten++;
      if (!dryRun) {
        batch.set(db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/seasonDetail/${detailDoc.id}`), detailDoc.data);
      }
      ops++;
      if (ops >= BATCH_LIMIT) await flush();
    }

    if (!dryRun) batch.update(doc.ref, plan.profileUpdate);
    ops++;
    if (ops >= BATCH_LIMIT) await flush();
  }

  await flush();

  console.log(
    `${label} Done. Inspected ${stats.rowsInspected} row(s) across ${stats.scanned} profile(s); ` +
      `${stats.profilesChanged} profile(s) slimmed, ${stats.detailDocsWritten} detail doc(s) ` +
      `${dryRun ? "would be" : ""} written. ✅`
  );
  return stats;
}

module.exports = { migrateSeasonHistoryDetail, planProfile };

// Allow running directly: `node migrateSeasonHistoryDetail.js [--commit]`.
// Defaults to a dry run; only --commit writes to Firestore.
if (require.main === module) {
  const dryRun = !process.argv.includes("--commit");
  migrateSeasonHistoryDetail({ dryRun })
    .then((result) => {
      console.log("[migrate] Result:", result);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[migrate] Failed:", err);
      process.exit(1);
    });
}
