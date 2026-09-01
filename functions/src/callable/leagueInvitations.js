// Per-director league invitation callables. Extracted from callable/leagues.js.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions/v2");
const { createLeagueActivity, invitationId } = require("../helpers/leagueHelpers");
const { assertAuth, assertWriteBudget } = require("../helpers/callableGuards");
const { createUserNotification } = require("../helpers/userNotifications");
const { chargeEntryFeeInTransaction } = require("../helpers/leagueEconomy");
const { refreshLeagueActivity } = require("../helpers/leagueActivity");
const { isLeagueCommissioner } = require("../helpers/leaguePermissions");

// Cross-user notifications MUST be written here with the Admin SDK — Firestore
// rules only let a client write into its OWN notifications subcollection, so a
// client-side write to another user's feed is silently denied (the old
// createLeagueNotification utility in src/hooks/useLeagueNotifications.ts).
// Non-fatal: a notification failure never fails the action that triggered it —
// the shared writer (helpers/userNotifications) catches and logs internally,
// and keeps the exact doc shape this file used to write inline.
async function createUserLeagueNotification(db, recipientUid, notification) {
  await createUserNotification(db, recipientUid, notification);
}

// =============================================================================
// PER-DIRECTOR LEAGUE INVITATIONS
// =============================================================================
// Schema: artifacts/{ns}/leagueInvitations/{leagueId}_{inviteeUid}
//   leagueId, leagueName, inviteCode, inviterUid, inviterName,
//   inviteeUid, invitedAt, message?, status: 'pending'|'accepted'|'declined'|'rescinded'
//
// Acceptance joins the league via the existing invite-code flow so the league
// document, standings, and profile.leagueIds stay consistent with every other
// code path.

/**
 * How long a pending invitation stands. Long enough to survive a holiday,
 * short enough that a stale offer doesn't outlive the league that sent it.
 */
const INVITATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Has this invitation aged out? Missing expiresAt = legacy, never expires. */
function isInvitationExpired(invitation, now = Date.now()) {
  const expiresAt = invitation?.expiresAt;
  if (!expiresAt) return false;
  const millis = typeof expiresAt.toMillis === "function" ? expiresAt.toMillis() : expiresAt;
  return millis < now;
}

/**
 * Required-field and self-invite validation for inviteDirectorToLeague. Pure,
 * runs before any Firestore read so a malformed call never burns budget.
 */
function validateInviteRequest({ leagueId, inviteeUid, inviterUid }) {
  if (!leagueId || !inviteeUid) {
    throw new HttpsError("invalid-argument", "leagueId and inviteeUid are required.");
  }
  if (inviteeUid === inviterUid) {
    throw new HttpsError("invalid-argument", "You cannot invite yourself.");
  }
}

/**
 * The post-read guards for sending an invitation, in the order they fire.
 * Throws the same HttpsError the callable would; returns nothing when the
 * invite is allowed. Pure — the invitee's profile is reduced to two booleans so
 * the rules pin without a Firestore mock.
 *
 *  1. only a commissioner may invite;
 *  2. an existing member cannot be re-invited;
 *  3. a full league (roster >= maxMembers, default 20) refuses new invites;
 *  4. the invitee must have a profile;
 *  5. a director who has turned invitations off cannot be invited;
 *  6. one live pending invitation at a time — a still-valid pending offer
 *     blocks a duplicate (an expired one does not).
 *
 * @param {object} params
 * @param {object} params.league
 * @param {string} params.inviterUid
 * @param {string} params.inviteeUid
 * @param {boolean} params.inviteeExists
 * @param {boolean|undefined} params.inviteeAcceptingInvites  directorInfo.acceptingLeagueInvites
 * @param {object|null} params.existingInvitation             the current invitation doc, if any
 * @param {number} [params.now]
 */
function assertCanSendInvitation({
  league,
  inviterUid,
  inviteeUid,
  inviteeExists,
  inviteeAcceptingInvites,
  existingInvitation,
  now = Date.now(),
}) {
  if (!isLeagueCommissioner(league, inviterUid)) {
    throw new HttpsError("permission-denied", "Only a league commissioner can send invitations.");
  }
  if ((league.members || []).includes(inviteeUid)) {
    throw new HttpsError("already-exists", "That director is already a member of this league.");
  }
  if ((league.members || []).length >= (league.maxMembers || 20)) {
    throw new HttpsError("failed-precondition", "This league is full.");
  }
  if (!inviteeExists) {
    throw new HttpsError("not-found", "Director profile not found.");
  }
  // Only an explicit opt-out (=== false) blocks; undefined means "never set it",
  // which is still accepting.
  if (inviteeAcceptingInvites === false) {
    throw new HttpsError("permission-denied", "This director is not accepting league invitations.");
  }
  if (
    existingInvitation &&
    existingInvitation.status === "pending" &&
    !isInvitationExpired(existingInvitation, now)
  ) {
    throw new HttpsError(
      "already-exists",
      "There is already a pending invitation for this director."
    );
  }
}

