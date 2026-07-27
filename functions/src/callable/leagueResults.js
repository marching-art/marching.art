/**
 * Commissioner result correction.
 *
 * A resolved matchup was final and unappealable. If a week resolved against
 * missing recap data, or a director's shows were re-scored, or the pairing
 * itself was wrong, there was nothing anyone could do — the standings fold is
 * deliberately not idempotent (each pair counts exactly once), which makes
 * "unfold the old result and fold the new one" the kind of arithmetic that goes
 * wrong silently.
 *
 * So corrections do not unfold anything. The matchup document is edited and the
 * whole table is rebuilt from every resolved matchup in week order
 * (helpers/leagueStandings.js rebuildStandingsFromMatchups). That is also the
 * escape hatch for a table that has drifted for any other reason, which is why
 * the rebuild is exposed on its own.
 *
 * Both are logged to the activity feed: overriding a result changes someone's
 * season, and members are entitled to see it happen.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const {
  assertAuth,
  hasAdminClaim,
  assertWriteBudget,
  assertDocId,
} = require("../helpers/callableGuards");
const { createLeagueActivity } = require("../helpers/leagueHelpers");
const { isLeagueCommissioner } = require("../helpers/leaguePermissions");
const { rebuildStandingsFromMatchups } = require("../helpers/leagueStandings");
const { MATCHUP_CLASSES } = require("../helpers/classRegistry");

/** Read every `week-N` document and rewrite standings/current from them. */
async function rebuildAndWriteStandings(db, leagueId, members) {
  const snapshot = await db.collection(paths.leagueMatchups(leagueId)).get();
  const weekDocs = snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  const { records, standings } = rebuildStandingsFromMatchups(weekDocs, MATCHUP_CLASSES, members);

  await db.doc(paths.leagueStandings(leagueId)).set(
    {
      records,
      standings,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return standings.length;
}

async function loadLeagueForCommissioner(db, leagueId, request) {
  const leagueDoc = await db.doc(paths.league(leagueId)).get();
  if (!leagueDoc.exists) throw new HttpsError("not-found", "League not found.");
  const league = leagueDoc.data();
  if (!isLeagueCommissioner(league, request.auth.uid) && !hasAdminClaim(request)) {
    throw new HttpsError("permission-denied", "Only a commissioner can do that.");
  }
  return league;
}

exports.recomputeLeagueStandings = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { leagueId } = request.data || {};
  const uid = request.auth.uid;

  if (!leagueId) throw new HttpsError("invalid-argument", "A league ID is required.");
  assertDocId(leagueId, "league ID");

  const db = getDb();
  await assertWriteBudget(db, uid, "leagueAdmin", { max: 10, windowMs: 60 * 60 * 1000 });

  const league = await loadLeagueForCommissioner(db, leagueId, request);
  const rows = await rebuildAndWriteStandings(db, leagueId, league.members || []);

  logger.info(`Standings rebuilt for league ${leagueId} by ${uid} (${rows} rows).`);
  return { success: true, rows, message: `Standings rebuilt from ${rows} director(s).` };
});

exports.overrideMatchupResult = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { leagueId, week, corpsClass, matchupIndex, winner } = request.data || {};
  const uid = request.auth.uid;

  if (!leagueId || !Number.isInteger(week) || !corpsClass || !Number.isInteger(matchupIndex)) {
    throw new HttpsError(
      "invalid-argument",
      "A league ID, week, corps class, and matchup index are required."
    );
  }
  assertDocId(leagueId, "league ID");
  if (!MATCHUP_CLASSES.includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Unknown corps class.");
  }
  // `winner` is a participant uid, or 'tie'. Anything else would put a value
  // into the matchup document that the standings fold cannot interpret.
  if (typeof winner !== "string" || !winner) {
    throw new HttpsError("invalid-argument", "A winner (a director's ID, or 'tie') is required.");
  }

  const db = getDb();
  await assertWriteBudget(db, uid, "leagueAdmin", { max: 20 });

  const league = await loadLeagueForCommissioner(db, leagueId, request);

  const matchupRef = db.doc(paths.leagueMatchupWeek(leagueId, week));
  const { previousWinner, pair } = await db.runTransaction(async (t) => {
    const matchupDoc = await t.get(matchupRef);
    if (!matchupDoc.exists) {
      throw new HttpsError("not-found", `Week ${week} has no matchups.`);
    }

    const data = matchupDoc.data();
    const key = `${corpsClass}Matchups`;
    const matchups = data[key] || [];
    const matchup = matchups[matchupIndex];
    if (!matchup) {
      throw new HttpsError("not-found", "That matchup does not exist.");
    }
    if (matchup.isBye || !matchup.pair?.[1]) {
      throw new HttpsError("failed-precondition", "A bye has no result to override.");
    }
    if (winner !== "tie" && !matchup.pair.includes(winner)) {
      throw new HttpsError(
        "invalid-argument",
        "The winner has to be one of the two directors in the matchup."
      );
    }

    const updated = [...matchups];
    updated[matchupIndex] = {
      ...matchup,
      winner,
      completed: true,
      // Kept so the table can say a result was corrected rather than silently
      // disagreeing with the score everyone remembers.
      overriddenBy: uid,
      overriddenAt: new Date(),
      originalWinner: matchup.overriddenBy ? matchup.originalWinner : (matchup.winner ?? null),
    };

    t.update(matchupRef, { [key]: updated });
    return { previousWinner: matchup.winner ?? null, pair: matchup.pair };
  });

  // Rebuilt, never unfolded: the fold counts each pair exactly once, so
  // subtracting an old result and adding a new one is exactly the arithmetic
  // that goes wrong quietly.
  const rows = await rebuildAndWriteStandings(db, leagueId, league.members || []);

  await createLeagueActivity(db, leagueId, {
    type: "result_overridden",
    title: `Week ${week} Result Corrected`,
    message: "The commissioner corrected a matchup result. Standings have been recalculated.",
    userId: uid,
    metadata: { week, corpsClass, matchupIndex, previousWinner, winner, pair },
  });

  logger.info(
    `League ${leagueId} week ${week} ${corpsClass}[${matchupIndex}] overridden by ${uid}: ` +
      `${previousWinner} -> ${winner}.`
  );
  return { success: true, rows, message: "Result corrected and standings recalculated." };
});

module.exports.rebuildAndWriteStandings = rebuildAndWriteStandings;
