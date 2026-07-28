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
 *
 * It also holds the other half of that promise — what a DIRECTOR leaves behind
 * when they go. A league's roster lives on the league document, not on the
 * profile, so deleting an account without detaching its leagues left the uid in
 * every `members` array it had ever joined.
 */

const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { paths } = require("./paths");
const { pickSuccessor } = require("./leaguePermissions");
const { refreshLeagueActivity } = require("./leagueActivity");

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

/**
 * Deletes per committed batch.
 *
 * Not a hard limit: Firestore's published quotas cap a request at 10 MiB and
 * 500 field transformations on a single document — the old 500-writes-per-batch
 * ceiling this file used to cite is no longer among them. Chunking is still the
 * right shape for an unbounded teardown (bounded memory, bounded request size,
 * a failure that loses one chunk rather than the whole delete), so the number
 * stays; only the reason for it has changed.
 */
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

/**
 * What taking `uid` off a league's roster has to do to the league document.
 *
 * Pure, so the decision — dissolve the league, or detach and possibly hand it
 * on — is testable without Firestore.
 *
 * @param {object} leagueData
 * @param {string} uid
 * @returns {{dissolve: boolean, dropCommissioner: boolean, successorUid: string|null}|null}
 *   null when `uid` is not on the roster and there is nothing to do.
 */
function planMemberDetachment(leagueData, uid) {
  const members = Array.isArray(leagueData?.members) ? leagueData.members : [];
  if (!uid || !members.includes(uid)) return null;

  const commissioners = Array.isArray(leagueData.commissioners) ? leagueData.commissioners : [];

  // The last member takes the league with them — there is nobody left to run
  // it, play in it, or ever see it again.
  if (members.length === 1) {
    return { dissolve: true, dropCommissioner: false, successorUid: null };
  }

  return {
    dissolve: false,
    // Losing the seat means losing the job: `commissioners` is what every
    // league gate reads, and a uid left behind there belongs to someone who is
    // no longer a member.
    dropCommissioner: commissioners.includes(uid),
    // Every commissioner gate keys off the owner, so a league whose owner
    // vanishes without succession permanently loses the ability to run itself.
    successorUid: leagueData.creatorId === uid ? pickSuccessor(leagueData, uid) : null,
  };
}

/**
 * Take a director off one league's roster, for account deletion.
 *
 * `deleteAccount` (callable/profile.js) used to delete the profile document and
 * stop. The roster lives on the LEAGUE, so the uid stayed in `members` forever:
 * it kept padding the member count, kept its standings row, and — the part that
 * surfaced as a bug — could not be cleared by hand either, because
 * `removeLeagueMember` wrote to the removed director's profile and a
 * `transaction.update` against a document that is gone fails the whole
 * transaction. The commissioner's only escape hatch came back as an internal
 * error. (That callable now tolerates a missing profile; this stops the ghost
 * being created in the first place.)
 *
 * There is deliberately no refund. `leaveLeague` returns escrow to a departing
 * member because there is an account to return it to; a deleted account has no
 * balance to credit and no history to write, so the escrow stays in the pool
 * and is paid out to the members still playing for it.
 *
 * Never throws: an account deletion must not be blocked by one league that
 * cannot be updated. A league this skips is still prunable by its commissioner.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} leagueId
 * @param {string} uid
 * @returns {Promise<"dissolved"|"detached"|"skipped">}
 */
async function detachMemberFromLeague(db, leagueId, uid) {
  const leagueRef = db.doc(paths.league(leagueId));

  try {
    const outcome = await db.runTransaction(async (transaction) => {
      const leagueDoc = await transaction.get(leagueRef);
      if (!leagueDoc.exists) return "skipped";

      const leagueData = leagueDoc.data();
      const plan = planMemberDetachment(leagueData, uid);
      if (!plan) return "skipped";

      // Both reads before any write — a transaction that writes first cannot
      // read afterwards.
      const standingsRef = leagueRef.collection("standings").doc("current");
      const metaPrivateRef = leagueRef.collection("meta").doc("private");
      const standingsDoc = await transaction.get(standingsRef);
      const metaPrivateDoc = await transaction.get(metaPrivateRef);

      if (plan.dissolve) {
        // The invite code lives in the member-only meta/private doc (legacy
        // leagues may still carry it on the league document itself).
        const inviteCode =
          (metaPrivateDoc.exists && metaPrivateDoc.data().inviteCode) || leagueData.inviteCode;
        if (inviteCode) transaction.delete(db.doc(`leagueInvites/${inviteCode}`));
        if (metaPrivateDoc.exists) transaction.delete(metaPrivateRef);
        transaction.delete(leagueRef);
        return "dissolved";
      }

      const update = { members: admin.firestore.FieldValue.arrayRemove(uid) };
      if (plan.dropCommissioner) {
        update.commissioners = admin.firestore.FieldValue.arrayRemove(uid);
      }
      if (plan.successorUid) {
        update.creatorId = plan.successorUid;
        logger.info(
          `League ${leagueId} lost its owner to account deletion; ${plan.successorUid} inherits it.`
        );
      }
      transaction.update(leagueRef, update);

      // Drop their standings row, or the deleted director keeps a rank and
      // counts against the finals cut for the rest of the season.
      if (standingsDoc.exists) {
        const existing = standingsDoc.data().standings || [];
        transaction.update(standingsRef, {
          [`records.${uid}`]: admin.firestore.FieldValue.delete(),
          standings: existing.filter((row) => row.uid !== uid),
        });
      }

      return "detached";
    });

    if (outcome === "dissolved") {
      // Firestore does not cascade.
      await deleteLeagueSubcollections(db, leagueRef);
    } else if (outcome === "detached") {
      // The roster shrank, so what league discovery filters on and what the
      // matchup generators pair from both have to be recomputed.
      await refreshLeagueActivity(db, leagueId);
    }
    return outcome;
  } catch (error) {
    logger.error(`Could not detach ${uid} from league ${leagueId}: ${error.message}`);
    return "skipped";
  }
}

module.exports = {
  LEAGUE_SUBCOLLECTIONS,
  escrowedTotal,
  deleteLeagueSubcollections,
  planMemberDetachment,
  detachMemberFromLeague,
};
