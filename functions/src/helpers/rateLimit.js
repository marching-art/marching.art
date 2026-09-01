// Per-user windowed rate limiting for callables that write user-generated
// content. Same shape as the YouTube search budget (callable/youtube.js
// consumeSearchBudget): a tiny per-uid doc in a server-only collection (no
// client rule matches it) holding { windowStart, count }.

const { logger } = require("firebase-functions/v2");

/**
 * True when a transaction failed because of write contention on the budget
 * doc (Firestore ABORTED after its internal retries). That only happens when
 * one uid fires many calls at once — the burst the budget exists to stop —
 * so contention is treated as "budget spent", not as a bookkeeping failure.
 * @param {any} error
 */
function isContentionError(error) {
  if (!error) return false;
  if (error.code === 10 || error.code === "aborted" || error.code === "ABORTED") return true;
  return /contention|aborted/i.test(String(error.message || ""));
}

/**
 * Consume one unit of a caller's windowed budget, atomically.
 *
 * This used to be a plain read-then-write, on the theory that an interleaved
 * pair of calls could "at worst over-admit by one". It could not: N parallel
 * calls all read the same count before any write landed, so a burst of 200
 * consumed one unit and 200 requests went through. The read + conditional
 * write now run in one transaction (still one small doc read on the hot
 * path). Contention aborts — which only a same-uid burst produces — deny;
 * every other bookkeeping failure still fails open so the throttle can never
 * take a feature down.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} collectionName - Server-only collection holding budget docs.
 * @param {string} uid - The caller (doc id).
 * @param {number} maxPerWindow - Allowed actions per window.
 * @param {number} windowMs - Window length in milliseconds.
 * @returns {Promise<boolean>} true if the action may proceed.
 */
async function consumeRateBudget(db, collectionName, uid, maxPerWindow, windowMs) {
  try {
    const ref = db.collection(collectionName).doc(uid);
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const data = (snap.exists && snap.data()) || {};
      const inWindow =
        typeof data.windowStart === "number" && now - data.windowStart < windowMs;
      const count = inWindow ? data.count || 0 : 0;

      if (count >= maxPerWindow) return false;

      tx.set(ref, {
        windowStart: inWindow ? data.windowStart : now,
        count: count + 1,
        updatedAt: new Date().toISOString(),
      });
      return true;
    });
  } catch (error) {
    if (isContentionError(error)) {
      logger.warn(`Rate-budget contention for ${collectionName}/${uid}; denying burst`);
      return false;
    }
    // Never let the throttle's own bookkeeping break the feature.
    logger.warn("Rate-budget check failed, allowing action:", error);
    return true;
  }
}

module.exports = { consumeRateBudget, isContentionError };
