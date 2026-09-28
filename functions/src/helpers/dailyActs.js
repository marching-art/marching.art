/**
 * Daily-act stamps — the per-day proof behind the stamped daily challenges.
 *
 * A reaction, a like, or a chat message leaves no per-day trace a challenge
 * verifier could read cheaply, so the callable that performs the act records
 * today's game day on the director's profile at `engagement.dailyActs.<act>`.
 * The `engagement` map is server-only (firestore.rules
 * touchesProtectedProfileFields), so a stamp can only come from here. See
 * DAILY_ACTS / didDailyAct in helpers/dailyChallenges.js for the read side.
 */

const { logger } = require("firebase-functions/v2");
const { paths } = require("./paths");
const { DAILY_ACTS, getGameDay } = require("./dailyChallenges");

/** @type {Set<string>} */
const KNOWN_ACTS = new Set(Object.values(DAILY_ACTS));

/**
 * The profile field update that records `act` for the current game day.
 * @param {string} act - A DAILY_ACTS value
 * @param {Date} [now]
 * @returns {Record<string, string>}
 */
function dailyActUpdate(act, now = new Date()) {
  if (!KNOWN_ACTS.has(act)) throw new Error(`Unknown daily act: ${act}`);
  return { [`engagement.dailyActs.${act}`]: getGameDay(now) };
}

/**
 * Stamp a completed act onto the director's profile. Best-effort by design:
 * the act itself has already succeeded, and a failed stamp only means the
 * matching daily challenge won't auto-claim — never worth failing the caller.
 * `update` (not `set`) so a missing profile is never created as a stub.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid
 * @param {string} act - A DAILY_ACTS value
 * @returns {Promise<void>}
 */
async function recordDailyAct(db, uid, act) {
  try {
    await db.doc(paths.userProfile(uid)).update(dailyActUpdate(act));
  } catch (error) {
    logger.warn(`Daily act stamp (${act}) failed for ${uid}:`, error);
  }
}

module.exports = { dailyActUpdate, recordDailyAct };
