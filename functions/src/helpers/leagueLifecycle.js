/**
 * League teardown.
 *
 * Deleting a league used to delete exactly two documents: the league itself and
 * its `/leagueInvites/{code}` mapping. Everything underneath it —
 * `standings/`, `matchups/`, `activity/`, `chat/`, `recaps/`, `pools/`,
 * `meta/` — was left behind as unreachable documents, permanently, because
 * Firestore does not cascade. And any escrowed CorpsCoin (`settings.prizePool`,
 * `poolCarry`) went with the document rather than being returned to anybody.
 *
 * This module is what a league leaves behind when it goes: nothing.
 */

const { logger } = require("firebase-functions/v2");

/** Subcollections a league document owns. */
const LEAGUE_SUBCOLLECTIONS = [
  "standings",
  "matchups",
  "activity",
  "chat",
  "recaps",
  "pools",
  "meta",
];

/** Firestore caps a WriteBatch at 500 operations. */
const DELETE_BATCH_SIZE = 400;

/**
 * Coin still escrowed in a league. Returned to the last member on teardown —
 * it was staked by members and destroying it would quietly shrink the money
 * supply every time a league folds.
 */
function escrowedTotal(leagueData) {
  const prizePool = Number(leagueData?.settings?.prizePool) || 0;
  const poolCarry = Number(leagueData?.poolCarry) || 0;
  return Math.max(0, prizePool) + Math.max(0, poolCarry);
}

/**
 * Delete every document under a league, in batches.
 *
 * Best-effort and idempotent: called after the league document itself is gone,
 * so a failure here leaves orphans rather than failing the member's action, and
 * a re-run simply finds less to do. Never throws.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {FirebaseFirestore.DocumentReference} leagueRef
 * @returns {Promise<number>} documents deleted
 */
async function deleteLeagueSubcollections(db, leagueRef) {
  let deleted = 0;

  for (const name of LEAGUE_SUBCOLLECTIONS) {
    try {
      for (;;) {
        const snap = await leagueRef.collection(name).limit(DELETE_BATCH_SIZE).get();
        if (snap.empty) break;

        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        deleted += snap.size;

        if (snap.size < DELETE_BATCH_SIZE) break;
      }
    } catch (error) {
      logger.error(
        `Could not clear ${name} for league ${leagueRef.id} (orphans remain): ${error.message}`
      );
    }
  }

  if (deleted > 0) {
    logger.info(`Cleared ${deleted} document(s) under deleted league ${leagueRef.id}.`);
  }
  return deleted;
}

module.exports = {
  LEAGUE_SUBCOLLECTIONS,
  escrowedTotal,
  deleteLeagueSubcollections,
};
