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

    if (leagueData.creatorId !== uid && !hasAdminClaim(request)) {
      throw new HttpsError("permission-denied", "Only the commissioner can remove members.");
    }
    if (memberId === leagueData.creatorId) {
      throw new HttpsError(
        "failed-precondition",
        "The commissioner cannot be removed. Leave the league instead."
      );
    }
    if (!(leagueData.members || []).includes(memberId)) {
      throw new HttpsError("not-found", "That director is not a member of this league.");
    }

    const standingsDoc = await transaction.get(standingsRef);
    const memberProfileDoc = await transaction.get(memberProfileRef);

    // Refund the entry fee out of the escrowed pool. Clamped to what the pool
    // actually holds so a refund can never mint coin that was never escrowed.
    const entryFee = leagueData.settings?.entryFee || 0;
    const prizePool = leagueData.settings?.prizePool || 0;
    const refundAmount = Math.min(entryFee, prizePool);

    transaction.update(leagueRef, {
      members: admin.firestore.FieldValue.arrayRemove(memberId),
      ...(refundAmount > 0
        ? { 'settings.prizePool': admin.firestore.FieldValue.increment(-refundAmount) }
        : {}),
    });

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
