/**
 * One-time migration: move each historical_scores/{year} document's legacy
 * `data: [events]` array into the per-event subcollection
 * historical_scores/{year}/events/{eventDocId}, then clear the legacy array.
 *
 * Why: a full season of events in one array document approaches Firestore's
 * 1 MiB cap, so the nightly merge would eventually hard-fail mid-season. The
 * write path now stores one small document per event (helpers/historicalScores.js);
 * this backfills the seasons archived before that change.
 *
 * Safe to run against a live season. The read layer (loadHistoricalYear /
 * src/api/season.ts) unions legacy + sharded events with the sharded copy
 * winning, so scoring and the client stay correct at every point during the
 * migration. This script only ever ADDS event docs and clears the (now
 * redundant) legacy array.
 *
 * Idempotent and resumable: an event already present in the subcollection is
 * left untouched (the sharded copy is authoritative), and a year whose legacy
 * array is already empty produces no writes. A crash mid-year loses nothing —
 * re-running writes the remainder and clears the array.
 *
 * Defaults to a dry run; pass --commit to apply:
 *   node src/scripts/migrateHistoricalScoresToSubcollection.js            # report only
 *   node src/scripts/migrateHistoricalScoresToSubcollection.js --commit   # apply writes
 */

// firebase-admin is acquired lazily inside the runner so the pure planner can
// be unit-tested without the Admin SDK / credentials.
const { eventDocId, EVENTS_SUBCOLLECTION } = require("../helpers/historicalScores");

// Firestore batches cap at 500 writes. Each year contributes one event set per
// un-sharded event plus one parent update; flush well under the ceiling.
const BATCH_LIMIT = 400;

/**
 * Plan one year's migration (pure). Given the parent document's data and the
 * set of event-doc ids already present in the subcollection, returns the event
 * docs to write and whether the legacy array should be cleared.
 *
 * @param {Object|undefined} parentData - historical_scores/{year} document data
 * @param {Set<string>} existingEventIds - ids already in the events subcollection
 * @returns {{changed: boolean, eventsToWrite: Array<{id: string, data: Object}>, alreadySharded: number, legacyCount: number}}
 */
function planYear(parentData, existingEventIds) {
  const legacy = (parentData && Array.isArray(parentData.data) && parentData.data) || [];
  const eventsToWrite = [];
  let alreadySharded = 0;

  for (const event of legacy) {
    if (!event || typeof event !== "object") continue;
    const id = eventDocId(event.eventName, event.date);
    if (existingEventIds.has(id)) {
      // Already sharded (a post-deploy scrape wrote a newer copy) — never
      // clobber it with the older legacy row.
      alreadySharded += 1;
      continue;
    }
    eventsToWrite.push({ id, data: event });
  }

  // The array is cleared whenever it held anything, even if every event was
  // already sharded — leaving it populated keeps the year at 1 MiB risk.
  const changed = legacy.length > 0;
  return { changed, eventsToWrite, alreadySharded, legacyCount: legacy.length };
}

async function migrateHistoricalScoresToSubcollection({ dryRun = false } = {}) {
  const admin = require("firebase-admin");
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  const db = admin.firestore();

  const label = dryRun ? "[migrate-historical:dry-run]" : "[migrate-historical]";
  console.log(`${label} Scanning historical_scores year documents...`);

  // listDocuments() also returns "missing" parents that only have subcollections.
  const yearRefs = await db.collection("historical_scores").listDocuments();

  const stats = {
    yearsScanned: 0,
    yearsMigrated: 0,
    eventsWritten: 0,
    eventsAlreadySharded: 0,
  };

  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops === 0) return;
    if (!dryRun) await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  for (const yearRef of yearRefs) {
    stats.yearsScanned += 1;
    const [parentSnap, eventRefs] = await Promise.all([
      yearRef.get(),
      yearRef.collection(EVENTS_SUBCOLLECTION).listDocuments(),
    ]);
    const existingEventIds = new Set(eventRefs.map((r) => r.id));
    const plan = planYear(parentSnap.exists ? parentSnap.data() : undefined, existingEventIds);

    if (!plan.changed) continue;

    stats.yearsMigrated += 1;
    stats.eventsAlreadySharded += plan.alreadySharded;

    for (const { id, data } of plan.eventsToWrite) {
      stats.eventsWritten += 1;
      if (!dryRun) batch.set(yearRef.collection(EVENTS_SUBCOLLECTION).doc(id), data);
      ops += 1;
      if (ops >= BATCH_LIMIT) await flush();
    }

    // Clear the legacy array and stamp the parent (kept so whole-collection
    // reads still enumerate the year). FieldValue.delete removes `data`.
    if (!dryRun) {
      batch.set(
        yearRef,
        { data: admin.firestore.FieldValue.delete(), sharded: true, migratedAt: new Date() },
        { merge: true }
      );
    }
    ops += 1;
    if (ops >= BATCH_LIMIT) await flush();

    console.log(
      `${label} ${yearRef.id}: ${plan.eventsToWrite.length} event(s) ` +
        `${dryRun ? "would be " : ""}sharded` +
        (plan.alreadySharded ? `, ${plan.alreadySharded} already sharded` : "") +
        `; legacy array ${dryRun ? "would be " : ""}cleared.`
    );
  }

  await flush();

  console.log(
    `${label} Done. Scanned ${stats.yearsScanned} year(s); ` +
      `${stats.yearsMigrated} migrated, ${stats.eventsWritten} event(s) ` +
      `${dryRun ? "would be " : ""}written, ${stats.eventsAlreadySharded} already sharded. ✅`
  );
  return stats;
}

module.exports = { migrateHistoricalScoresToSubcollection, planYear };

// Allow running directly: `node migrateHistoricalScoresToSubcollection.js [--commit]`.
if (require.main === module) {
  const dryRun = !process.argv.includes("--commit");
  migrateHistoricalScoresToSubcollection({ dryRun })
    .then((result) => {
      console.log("[migrate-historical] Result:", result);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[migrate-historical] Failed:", err);
      process.exit(1);
    });
}
