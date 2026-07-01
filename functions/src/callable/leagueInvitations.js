// Per-director league invitation callables. Extracted from callable/leagues.js.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb, dataNamespaceParam } = require("../config");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions/v2");
const { createLeagueActivity, invitationId } = require("../helpers/leagueHelpers");

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


exports.inviteDirectorToLeague = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to send invitations.");
  }

  const { leagueId, inviteeUid, message } = request.data || {};
  const inviterUid = request.auth.uid;

  if (!leagueId || !inviteeUid) {
    throw new HttpsError("invalid-argument", "leagueId and inviteeUid are required.");
  }
  if (inviteeUid === inviterUid) {
    throw new HttpsError("invalid-argument", "You cannot invite yourself.");
  }
  const trimmedMessage = typeof message === 'string' ? message.trim().slice(0, 280) : '';

  const db = getDb();
  const namespace = dataNamespaceParam.value();
  const leagueRef = db.doc(`artifacts/${namespace}/leagues/${leagueId}`);
  const inviterRef = db.doc(`artifacts/${namespace}/users/${inviterUid}/profile/data`);
  const inviteeRef = db.doc(`artifacts/${namespace}/users/${inviteeUid}/profile/data`);
  const invitationRef = db.doc(
    `artifacts/${namespace}/leagueInvitations/${invitationId(leagueId, inviteeUid)}`
  );

  const [leagueDoc, inviterDoc, inviteeDoc] = await Promise.all([
    leagueRef.get(),
    inviterRef.get(),
    inviteeRef.get(),
  ]);

  if (!leagueDoc.exists) throw new HttpsError("not-found", "League not found.");
  const leagueData = leagueDoc.data();

  if (leagueData.creatorId !== inviterUid) {
    throw new HttpsError("permission-denied", "Only the league commissioner can send invitations.");
  }
  if ((leagueData.members || []).includes(inviteeUid)) {
    throw new HttpsError("already-exists", "That director is already a member of this league.");
  }
  if ((leagueData.members || []).length >= (leagueData.maxMembers || 20)) {
    throw new HttpsError("failed-precondition", "This league is full.");
  }

  if (!inviteeDoc.exists) throw new HttpsError("not-found", "Director profile not found.");
  const inviteeData = inviteeDoc.data();
  const accepting = inviteeData.directorInfo?.acceptingLeagueInvites;
  if (accepting === false) {
    throw new HttpsError("permission-denied", "This director is not accepting league invitations.");
  }

  const existing = await invitationRef.get();
  if (existing.exists && existing.data().status === 'pending') {
    throw new HttpsError("already-exists", "There is already a pending invitation for this director.");
  }

  const inviterName = inviterDoc.exists
    ? (inviterDoc.data().displayName || inviterDoc.data().username || 'A director')
    : 'A director';

  await invitationRef.set({
    leagueId,
    leagueName: leagueData.name || 'Unnamed League',
    inviteCode: leagueData.inviteCode || null,
    inviterUid,
    inviterName,
    inviteeUid,
    message: trimmedMessage,
    status: 'pending',
    invitedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info(`League invitation sent: ${inviterUid} → ${inviteeUid} for ${leagueId}`);
  return { success: true };
});

exports.respondToLeagueInvitation = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const { leagueId, accept } = request.data || {};
  const uid = request.auth.uid;
  if (!leagueId || typeof accept !== 'boolean') {
    throw new HttpsError("invalid-argument", "leagueId and accept (boolean) are required.");
  }

  const db = getDb();
  const namespace = dataNamespaceParam.value();
  const invitationRef = db.doc(
    `artifacts/${namespace}/leagueInvitations/${invitationId(leagueId, uid)}`
  );

  const invitationDoc = await invitationRef.get();
  if (!invitationDoc.exists) throw new HttpsError("not-found", "No invitation found.");
  const invitation = invitationDoc.data();
  if (invitation.inviteeUid !== uid) {
    throw new HttpsError("permission-denied", "This invitation is not for you.");
  }
  if (invitation.status !== 'pending') {
    throw new HttpsError("failed-precondition", `Invitation already ${invitation.status}.`);
  }

  if (!accept) {
    await invitationRef.update({
      status: 'declined',
      respondedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, accepted: false };
  }

  // Accept: join the league using the same logic as joinLeagueByCode.
  const leagueRef = db.doc(`artifacts/${namespace}/leagues/${leagueId}`);
  const userProfileRef = db.doc(`artifacts/${namespace}/users/${uid}/profile/data`);
  const standingsRef = leagueRef.collection('standings').doc('current');

  await db.runTransaction(async (transaction) => {
    const leagueDoc = await transaction.get(leagueRef);
    if (!leagueDoc.exists) {
      throw new HttpsError("not-found", "This league no longer exists.");
    }
    const standingsDoc = await transaction.get(standingsRef);
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

    transaction.update(leagueRef, {
      members: admin.firestore.FieldValue.arrayUnion(uid),
    });
    transaction.update(userProfileRef, {
      leagueIds: admin.firestore.FieldValue.arrayUnion(leagueId),
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

  // Activity event outside transaction
  const userProfileDoc = await db.doc(`artifacts/${namespace}/users/${uid}/profile/data`).get();
  const userDisplayName = userProfileDoc.exists
    ? (userProfileDoc.data().displayName || userProfileDoc.data().username || 'New Member')
    : 'New Member';
  await createLeagueActivity(db, leagueId, {
    type: 'member_joined',
    title: 'New Member Joined',
    message: `${userDisplayName} has joined the league!`,
    userId: uid,
  });

  return { success: true, accepted: true };
});

exports.rescindLeagueInvitation = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const { leagueId, inviteeUid } = request.data || {};
  const uid = request.auth.uid;
  if (!leagueId || !inviteeUid) {
    throw new HttpsError("invalid-argument", "leagueId and inviteeUid are required.");
  }

  const db = getDb();
  const namespace = dataNamespaceParam.value();
  const leagueRef = db.doc(`artifacts/${namespace}/leagues/${leagueId}`);
  const invitationRef = db.doc(
    `artifacts/${namespace}/leagueInvitations/${invitationId(leagueId, inviteeUid)}`
  );

  const leagueDoc = await leagueRef.get();
  if (!leagueDoc.exists) throw new HttpsError("not-found", "League not found.");
  if (leagueDoc.data().creatorId !== uid) {
    throw new HttpsError("permission-denied", "Only the league commissioner can rescind invitations.");
  }

  const invitationDoc = await invitationRef.get();
  if (!invitationDoc.exists) throw new HttpsError("not-found", "Invitation not found.");
  if (invitationDoc.data().status !== 'pending') {
    throw new HttpsError("failed-precondition", "Only pending invitations can be rescinded.");
  }

  await invitationRef.update({
    status: 'rescinded',
    respondedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { success: true };
});
