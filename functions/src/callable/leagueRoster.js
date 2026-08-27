/**
 * Commissioner roster controls.
 *
 * Split out of callable/leagues.js, which is at its module size cap. Joining a
 * league is a member action; pruning the roster is a commissioner action with
 * its own guards and its own economic side effect (the entry-fee refund), so it
 * reads better on its own anyway.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { getDb } = require("../config");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions/v2");
const { createLeagueActivity } = require("../helpers/leagueHelpers");
const { assertAuth, hasAdminClaim, assertWriteBudget } = require("../helpers/callableGuards");
const { addCoinHistoryEntryToTransaction, TRANSACTION_TYPES } = require("../helpers/economy");
const { refreshLeagueActivity } = require("../helpers/leagueActivity");
const { isLeagueCommissioner, isLeagueOwner } = require("../helpers/leaguePermissions");

/**
 * Who is allowed to remove `memberId` from `league`, encoded as a pure guard so
 * the rules can be pinned without a Firestore mock. Throws the same HttpsError
 * the callable would; returns nothing when the removal is allowed.
 *
 * The order matters and is part of the contract:
 *  1. only a commissioner (or an admin) may remove anyone;
 *  2. the owner is never removable — the league would be left with no one able
 *     to run it (they must leave, or hand it over first);
 *  3. a co-commissioner cannot remove a *peer* commissioner — only the owner
 *     (or an admin) can, so two co-commissioners cannot race to remove each
 *     other. Removing a plain member, or oneself, is still fine;
 *  4. the target must actually be on the roster.
 *
 * @param {object} params
 * @param {object} params.league       the league document data
 * @param {string} params.actorUid     the uid making the request
 * @param {string} params.memberId     the uid being removed
 * @param {boolean} [params.isAdmin]    whether the actor holds the admin claim
 */
function assertCanRemoveMember({ league, actorUid, memberId, isAdmin = false }) {
  if (!isLeagueCommissioner(league, actorUid) && !isAdmin) {
    throw new HttpsError("permission-denied", "Only a commissioner can remove members.");
  }
  if (memberId === league.creatorId) {
    throw new HttpsError(
      "failed-precondition",
      "The league owner cannot be removed. They must leave, or hand the league over first."
    );
  }
  if (
    memberId !== actorUid &&
    isLeagueCommissioner(league, memberId) &&
    !isLeagueOwner(league, actorUid) &&
    !isAdmin
  ) {
    throw new HttpsError(
      "permission-denied",
      "Only the league owner can remove another commissioner."
    );
  }
  if (!(league.members || []).includes(memberId)) {
    throw new HttpsError("not-found", "That director is not a member of this league.");
  }
}

/**
 * The entry-fee refund owed to a removed member, in CorpsCoin.
 *
 * Clamped to what the prize pool actually holds so a refund can never mint coin
 * that was never escrowed. A member whose profile document is gone (a deleted
 * account) is paid nothing — there is no account to receive it — and their fee
 * stays in the pool for the directors still playing for it.
 *
 * @param {object} league                 the league document data
 * @param {boolean} memberProfileExists    whether the member still has a profile
 * @returns {number} the refund amount (>= 0)
 */
function computeRemovalRefund(league, memberProfileExists) {
  if (!memberProfileExists) return 0;
  const entryFee = league.settings?.entryFee || 0;
  const prizePool = league.settings?.prizePool || 0;
  return Math.min(entryFee, prizePool);
}

/**
 * Commissioner control: remove a member from the league.
 *
 * The roster is otherwise append-only — a director who stops playing sits in
 * the league forever, padding its member count and (before the activity gate)
 * getting paired into matchups. This is the commissioner's escape hatch.
 *
 * Guards:
 *  - commissioner (or admin) only;
 *  - the commissioner cannot remove themselves — the league would be left with
 *    no one able to run it. Use leaveLeague, which deletes the league when the
 *    commissioner is its last member.
 *  - the entry fee is refunded out of the prize pool. Leaving voluntarily
 *    forfeits the fee, but removal is not the member's decision, and keeping it
 *    would let a commissioner set a high fee and farm the pool by kicking every
 *    joiner. The pool always covers it: every member paid the same immutable
 *    fee on the way in.
 *  - the removal is written to the league activity feed, so a commissioner
 *    cannot quietly purge rivals mid-season.
 *  - a member whose profile document is gone is still removable. The roster
 *    lives on the league, not on the profile, so a deleted account leaves a
 *    uid behind that only this callable can clear.
 */
