/**
 * Migration Script: Strip invite codes off league documents
 *
 * Historically, createLeague stored the league's `inviteCode` directly on the
 * league doc, while firestore.rules deliberately leaves `list` over the
 * leagues collection open to any signed-in user (community widgets). That
 * combination let any authenticated account dump every private league's
 * invite code and join it. Codes are join secrets: they belong only in the
 * backend-only /leagueInvites/{code} mapping (used by joinLeagueByCode) and
 * in the member-only leagues/{id}/meta/private doc (used by the share-code
 * UI).
 *
 * This script, for every league doc carrying an `inviteCode` field:
 *   1. Backfills leagues/{id}/meta/private with { inviteCode } (merge, so an
 *      already-correct doc is never clobbered).
 *   2. Ensures the /leagueInvites/{code} -> { leagueId } mapping exists.
 *   3. Deletes the `inviteCode` field from the league doc.
 *
 * Safe to run multiple times (idempotent — docs without an `inviteCode`
 * field are skipped).
 *
 * Usage:
 *   node stripLeagueInviteCodes.js
 *
 * Or via Firebase Functions shell:
 *   firebase functions:shell
 *   > require('./src/scripts/stripLeagueInviteCodes').stripLeagueInviteCodes()
 */

const admin = require("firebase-admin");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const DATA_NAMESPACE = process.env.DATA_NAMESPACE || "marching-art";

async function stripLeagueInviteCodes() {
  const leaguesPath = `artifacts/${DATA_NAMESPACE}/leagues`;
  console.log(`[strip-codes] Scanning ${leaguesPath} for league docs carrying inviteCode...`);

  const snapshot = await db.collection(leaguesPath).get();
  const targets = snapshot.docs.filter((doc) => doc.get("inviteCode") !== undefined);

  console.log(
    `[strip-codes] Found ${targets.length}/${snapshot.size} league doc(s) with an inviteCode field.`
  );

  if (targets.length === 0) {
    console.log("[strip-codes] Nothing to do. ✅");
    return { scanned: snapshot.size, migrated: 0 };
  }

  // 3 writes per league; stay well under Firestore's 500-write batch limit.
  const BATCH_SIZE = 100;
  let migrated = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = targets.slice(i, i + BATCH_SIZE);
    chunk.forEach((doc) => {
      const inviteCode = doc.get("inviteCode");
      if (typeof inviteCode === "string" && inviteCode) {
        // Member-only home for the share-code UI.
        batch.set(doc.ref.collection("meta").doc("private"), { inviteCode }, { merge: true });
        // Backend-only code -> league mapping (createLeague always wrote this,
        // but ensure it for legacy data so joinLeagueByCode keeps working).
        batch.set(db.doc(`leagueInvites/${inviteCode}`), { leagueId: doc.id }, { merge: true });
      }
      batch.update(doc.ref, { inviteCode: admin.firestore.FieldValue.delete() });
    });
    await batch.commit();
    migrated += chunk.length;
    console.log(`[strip-codes] Migrated ${migrated}/${targets.length} league docs...`);
  }

  console.log(`[strip-codes] Done. Migrated ${migrated} league doc(s). ✅`);
  return { scanned: snapshot.size, migrated };
}

module.exports = { stripLeagueInviteCodes };

// Allow running directly: `node stripLeagueInviteCodes.js`
if (require.main === module) {
  stripLeagueInviteCodes()
    .then((result) => {
      console.log("[strip-codes] Result:", result);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[strip-codes] Failed:", err);
      process.exit(1);
    });
}
