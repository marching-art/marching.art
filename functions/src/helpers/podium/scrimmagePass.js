/**
 * Nightly scrimmage pass (design §5.12) — the second half of a joint
 * rehearsal day, extracted from `processor.js` so the nightly processor stays
 * under the max-lines guardrail.
 *
 * For every pair whose joint rehearsal was today: each side gets the PRIVATE
 * head-to-head diagnostic written onto its own state (plus the season
 * head-to-head record keyed by partner), the shared pending entry is consumed,
 * and the pair emits ONE public feed line for the day's recap — public smoke,
 * private fire.
 *
 * Runs after the main loop has committed tonight's state, and is isolated
 * throughout: a scrimmage failure never fails the night's scoring.
 */

const { logger } = require("firebase-functions/v2");
const store = require("./store");
const joint = require("./joint");
const venues = require("./venues");
const { ChunkedWriter } = require("../chunkedWriter");

const GETALL_CHUNK = 300;

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} context
 * @param {string} context.seasonUid
 * @param {number} context.competitionDay
 * @param {Array<{uid: string, partnerUid: string, corpsName: string,
 *   partnerCorpsName: string, city: ?string}>} context.jointToday corps whose
 *   joint rehearsal was today, collected by the main loop
 * @returns {Promise<Array<{corpsA: ?string, corpsB: ?string, city: ?string}>>}
 *   one public feed line per scrimmaged pair
 */
async function runScrimmagePass(db, { seasonUid, competitionDay, jointToday }) {
  const jointFeed = [];
  if (jointToday.length === 0) return jointFeed;

  const scrimmagedPairs = new Set();
  // Batch the pair reads: one chunked getAll over every corps involved in a
  // joint rehearsal today (fresh reads on purpose — see the merge-write note
  // below) instead of two sequential reads per pair.
  const jointStateByUid = new Map();
  const jointUids = [
    ...new Set(jointToday.flatMap((e) => [e.uid, e.partnerUid]).filter(Boolean)),
  ];
  try {
    for (let i = 0; i < jointUids.length; i += GETALL_CHUNK) {
      const chunk = jointUids.slice(i, i + GETALL_CHUNK);
      const snaps = await db.getAll(...chunk.map((uid) => store.stateRef(db, uid)));
      snaps.forEach((snap, j) => jointStateByUid.set(chunk[j], snap));
    }
  } catch (error) {
    logger.error(`[podium] scrimmage state reads failed: ${error.message}`);
  }

  const scrimmageWriter = new ChunkedWriter(db);
  for (const entry of jointToday) {
    try {
      const mySnapshot = jointStateByUid.get(entry.uid);
      if (!mySnapshot || !mySnapshot.exists) continue;
      const myState = store.hydrateState(mySnapshot.data());
      const partnerSnapshot = entry.partnerUid
        ? jointStateByUid.get(entry.partnerUid) || null
        : null;
      let scrimmage = null;
      let headToHead = myState.headToHead || null;
      if (
        partnerSnapshot &&
        partnerSnapshot.exists &&
        partnerSnapshot.data().seasonUid === seasonUid
      ) {
        const partnerState = store.hydrateState(partnerSnapshot.data());
        const report = joint.scrimmageReport(
          myState, partnerState, competitionDay, seasonUid, store.curves, store.balance
        );
        // Enrich the stored report into the Tale of the Tape artifact: where
        // it happened and the outcome from this corps' perspective (§5.12).
        const outcome =
          report.mine.total > report.theirs.total
            ? "win"
            : report.mine.total < report.theirs.total
              ? "loss"
              : "tie";
        const venue = entry.city ? venues.venueFor(entry.city) : null;
        scrimmage = {
          ...report,
          partnerUid: entry.partnerUid,
          city: entry.city || null,
          stadium: venue ? venues.stadiumFor(venue.venueId) : null,
          outcome,
        };
        // Head-to-head season record, keyed by partner — the profile's
        // "who's been rehearsing with whom" log.
        const prior = (myState.headToHead && myState.headToHead[entry.partnerUid]) || {
          wins: 0,
          losses: 0,
          ties: 0,
          joints: 0,
        };
        headToHead = {
          ...(myState.headToHead || {}),
          [entry.partnerUid]: {
            partnerCorpsName: entry.partnerCorpsName || prior.partnerCorpsName || null,
            wins: prior.wins + (outcome === "win" ? 1 : 0),
            losses: prior.losses + (outcome === "loss" ? 1 : 0),
            ties: prior.ties + (outcome === "tie" ? 1 : 0),
            joints: prior.joints + 1,
            last: {
              day: competitionDay,
              myTotal: report.mine.total,
              theirTotal: report.theirs.total,
              outcome,
            },
          },
        };
        const pairKey = [entry.uid, entry.partnerUid].sort().join("_");
        if (!scrimmagedPairs.has(pairKey)) {
          scrimmagedPairs.add(pairKey);
          jointFeed.push({
            corpsA: entry.corpsName || null,
            corpsB: entry.partnerCorpsName || null,
            city: entry.city,
          });
        }
      }
      // Merge-write ONLY this pass's fields: a full-doc set here would
      // clobber any block the director allocated between the main loop's
      // write and this pass (players do play at 2 AM). Drop just today's
      // joint from the pending list, leaving other weeks' joints intact.
      const remainingJoints = joint
        .pendingJoints(myState)
        .filter((j) => j.day !== competitionDay);
      scrimmageWriter.set(
        store.stateRef(db, entry.uid),
        {
          ...(scrimmage ? { scrimmage } : {}),
          ...(headToHead ? { headToHead } : {}),
          jointRehearsals: remainingJoints,
          jointRehearsal: null,
        },
        { merge: true }
      );
    } catch (error) {
      logger.error(`[podium] scrimmage pass failed for ${entry.uid}: ${error.message}`);
    }
  }
  // Isolated like the per-entry writes it replaces: a scrimmage write
  // failure never fails the night's scoring.
  try {
    await scrimmageWriter.commit();
  } catch (error) {
    logger.error(`[podium] scrimmage pass writes failed: ${error.message}`);
  }

  return jointFeed;
}

module.exports = { runScrimmagePass };
