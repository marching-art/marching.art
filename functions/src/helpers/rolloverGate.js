/**
 * Corps lifecycle gate for the Fantasy Division's season rollover.
 *
 * History follows the corps (owner direction, 2026-10 — docs/GAMEPLAY.md):
 * a finished season belongs to the corps that played it. The rollover's
 * profile pass (helpers/season.js archiveAndResetProfiles) snapshots every
 * profile, archives each class slot's season onto the corps in that slot, and
 * writes the reset `corps` map back. A director who founds, retires, revives,
 * moves or registers a corps while that pass is running either hands the new
 * corps its predecessor's finished season (the slot changed hands before the
 * snapshot) or has the decision silently overwritten by the stale snapshot
 * (it changed hands after). So lifecycle changes wait for the pass to finish —
 * usually a few minutes, once a season.
 */

const { HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { STALE_LEASE_MS, ROLLOVERS_COLLECTION } = require("./scoringRunGuard");

/**
 * True when a rollover lease is live (claimed, not completed/failed, and not
 * old enough to count as a crashed run). Pure.
 * @param {{ status?: string, startedAt?: any } | null | undefined} lease
 * @param {Date} [now]
 */
function rolloverInProgress(lease, now = new Date()) {
  if (!lease || lease.status !== "running") return false;
  const raw = lease.startedAt;
  const startedAt = raw && typeof raw.toDate === "function" ? raw.toDate() : raw ? new Date(raw) : null;
  if (!startedAt || Number.isNaN(startedAt.getTime())) return true;
  return now.getTime() - startedAt.getTime() < STALE_LEASE_MS;
}

/**
 * Throw `unavailable` while a season rollover is archiving profiles.
 * @param {FirebaseFirestore.Firestore} db
 */
async function assertRolloverSettled(db) {
  let inProgress = false;
  try {
    const running = await db
      .collection(ROLLOVERS_COLLECTION)
      .where("status", "==", "running")
      .limit(5)
      .get();
    inProgress = running.docs.some((doc) => rolloverInProgress(doc.data()));
  } catch (error) {
    // Fail open, like the write-budget guard: a lease read hiccup must never
    // lock every director out of their corps.
    logger.warn(`Rollover gate check failed, allowing action: ${error.message}`);
  }
  if (inProgress) {
    throw new HttpsError(
      "unavailable",
      "Last season is still being archived. Try again in a few minutes."
    );
  }
}

module.exports = { rolloverInProgress, assertRolloverSettled };
