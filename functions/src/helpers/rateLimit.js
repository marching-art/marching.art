// Per-user windowed rate limiting for callables that write user-generated
// content. Same shape as the YouTube search budget (callable/youtube.js
// consumeSearchBudget): a tiny per-uid doc in a server-only collection (no
// client rule matches it) holding { windowStart, count }.

const { logger } = require("firebase-functions/v2");

/**
 * Consume one unit of a caller's windowed budget. Plain read-then-write (not
 * a transaction) is deliberate: an interleaved pair of calls can at worst
 * over-admit by one, which is fine for abuse throttling and keeps the hot
 * path at one small doc read.
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
    const snap = await ref.get();
    const now = Date.now();
    const data = snap.exists ? snap.data() : {};
    const inWindow =
      typeof data.windowStart === "number" && now - data.windowStart < windowMs;
    const count = inWindow ? data.count || 0 : 0;

    if (count >= maxPerWindow) return false;

    await ref.set({
      windowStart: inWindow ? data.windowStart : now,
      count: count + 1,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    // Never let the throttle's own bookkeeping break the feature.
    logger.warn("Rate-budget check failed, allowing action:", error);
    return true;
  }
}

module.exports = { consumeRateBudget };
