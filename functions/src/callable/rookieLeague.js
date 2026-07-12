const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { getDb } = require("../config");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions/v2");
const { generateUniqueInviteCode, createLeagueActivity } = require("../helpers/leagueHelpers");
const { assertAuth } = require("../helpers/callableGuards");

/**
 * One-tap rookie league placement.
 *
 * Joins the current "Rookie Circuit" league — a public, auto-provisioned
 * league for new directors. A pointer doc (game-settings/rookie-league)
 * tracks the active circuit; when it's full (or missing), a fresh
 * "Rookie Circuit N" is created with the joining director as its first
 * member and the pointer advances. Weekly matchups are fully automated, so
 * these leagues need no commissioner attention.
 */
const ROOKIE_LEAGUE_MAX_MEMBERS = 16;

exports.joinRookieLeague = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const uid = request.auth.uid;

  const db = getDb();
  const pointerRef = db.doc("game-settings/rookie-league");
  const userProfileRef = db.doc(paths.userProfile(uid));

  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) throw new HttpsError("not-found", "No active season.");
  const { seasonUid } = seasonDoc.data();

  const result = await db.runTransaction(async (transaction) => {
    // Reads first (Firestore transaction requirement)
    const pointerDoc = await transaction.get(pointerRef);
    const pointer = pointerDoc.exists ? pointerDoc.data() : { leagueId: null, counter: 0 };

    let leagueRef = null;
    let leagueData = null;
    if (pointer.leagueId) {
      leagueRef = db.doc(paths.league(pointer.leagueId));
      const leagueDoc = await transaction.get(leagueRef);
      if (leagueDoc.exists) {
        leagueData = leagueDoc.data();
      }
    }

    // Already in the current rookie circuit — nothing to do
    if (leagueData && leagueData.members.includes(uid)) {
      return { leagueId: leagueRef.id, leagueName: leagueData.name, alreadyMember: true };
    }

    const currentIsJoinable =
      leagueData && leagueData.members.length < (leagueData.maxMembers || ROOKIE_LEAGUE_MAX_MEMBERS);

    if (currentIsJoinable) {
      const standingsRef = leagueRef.collection('standings').doc('current');
      const standingsDoc = await transaction.get(standingsRef);

      transaction.update(leagueRef, {
        members: admin.firestore.FieldValue.arrayUnion(uid),
      });
      transaction.update(userProfileRef, {
        leagueIds: admin.firestore.FieldValue.arrayUnion(leagueRef.id),
      });
      if (standingsDoc.exists) {
        const existingStandings = standingsDoc.data().standings || [];
        transaction.update(standingsRef, {
          [`records.${uid}`]: {
            wins: 0, losses: 0, ties: 0,
            pointsFor: 0, pointsAgainst: 0,
            currentStreak: 0, streakType: null,
          },
          standings: [...existingStandings, {
            uid, wins: 0, losses: 0, ties: 0,
            totalPoints: 0, pointsAgainst: 0, streak: 0, streakType: null,
          }],
        });
      }
      return { leagueId: leagueRef.id, leagueName: leagueData.name, alreadyMember: false, created: false };
    }

    // Current circuit missing or full — provision the next one
    const nextNumber = (pointer.counter || 0) + 1;
    const newName = `Rookie Circuit ${nextNumber}`;
    const inviteCode = generateUniqueInviteCode(uid);
    const newLeagueRef = db.collection(paths.leagues()).doc();
    const newStandingsRef = newLeagueRef.collection('standings').doc('current');
    const inviteRef = db.doc(`leagueInvites/${inviteCode}`);

    transaction.set(newLeagueRef, {
      name: newName,
      description: 'Auto-created league for new directors. Weekly matchups are fully automated — just compete!',
      creatorId: uid,
      seasonId: seasonUid,
      members: [uid],
      inviteCode,
      isPublic: true,
      maxMembers: ROOKIE_LEAGUE_MAX_MEMBERS,
      isRookieCircuit: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      settings: {
        matchupType: 'weekly',
        playoffSize: 4,
        // Pure escrow like every league (see createLeague): the rookie
        // circuit has no entry fee, so its pool stays 0 — champions here
        // win the trophy and the league-champion achievement, not minted CC.
        prizePool: 0,
      },
    });
    transaction.set(newStandingsRef, {
      records: {
        [uid]: {
          wins: 0, losses: 0, ties: 0,
          pointsFor: 0, pointsAgainst: 0,
          currentStreak: 0, streakType: null,
        },
      },
      standings: [{
        uid, wins: 0, losses: 0, ties: 0,
        totalPoints: 0, pointsAgainst: 0, streak: 0, streakType: null,
      }],
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.set(inviteRef, { leagueId: newLeagueRef.id });
    transaction.update(userProfileRef, {
      leagueIds: admin.firestore.FieldValue.arrayUnion(newLeagueRef.id),
    });
    transaction.set(pointerRef, { leagueId: newLeagueRef.id, counter: nextNumber });

    return { leagueId: newLeagueRef.id, leagueName: newName, alreadyMember: false, created: true };
  });

  if (!result.alreadyMember) {
    await createLeagueActivity(db, result.leagueId, {
      type: 'member_joined',
      title: 'New Member Joined',
      message: 'A new director has joined the circuit!',
      userId: uid,
      metadata: {},
    });
    logger.info(
      `User ${uid} joined rookie league '${result.leagueName}'${result.created ? ' (newly created)' : ''}`
    );
  }

  return {
    success: true,
    leagueId: result.leagueId,
    leagueName: result.leagueName,
    alreadyMember: !!result.alreadyMember,
    message: result.alreadyMember
      ? `You're already in ${result.leagueName}.`
      : `Welcome to ${result.leagueName}!`,
  };
});