/**
 * The invitee-side guards for accepting or declining, in order: an invitation
 * can only be answered by its addressee, and only while it is still pending.
 * Expiry is checked separately by the caller because an expired invitation is
 * also *written* to 'expired' before the rejection.
 */
function assertCanRespondToInvitation({ invitation, uid }) {
  if (invitation.inviteeUid !== uid) {
    throw new HttpsError("permission-denied", "This invitation is not for you.");
  }
  if (invitation.status !== "pending") {
    throw new HttpsError("failed-precondition", `Invitation already ${invitation.status}.`);
  }
}

exports.inviteDirectorToLeague = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  const { leagueId, inviteeUid, message } = request.data || {};
  const inviterUid = request.auth.uid;

  validateInviteRequest({ leagueId, inviteeUid, inviterUid });
  const trimmedMessage = typeof message === 'string' ? message.trim().slice(0, 280) : '';

  const db = getDb();

  // Abuse throttle (shared league bucket) — far above any human rate.
  await assertWriteBudget(db, inviterUid, "leagueSocial", { max: 40 });

  const leagueRef = db.doc(paths.league(leagueId));
  const inviterRef = db.doc(paths.userProfile(inviterUid));
  const inviteeRef = db.doc(paths.userProfile(inviteeUid));
  const invitationRef = db.doc(
    paths.leagueInvitation(invitationId(leagueId, inviteeUid))
  );

  const [leagueDoc, inviterDoc, inviteeDoc] = await Promise.all([
    leagueRef.get(),
    inviterRef.get(),
    inviteeRef.get(),
  ]);

  if (!leagueDoc.exists) throw new HttpsError("not-found", "League not found.");
  const leagueData = leagueDoc.data();

  const existing = await invitationRef.get();
  assertCanSendInvitation({
    league: leagueData,
    inviterUid,
    inviteeUid,
    inviteeExists: inviteeDoc.exists,
    inviteeAcceptingInvites: inviteeDoc.exists
      ? inviteeDoc.data().directorInfo?.acceptingLeagueInvites
      : undefined,
    existingInvitation: existing.exists ? existing.data() : null,
  });

  const inviterName = inviterDoc.exists
    ? (inviterDoc.data().displayName || inviterDoc.data().username || 'A director')
    : 'A director';

  // No inviteCode field. It was written as `leagueData.inviteCode || null`,
  // which has been unconditionally null since the code moved to the
  // member-only meta/private doc — and would be a leak of the league's join
  // secret to a non-member if a legacy document still carried it.
  await invitationRef.set({
    leagueId,
    leagueName: leagueData.name || 'Unnamed League',
    inviterUid,
    inviterName,
    inviteeUid,
    message: trimmedMessage,
    status: 'pending',
    invitedAt: admin.firestore.FieldValue.serverTimestamp(),
    // Invitations used to sit pending forever, so a director's list slowly
    // filled with offers to leagues that had long since moved on.
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + INVITATION_TTL_MS),
  });

  // Notify the invitee in their notification feed. Text is built from
  // server-derived values only (never the client-supplied message).
  await createUserLeagueNotification(db, inviteeUid, {
    leagueId,
    leagueName: leagueData.name || "Unnamed League",
    type: "league_invite",
    title: "League Invitation",
    message: `${inviterName} invited you to join ${leagueData.name || "a league"}.`,
  });

  logger.info(`League invitation sent: ${inviterUid} → ${inviteeUid} for ${leagueId}`);
  return { success: true };
});

