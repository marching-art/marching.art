const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { getDb } = require("../config");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions/v2");
const { generateUniqueInviteCode, createLeagueActivity } = require("../helpers/leagueHelpers");
const { assertAuth, assertWriteBudget } = require("../helpers/callableGuards");
const { refreshLeagueActivity } = require("../helpers/leagueActivity");

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

/**
 * Who the Rookie Circuit is for.
 *
 * This endpoint had no gate at all: any director could call it regardless of
 * level or tenure, so a veteran could drop into a league of new directors — the
 * one place in the game explicitly reserved for people finding their feet.
 *
 * The bar is deliberately generous, and it is an OR: a director is a rookie
 * while they are early in their first season OR still under the level cut.
 * Getting this wrong in the strict direction is worse than in the loose one —
 * a new director bounced out of the beginner league has nowhere to go.
 */
const ROOKIE_MAX_LEVEL = 10;
const ROOKIE_MAX_SEASONS = 1;

function isRookieDirector(profileData) {
  if (!profileData) return true;
  const level = Number(profileData.xpLevel) || 1;
  const seasons = Number(profileData.stats?.seasonsPlayed ?? profileData.seasonsPlayed) || 0;
  return seasons <= ROOKIE_MAX_SEASONS || level <= ROOKIE_MAX_LEVEL;
}

exports.joinRookieLeague = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const uid = request.auth.uid;

  const db = getDb();

  // Abuse throttle (shared league bucket) — far above any human rate.
  await assertWriteBudget(db, uid, "leagueSocial", { max: 40 });

  const pointerRef = db.doc("game-settings/rookie-league");
  const userProfileRef = db.doc(paths.userProfile(uid));

  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) throw new HttpsError("not-found", "No active season.");
  const { seasonUid } = seasonDoc.data();

  // Checked before the transaction so a veteran never even provisions a
  // circuit. Directors already in a circuit still reach the early-return
  // inside the transaction — the gate is on JOINING, not on staying.
  const gateProfileDoc = await userProfileRef.get();
  if (gateProfileDoc.exists && !isRookieDirector(gateProfileDoc.data())) {
    throw new HttpsError(
      "failed-precondition",
      "The Rookie Circuit is for directors in their first season. Browse or create a league instead."
    );
  }

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

    // Already in the current rookie circuit — nothing to do. Reached before
    // any gate matters: a director who joined as a rookie keeps their circuit.
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
    const metaPrivateRef = newLeagueRef.collection('meta').doc('private');

    transaction.set(newLeagueRef, {
      name: newName,
      description: 'Auto-created league for new directors. Weekly matchups are fully automated — just compete!',
      // System-owned. The first director to trip provisioning used to become
      // the circuit's commissioner — with kick and settings power over
      // strangers, in a league whose own description says it needs no
      // commissioner. `creatorId` is deliberately absent, so every
      // `creatorId === uid` gate is false for everyone.
      seasonId: seasonUid,
      members: [uid],
      // NO inviteCode field. firestore.rules leaves `list` over leagues open to
      // any signed-in user (community widgets), so every field on a league
      // document is enumerable by every authenticated account — writing the
      // join secret here published every Rookie Circuit's code. It lives in
      // /leagueInvites/{code} and the member-only meta/private doc, exactly as
      // createLeague documents at length.
      isPublic: true,
      maxMembers: ROOKIE_LEAGUE_MAX_MEMBERS,
      isRookieCircuit: true,
      tag: 'casual',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      // Discovery filters on this; written at creation because a Firestore
      // inequality filter skips documents missing the field entirely.
      seasonActivity: {
        seasonUid,
        activeMembers: [],
        activeMemberCount: 0,
        totalMemberCount: 1,
        updatedAt: new Date(),
      },
      settings: {
        finalsSize: 4,
        entryFee: 0,
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
    // `create`: a colliding code fails the transaction instead of hijacking
    // another league's invite (see helpers/leagueHelpers.js).
    transaction.create(inviteRef, { leagueId: newLeagueRef.id });
    transaction.set(metaPrivateRef, { inviteCode });
    transaction.update(userProfileRef, {
      leagueIds: admin.firestore.FieldValue.arrayUnion(newLeagueRef.id),
    });
    transaction.set(pointerRef, { leagueId: newLeagueRef.id, counter: nextNumber });

    return { leagueId: newLeagueRef.id, leagueName: newName, alreadyMember: false, created: true };
  });

  if (!result.alreadyMember) {
    // Roster changed — recompute season participation, as every other join
    // path does. Only this one skipped it, so a rookie circuit stayed stale
    // until the nightly refresh.
    await refreshLeagueActivity(db, result.leagueId, seasonUid);

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

module.exports.isRookieDirector = isRookieDirector;
module.exports.ROOKIE_MAX_LEVEL = ROOKIE_MAX_LEVEL;
module.exports.ROOKIE_MAX_SEASONS = ROOKIE_MAX_SEASONS;
