/**
 * Cleanup Script: Remove leaked email addresses from public profile docs
 *
 * Historically, `updateEmail` wrote the user's email into the world-readable
 * `profile/data` document (in addition to the owner-private `private/data`
 * doc). This script deletes the `email` field from every public profile doc,
 * removing already-leaked addresses. The email remains available in
 * `private/data`, so no data is lost.
 *
 * Safe to run multiple times (idempotent — docs without an `email` field are
 * skipped).
 *
 * Usage:
 *   node cleanupLeakedProfileEmails.js
 *
 * Or via Firebase Functions shell:
 *   firebase functions:shell
 *   > require('./src/scripts/cleanupLeakedProfileEmails').cleanupLeakedProfileEmails()
 */

const admin = require("firebase-admin");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const DATA_NAMESPACE = process.env.DATA_NAMESPACE || "marching-art";

async function cleanupLeakedProfileEmails() {
  console.log(
    `[cleanup] Scanning public profile docs under artifacts/${DATA_NAMESPACE}/users for leaked email fields...`
  );

  // Collection-group query over every `profile/data` doc.
  const snapshot = await db.collectionGroup("profile").get();

  const targets = snapshot.docs.filter(
    (doc) =>
      doc.ref.path.startsWith(`artifacts/${DATA_NAMESPACE}/users/`) &&
      doc.get("email") !== undefined
  );

  console.log(
    `[cleanup] Found ${targets.length} profile doc(s) containing an email field.`
  );

  if (targets.length === 0) {
    console.log("[cleanup] Nothing to do. ✅");
    return { scanned: snapshot.size, cleaned: 0 };
  }

  // Firestore batches are limited to 500 writes.
  const BATCH_SIZE = 400;
  let cleaned = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = targets.slice(i, i + BATCH_SIZE);
    chunk.forEach((doc) => {
      batch.update(doc.ref, { email: admin.firestore.FieldValue.delete() });
    });
    await batch.commit();
    cleaned += chunk.length;
    console.log(`[cleanup] Removed email from ${cleaned}/${targets.length} docs...`);
  }

  console.log(`[cleanup] Done. Cleaned ${cleaned} profile doc(s). ✅`);
  return { scanned: snapshot.size, cleaned };
}

module.exports = { cleanupLeakedProfileEmails };

// Allow running directly: `node cleanupLeakedProfileEmails.js`
if (require.main === module) {
  cleanupLeakedProfileEmails()
    .then((result) => {
      console.log("[cleanup] Result:", result);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[cleanup] Failed:", err);
      process.exit(1);
    });
}