exports.respondToLeagueInvitation = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { leagueId, accept } = request.data || {};
  const uid = request.auth.uid;
  if (!leagueId || typeof accept !== 'boolean') {
    throw new HttpsError("invalid-argument", "leagueId and accept (boolean) are required.");
  }

  const db = getDb();

  // Abuse throttle (shared league bucket) — far above any human rate.
  await assertWriteBudget(db, uid, "leagueSocial", { max: 40 });

  const invitationRef = db.doc(
    paths.leagueInvitation(invitationId(leagueId, uid))
  );

  const invitationDoc = await invitationRef.get();
  if (!invitationDoc.exists) throw new HttpsError("not-found", "No invitation found.");
  const invitation = invitationDoc.data();
  assertCanRespondToInvitation({ invitation, uid });
  if (isInvitationExpired(invitation)) {
    await invitationRef.update({
      status: 'expired',
      respondedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    throw new HttpsError("failed-precondition", "This invitation has expired.");
  }

  if (!accept) {
    await invitationRef.update({
      status: 'declined',
      respondedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, accepted: false };
  }

  // Accept: join the league using the same logic as joinLeagueByCode.
  const leagueRef = db.doc(paths.league(leagueId));
  const userProfileRef = db.doc(paths.userProfile(uid));
  const standingsRef = leagueRef.collection('standings').doc('current');

  await db.runTransaction(async (transaction) => {
    const leagueDoc = await transaction.get(leagueRef);
    if (!leagueDoc.exists) {
      throw new HttpsError("not-found", "This league no longer exists.");
    }
    const standingsDoc = await transaction.get(standingsRef);
    const profileDoc = await transaction.get(userProfileRef);
    const leagueData = leagueDoc.data();

    if ((leagueData.members || []).includes(uid)) {
      // Already a member — just mark invitation accepted
      transaction.update(invitationRef, {
        status: 'accepted',
        respondedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }
    if ((leagueData.members || []).length >= (leagueData.maxMembers || 20)) {
      throw new HttpsError("failed-precondition", "This league is now full.");
    }

    // Invited directors pay the same entry fee as everyone else. This path
    // used to admit them free, which under-funded the prize pool relative to
    // the roster AND opened a real hole: removeLeagueMember refunds
    // min(entryFee, prizePool) out of escrow, so a commissioner could invite a
    // friend for nothing, remove them, and hand them other members' coin.
    const entryFee = chargeEntryFeeInTransaction(
      transaction, db, uid, profileDoc, leagueRef, leagueData
    );

    transaction.update(leagueRef, {
      members: admin.firestore.FieldValue.arrayUnion(uid),
    });
    transaction.update(userProfileRef, {
      leagueIds: admin.firestore.FieldValue.arrayUnion(leagueId),
      ...(entryFee > 0 ? { corpsCoin: admin.firestore.FieldValue.increment(-entryFee) } : {}),
    });
    if (standingsDoc.exists) {
      const existingData = standingsDoc.data();
      const existingStandings = existingData.standings || [];
      transaction.update(standingsRef, {
        [`records.${uid}`]: {
          wins: 0, losses: 0, ties: 0,
          pointsFor: 0, pointsAgainst: 0,
          currentStreak: 0, streakType: null,
        },
        standings: [...existingStandings, {
          uid, wins: 0, losses: 0, ties: 0,
          totalPoints: 0, pointsAgainst: 0,
          streak: 0, streakType: null,
        }],
      });
    }
    transaction.update(invitationRef, {
      status: 'accepted',
      respondedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  // Roster changed — recompute season participation so discovery and the
  // matchup generators see the new member right away, exactly as joinLeague
  // and joinLeagueByCode do. Only this path skipped it, so a league that
  // filled entirely through invitations stayed stale until the nightly job.
  await refreshLeagueActivity(db, leagueId);

  // Activity event outside transaction
  const userProfileDoc = await db.doc(paths.userProfile(uid)).get();
  const userDisplayName = userProfileDoc.exists
    ? (userProfileDoc.data().displayName || userProfileDoc.data().username || 'New Member')
    : 'New Member';
  await createLeagueActivity(db, leagueId, {
    type: 'member_joined',
    title: 'New Member Joined',
    message: `${userDisplayName} has joined the league!`,
    userId: uid,
  });

  // Tell the inviter their invitation was accepted (cross-user, Admin SDK).
  if (invitation.inviterUid && invitation.inviterUid !== uid) {
    await createUserLeagueNotification(db, invitation.inviterUid, {
      leagueId,
      leagueName: invitation.leagueName || "your league",
      type: "member_joined",
      title: "Invitation Accepted",
      message: `${userDisplayName} accepted your invitation to ${invitation.leagueName || "your league"}.`,
    });
  }

  return { success: true, accepted: true };
});

module.exports.INVITATION_TTL_MS = INVITATION_TTL_MS;
module.exports.isInvitationExpired = isInvitationExpired;
module.exports.validateInviteRequest = validateInviteRequest;
module.exports.assertCanSendInvitation = assertCanSendInvitation;
module.exports.assertCanRespondToInvitation = assertCanRespondToInvitation;
