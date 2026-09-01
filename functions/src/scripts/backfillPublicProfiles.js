/**
 * One-off backfill: write users/{uid}/profile/public for every profile that
 * predates the mirror trigger (triggers/profileMirror.js). Idempotent —
 * re-running rewrites the same projection.
 *
 * Run it (with production credentials) BEFORE flipping profile/data to
 * owner/admin-only in firestore.rules; until every profile has a mirror,
 * league rosters and the other-director profile view fall back to reading
 * profile/data.
 *
 *   node src/scripts/backfillPublicProfiles.js --dry-run
 *   node src/scripts/backfillPublicProfiles.js --commit
 */
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const { paths } = require("../helpers/paths");
const { projectPublicProfile } = require("../helpers/publicProfileMirror");

const BATCH = 400;

async function main() {
  const commit = process.argv.includes("--commit");
  if (!commit && !process.argv.includes("--dry-run")) {
    console.error("Pass --dry-run or --commit");
    process.exit(2);
  }
  const db = admin.firestore();
  const prefix = `${paths.users()}/`;
  let scanned = 0;
  let written = 0;
  let cursor = null;

  for (;;) {
    let query = db
      .collectionGroup("profile")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(BATCH);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    if (snap.empty) break;

    let batch = db.batch();
    let inBatch = 0;
    for (const doc of snap.docs) {
      if (doc.id !== "data" || !doc.ref.path.startsWith(prefix)) continue;
      scanned++;
      const projection = projectPublicProfile(doc.data());
      if (!projection) continue;
      const publicRef = doc.ref.parent.doc("public");
      if (commit) {
        batch.set(publicRef, { ...projection, mirroredAt: new Date().toISOString() });
        inBatch++;
        if (inBatch >= BATCH) {
          await batch.commit();
          batch = db.batch();
          inBatch = 0;
        }
      }
      written++;
    }
    if (commit && inBatch > 0) await batch.commit();

    cursor = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH) break;
  }

  console.log(`${commit ? "Wrote" : "Would write"} ${written} public mirrors (${scanned} profiles scanned).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