exports.removeLeagueMember = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { leagueId, memberId } = request.data;
  const uid = request.auth.uid;

  if (!leagueId || !memberId) {
    throw new HttpsError("invalid-argument", "A league ID and member ID are required.");
  }

  const db = getDb();

  // Abuse throttle (shared league bucket) — far above any human rate.
  await assertWriteBudget(db, uid, "leagueSocial", { max: 40 });

  const leagueRef = db.doc(paths.league(leagueId));
  const memberProfileRef = db.doc(paths.userProfile(memberId));
  const standingsRef = leagueRef.collection('standings').doc('current');

  const { leagueName, refund } = await db.runTransaction(async (transaction) => {
    const leagueDoc = await transaction.get(leagueRef);
    if (!leagueDoc.exists) {
      throw new HttpsError("not-found", "This league does not exist.");
    }
    const leagueData = leagueDoc.data();

    assertCanRemoveMember({
      league: leagueData,
      actorUid: uid,
      memberId,
      isAdmin: hasAdminClaim(request),
    });

    const standingsDoc = await transaction.get(standingsRef);
    const memberProfileDoc = await transaction.get(memberProfileRef);

    // A league's roster is stored on the LEAGUE, so a director whose profile
    // document is gone is still in `members` — an account deletion used to
    // detach nothing (helpers/leagueLifecycle.js detachMemberFromLeague now
    // does). That ghost is precisely who a commissioner wants to prune, and
    // this callable could not do it: `transaction.update` against a document
    // that does not exist fails the WHOLE transaction with NOT_FOUND, which
    // reached the commissioner as an opaque internal error with the roster
    // unchanged. There is no profile to write and no account to pay, so the
    // profile write and the refund are both skipped.
    const memberProfileExists = memberProfileDoc.exists;

    // Refund the entry fee out of the escrowed pool (clamped to the pool, zero
    // for a deleted account). See computeRemovalRefund.
    const refundAmount = computeRemovalRefund(leagueData, memberProfileExists);

    transaction.update(leagueRef, {
      members: admin.firestore.FieldValue.arrayRemove(memberId),
      // Losing the seat means losing the job. `commissioners` is what every
      // league gate reads (helpers/leaguePermissions.js), so leaving the uid
      // behind left a removed co-commissioner able to change settings,
      // generate matchups, invite, and remove members from a league they are
      // no longer in.
      ...(Array.isArray(leagueData.commissioners) &&
      leagueData.commissioners.includes(memberId)
        ? { commissioners: admin.firestore.FieldValue.arrayRemove(memberId) }
        : {}),
      ...(refundAmount > 0
        ? { 'settings.prizePool': admin.firestore.FieldValue.increment(-refundAmount) }
        : {}),
    });

    if (memberProfileExists) {
      const memberUpdate = {
        leagueIds: admin.firestore.FieldValue.arrayRemove(leagueId),
      };
      if (refundAmount > 0) {
        memberUpdate.corpsCoin = admin.firestore.FieldValue.increment(refundAmount);
        addCoinHistoryEntryToTransaction(transaction, db, memberId, {
          type: TRANSACTION_TYPES.LEAGUE_ENTRY_REFUND,
          amount: refundAmount,
          balance: (memberProfileDoc.data()?.corpsCoin || 0) + refundAmount,
          description: `Entry fee refunded — removed from ${leagueData.name}`,
          leagueId,
        });
      }
      transaction.update(memberProfileRef, memberUpdate);
    }

    // Drop their standings record so the removed director stops appearing in
    // the table and in matchup pairing weights.
    if (standingsDoc.exists) {
      const existing = standingsDoc.data().standings || [];
      transaction.update(standingsRef, {
        [`records.${memberId}`]: admin.firestore.FieldValue.delete(),
        standings: existing.filter((s) => s.uid !== memberId),
      });
    }

    return { leagueName: leagueData.name, refund: refundAmount };
  });

  await refreshLeagueActivity(db, leagueId);

  const memberProfileDoc = await memberProfileRef.get();
  const memberName = memberProfileDoc.exists
    ? (memberProfileDoc.data().displayName || memberProfileDoc.data().username || 'A director')
    : 'A director';

  await createLeagueActivity(db, leagueId, {
    type: 'member_removed',
    title: 'Member Removed',
    message: `${memberName} was removed from the league by the commissioner.`,
    userId: uid,
    metadata: { removedUserId: memberId, refund },
  });

  logger.info(`Commissioner ${uid} removed ${memberId} from league ${leagueId} (${leagueName}).`);

  return {
    success: true,
    message: refund > 0
      ? `${memberName} was removed and refunded ${refund.toLocaleString()} CC.`
      : `${memberName} was removed from the league.`,
  };
});

module.exports.assertCanRemoveMember = assertCanRemoveMember;
module.exports.computeRemovalRefund = computeRemovalRefund;
