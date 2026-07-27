/**
 * Does season archival survive the player base?
 *
 * `archiveSeasonResultsLogic` (helpers/season.js) builds ONE `db.batch()` and
 * commits it once, at the very end, across every league in the game. Per league
 * it crowns, that batch carries roughly:
 *
 *   1  champions[] arrayUnion            1  winner profile update
 *   1  coin-history entry (achievement)  1  league payout update
 *   1  coin-history entry (prize pool)   1  activity-feed entry
 *   N  notifications, one per member
 *
 * Because the commit is the LAST statement of archival, a rejected commit does
 * not partially apply — it throws, `rolloverFromOldSeason` marks the season
 * rollover failed, and NO league in the game gets a champion or a payout. That
 * is why the size of this batch is worth knowing.
 *
 * READ THE RESULT CAREFULLY. The surrounding code describes the danger as
 * Firestore's "500-op ceiling", but that limit is no longer in the published
 * quotas — as of July 2026 the documented ceilings are a 10 MiB maximum API
 * request size and 500 field transformations on a single document. And the
 * emulator enforces neither: during this harness's development it accepted a
 * 5,000-write batch and a 12 MiB one without complaint. So a green result here
 * means "archival ran and crowned everyone at this size", NOT "production would
 * have accepted the commit". Only production can answer that.
 *
 * Season play is not needed: `createLeague`/`joinLeague` seed a standings row
 * per member, so the champion selector has a table to seed from and crowns on
 * standings alone. That is the same archival path, at scale, without 49 days of
 * scoring per configuration.
 */

const admin = require("firebase-admin");
const { paths } = require("../src/helpers/paths");

/** Ops the archival batch spends on one crowned league of `members` members. */
function opsForLeague(memberCount) {
  return 6 + memberCount;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{leagues: number, members: number, log?: Function}} options
 */
async function probeArchivalScale(db, { leagues, members, log = () => {} }) {
  const seasonUid = "scale_season";
  const startDate = new Date(Date.UTC(2026, 5, 21));

  await db.doc("game-settings/season").set({
    name: seasonUid,
    status: "live-season",
    seasonUid,
    seasonYear: 2026,
    dataDocId: seasonUid,
    schedule: {
      startDate: admin.firestore.Timestamp.fromDate(startDate),
      endDate: admin.firestore.Timestamp.fromDate(new Date(startDate.getTime() + 70 * 86400000)),
      springTrainingDays: 21,
    },
  });

  const uids = Array.from({ length: members }, (_, i) => `scale_d${String(i).padStart(3, "0")}`);
  for (const uid of uids) {
    await db.doc(paths.userProfile(uid)).set({
      username: uid,
      displayName: uid,
      activeSeasonId: seasonUid,
      corpsCoin: 100000,
      achievements: [],
      corps: {
        worldClass: {
          corpsName: `${uid} corps`,
          seasonUid,
          lineup: { GE1: "Blue Devils|2025" },
          selectedShows: { week1: [] },
          totalSeasonScore: 10,
        },
      },
      lifetimeStats: { totalSeasons: 0 },
    });
  }

  const functionsTest = require("firebase-functions-test")();
  const leagueCallables = require("../src/callable/leagues");
  const createLeague = functionsTest.wrap(leagueCallables.createLeague);
  const joinLeague = functionsTest.wrap(leagueCallables.joinLeague);

  for (let i = 0; i < leagues; i++) {
    const result = await createLeague({
      data: {
        name: `Scale League ${i}`,
        description: "archival batch probe",
        isPublic: true,
        maxMembers: members + 5,
        settings: { finalsSize: 12, entryFee: 0 },
      },
      auth: { uid: uids[0], token: {} },
    });
    for (const uid of uids.slice(1)) {
      await joinLeague({ data: { leagueId: result.leagueId }, auth: { uid, token: {} } });
    }
    log(`  seeded league ${i + 1}/${leagues}`);
  }

  const projectedOps = leagues * opsForLeague(members);

  const { archiveSeasonResultsLogic } = require("../src/helpers/season");
  let error = null;
  try {
    await archiveSeasonResultsLogic(db, { seasonUid, seasonName: seasonUid });
  } catch (caught) {
    error = caught;
  }

  // Count what actually landed.
  const snapshot = await db.collection(paths.leagues()).get();
  let crowned = 0;
  for (const doc of snapshot.docs) {
    if ((doc.data().champions || []).some((c) => c.seasonId === seasonUid)) crowned += 1;
  }

  return { leagues, members, projectedOps, crowned, error };
}

module.exports = { probeArchivalScale, opsForLeague };
