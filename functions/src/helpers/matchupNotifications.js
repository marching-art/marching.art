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

/** 1 -> "1st", 42 -> "42nd", 100 -> "100th". */
function ordinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const rem10 = n % 10;
  if (rem10 === 1) return `${n}st`;
  if (rem10 === 2) return `${n}nd`;
  if (rem10 === 3) return `${n}rd`;
  return `${n}th`;
}

/** One participant's view of a resolved head-to-head. */
function buildResultEntry(params) {
  const {
    uid,
    opponentName,
    userScore,
    opponentScore,
    userAverage,
    opponentAverage,
    outcome, // 'win' | 'loss' | 'tie'
    week,
    corpsClass,
    crossClass = false,
    userPercentile,
    opponentPercentile,
    userBest,
    opponentBest,
    leagueId,
    leagueName,
    seasonUid,
  } = params;

  // A cross-class matchup is decided on each corps' percentile against its own
  // class, not raw points (leagueScoring.js decideHeadToHead) — leading with
  // the raw score line there would routinely contradict the verdict it
  // announces, so the copy names the finishes that actually decided it.
  const percentLine =
    crossClass && typeof userPercentile === "number" && typeof opponentPercentile === "number"
      ? `you finished in the ${ordinal(Math.round(userPercentile))} percentile of your class, ` +
        `they in the ${ordinal(Math.round(opponentPercentile))} of theirs`
      : null;
  // On a One-Night Slate week the best single shows decided it, so those are
  // the numbers the copy quotes — the weekly totals could contradict the
  // verdict they announce. Everywhere else the default format decides on the
  // per-show average (leagueScoring.js), so that is the line; the bare total
  // survives only for pairs resolved before averages were recorded.
  const scoreLine =
    typeof userBest === "number" && typeof opponentBest === "number"
      ? `best show ${userBest.toFixed(3)} – ${opponentBest.toFixed(3)}`
      : typeof userAverage === "number" && typeof opponentAverage === "number"
        ? `averaging ${userAverage.toFixed(3)} – ${opponentAverage.toFixed(3)} per show`
        : `${userScore.toFixed(3)} – ${opponentScore.toFixed(3)}`;
  let title;
  let message;
  if (outcome === "win") {
    title = "You won your matchup!";
    message = percentLine
      ? `You beat ${opponentName} in your Week ${week} cross-class matchup — ${percentLine}.`
      : `You beat ${opponentName} in your Week ${week} matchup, ${scoreLine}.`;
  } else if (outcome === "loss") {
    title = "Matchup result";
    message = percentLine
      ? `You lost to ${opponentName} in your Week ${week} cross-class matchup — ${percentLine}.`
      : `You lost to ${opponentName} in your Week ${week} matchup, ${scoreLine}.`;
  } else {
    title = "Matchup result";
    message = percentLine
      ? `Your Week ${week} cross-class matchup vs ${opponentName} ended level — ${percentLine}.`
      : `Your Week ${week} matchup vs ${opponentName} ended in a tie, ${scoreLine}.`;
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
    // Decided on class percentiles rather than points when the two sides
    // fielded different classes (leagueScoring.js decideHeadToHead).
    const crossClass = Boolean(
      pair.player1Class && pair.player2Class && pair.player1Class !== pair.player2Class
    );
    const common = { week, corpsClass: pair.corpsClass, crossClass, leagueId, leagueName, seasonUid };

    entries.push(
      buildResultEntry({
        ...common,
        uid: p1,
        opponentName: nameOf(p2),
        userScore: s1,
        opponentScore: s2,
        userAverage: pair.player1Average,
        opponentAverage: pair.player2Average,
        userPercentile: pair.player1Normalized,
        opponentPercentile: pair.player2Normalized,
        userBest: pair.player1Best,
        opponentBest: pair.player2Best,
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
        userAverage: pair.player2Average,
        opponentAverage: pair.player1Average,
        userPercentile: pair.player2Normalized,
        opponentPercentile: pair.player1Normalized,
        userBest: pair.player2Best,
        opponentBest: pair.player1Best,
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
