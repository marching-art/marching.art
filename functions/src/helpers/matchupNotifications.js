/**
 * Per-director bell notifications for weekly league matchups.
 *
 * The weekly resolution already drops a SUMMARY into the shared league activity
 * feed ("N matchups decided in week W") and updates the table, but until now
 * nothing told an individual director "you won/lost your week" or "you slipped
 * in the standings" in their own inbox. This builds both from the resolved
 * pairs + the standings diff and fans them out through the shared writer.
 *
 * Best-effort by construction: createUserNotifications never throws, and this
 * is always called AFTER the matchup/standings writes commit, so a notification
 * failure can never affect a scored result. Idempotent via dedupeKey, so a
 * scoring re-run (or the commissioner's manual re-resolve) converges on the
 * same inbox entries instead of duplicating them.
 */

const { logger } = require("firebase-functions/v2");
const { paths } = require("./paths");
const { computeRankDrops } = require("./leagueStandings");
const { createUserNotifications } = require("./userNotifications");

/** One participant's view of a resolved head-to-head. */
function buildResultEntry(params) {
  const {
    uid,
    opponentName,
    userScore,
    opponentScore,
    outcome, // 'win' | 'loss' | 'tie'
    week,
    corpsClass,
    leagueId,
    leagueName,
    seasonUid,
  } = params;

  const scoreLine = `${userScore.toFixed(3)} – ${opponentScore.toFixed(3)}`;
  let title;
  let message;
  if (outcome === "win") {
    title = "You won your matchup!";
    message = `You beat ${opponentName} in your Week ${week} matchup, ${scoreLine}.`;
  } else if (outcome === "loss") {
    title = "Matchup result";
    message = `You lost to ${opponentName} in your Week ${week} matchup, ${scoreLine}.`;
  } else {
    title = "Matchup result";
    message = `Your Week ${week} matchup vs ${opponentName} ended in a tie, ${scoreLine}.`;
  }

  return {
    uid,
    type: "matchup_result",
    title,
    message,
    link: `/leagues/${leagueId}`,
    leagueId,
    leagueName,
    metadata: {
      week,
      corpsClass,
      opponentName,
      userScore,
      opponentScore,
      won: outcome === "win",
    },
    // Per class so a director fielding more than one class in a week gets one
    // entry per matchup rather than having them collapse together.
    dedupeKey: `matchup_result_${seasonUid}_w${week}_${leagueId}_${corpsClass}_${uid}`,
  };
}

/**
 * Build the inbox entries for one league's resolved week. Pure — takes the
 * already-resolved pairs and the standings diff, resolves display names, and
 * returns the entry array (does not write). Exposed for unit testing.
 *
 * @param {Map<string,string>} nameByUid
 * @param {Object} args
 * @returns {Array<Object>}
 */
function buildMatchupEntries(nameByUid, { pairs, previousStandings, newStandings, week, leagueId, leagueName, seasonUid }) {
  const entries = [];
  const played = new Set();
  const nameOf = (uid) => nameByUid.get(uid) || "a director";

  for (const pair of pairs || []) {
    const p1 = pair.player1;
    const p2 = pair.player2;
    if (p1) played.add(p1);
    if (p2) played.add(p2);
    // A bye (no opponent) has no head-to-head result to report.
    if (!p1 || !p2) continue;

    const s1 = Number(pair.player1Score || 0);
    const s2 = Number(pair.player2Score || 0);
    const winner = pair.winner; // a uid, or 'tie'
    const outcome1 = winner === "tie" ? "tie" : winner === p1 ? "win" : "loss";
    const outcome2 = winner === "tie" ? "tie" : winner === p2 ? "win" : "loss";
    const common = { week, corpsClass: pair.corpsClass, leagueId, leagueName, seasonUid };

    entries.push(
      buildResultEntry({
        ...common,
        uid: p1,
        opponentName: nameOf(p2),
        userScore: s1,
        opponentScore: s2,
        outcome: outcome1,
      })
    );
    entries.push(
      buildResultEntry({
        ...common,
        uid: p2,
        opponentName: nameOf(p1),
        userScore: s2,
        opponentScore: s1,
        outcome: outcome2,
      })
    );
  }

  // standings_change — only for directors who actually played this week and
  // dropped in the overall table (someone passed them).
  for (const drop of computeRankDrops(previousStandings, newStandings, played)) {
    entries.push({
      uid: drop.uid,
      type: "standings_change",
      title: "You slipped in the standings",
      message: `You dropped from #${drop.previousRank} to #${drop.newRank} in ${leagueName}.`,
      link: `/leagues/${leagueId}`,
      leagueId,
      leagueName,
      metadata: { previousRank: drop.previousRank, newRank: drop.newRank, week },
      dedupeKey: `standings_change_${seasonUid}_w${week}_${leagueId}_${drop.uid}`,
    });
  }

  return entries;
}

/**
 * Resolve names, build, and send matchup_result + standings_change
 * notifications for one league's resolved week. Never throws.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} args - { leagueId, leagueName, week, seasonUid, pairs,
 *   previousStandings, newStandings }
 * @returns {Promise<{written: number, skipped: number}>}
 */
async function sendMatchupNotifications(db, args) {
  try {
    const { pairs } = args;
    const uids = new Set();
    for (const pair of pairs || []) {
      if (pair.player1) uids.add(pair.player1);
      if (pair.player2) uids.add(pair.player2);
    }
    if (uids.size === 0) return { written: 0, skipped: 0 };

    const uidList = [...uids];
    const profileDocs = await db.getAll(
      ...uidList.map((uid) => db.doc(paths.userProfile(uid))),
      { fieldMask: ["username", "displayName"] }
    );
    const nameByUid = new Map();
    profileDocs.forEach((doc, i) => {
      const data = doc.exists ? doc.data() : null;
      nameByUid.set(uidList[i], (data && (data.displayName || data.username)) || "a director");
    });

    const entries = buildMatchupEntries(nameByUid, args);
    return createUserNotifications(db, entries);
  } catch (error) {
    // Never let a derived-view notification fail the scored result that
    // triggered it.
    logger.error(`Matchup notifications failed for league ${args && args.leagueId}:`, error);
    return { written: 0, skipped: 0 };
  }
}

module.exports = {
  buildResultEntry,
  buildMatchupEntries,
  sendMatchupNotifications,
};
