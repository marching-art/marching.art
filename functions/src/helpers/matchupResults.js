/**
 * Matchup-result pushes — "your league week is settled."
 *
 * Weekly league matchups are resolved at the week boundary by the nightly
 * scoring pipeline; generateWeeklyRecaps (scheduled/leagueAutomation.js)
 * then reads the completed matchup doc to write each league's recap. This
 * builder turns that same in-memory matchup doc into one push per member:
 * a single settled matchup gets the full score line, multiple matchups
 * (one per class) get a W-L summary. Byes and unsettled matchups are
 * skipped — nobody is pinged about a week that didn't happen.
 */

// Matchups exist for every matchup-eligible class (incl. Podium), not just
// the lineup-bearing fantasy classes — mirror generateWeeklyMatchups.
const { MATCHUP_CLASSES } = require("./classRegistry");
const { CLASS_LABELS } = require("./scoreDrop");

/** Keep user-authored names from blowing up push copy. */
function clampName(name, max = 40) {
  const text = String(name || "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatScore(value) {
  return (Number(value) || 0).toFixed(3);
}

/**
 * Collect each member's settled results across the week's class matchups.
 * @returns {Map<string, Array<{won: boolean|null, opponentName: string,
 *   myScore: number, oppScore: number, corpsClass: string}>>}
 */
function collectMemberResults(matchupData, memberProfiles) {
  const byUid = new Map();

  for (const corpsClass of MATCHUP_CLASSES) {
    for (const matchup of matchupData?.[`${corpsClass}Matchups`] || []) {
      if (matchup.isBye || !matchup.completed || !matchup.scores) continue;
      const [p1, p2] = matchup.pair || [];
      if (!p1 || !p2) continue;

      for (const [uid, opponent] of [[p1, p2], [p2, p1]]) {
        const myScore = matchup.scores[uid] || 0;
        const oppScore = matchup.scores[opponent] || 0;
        // Trust the settled winner; fall back to the score line, with equal
        // scores (and no winner) reported as a tie. A tie is stored as the
        // string 'tie', which is not a uid, so it reads as won: false for
        // both — compare against the pair explicitly instead.
        const won =
          matchup.winner === uid
            ? true
            : matchup.winner === opponent
              ? false
              : matchup.winner
                ? null
                : myScore === oppScore
                  ? null
                  : myScore > oppScore;
        const results = byUid.get(uid) || [];
        results.push({
          won,
          opponentName: memberProfiles?.[opponent]?.displayName || "your opponent",
          myScore,
          oppScore,
          // Cross-class matchups (leagueHelpers.js pairLeagueWeek) carry each
          // side's own class and are decided on class percentiles — the push
          // copy must not imply the raw score line settled them.
          corpsClass: matchup.classes?.[uid] || corpsClass,
          crossClass: Boolean(matchup.crossClass),
          myPercentile: matchup.normalized?.[uid],
          oppPercentile: matchup.normalized?.[opponent],
        });
        byUid.set(uid, results);
      }
    }
  }
  return byUid;
}

function singleResultBody(result, leagueName) {
  const opponent = clampName(result.opponentName);
  const league = clampName(leagueName || "your league");
  const label = CLASS_LABELS[result.corpsClass] || result.corpsClass;

  // Decided on each corps' finish against its own class, not the raw totals —
  // quoting the score line would routinely contradict the verdict.
  if (result.crossClass) {
    if (result.won === null) {
      return `Your cross-class matchup vs ${opponent} ended level (${league}).`;
    }
    return result.won
      ? `You beat ${opponent} in your cross-class matchup — your ${label} week outranked theirs (${league})!`
      : `You fell to ${opponent} in your cross-class matchup — their week outranked your ${label} run (${league}).`;
  }

  const line = `${formatScore(result.myScore)}–${formatScore(result.oppScore)}`;

  if (result.won === null) {
    return `You tied ${opponent} ${line} in ${label} (${league}).`;
  }
  return result.won
    ? `You beat ${opponent} ${line} in ${label} (${league})!`
    : `You fell to ${opponent} ${formatScore(result.oppScore)}–${formatScore(result.myScore)} in ${label} (${league}).`;
}

function summaryBody(results, leagueName) {
  const wins = results.filter((r) => r.won === true).length;
  const losses = results.filter((r) => r.won === false).length;
  const ties = results.filter((r) => r.won === null).length;
  const record = `${wins}W–${losses}L${ties ? `–${ties}T` : ""}`;
  const league = clampName(leagueName || "Your league");
  return `${league}: you went ${record} across your matchups this week. Tap for the recaps.`;
}

/**
 * Build one matchup-result push per league member with settled matchups.
 *
 * @param {Object} params
 * @param {string} params.leagueName
 * @param {number} params.week
 * @param {Object} params.matchupData - leagues/{id}/matchups/week-{n} doc data
 * @param {Object} params.memberProfiles - uid -> profile data (displayName)
 * @returns {Array<{uid: string, title: string, body: string, url: string, data: Object}>}
 */
function buildMatchupResultPushes({ leagueName, week, matchupData, memberProfiles }) {
  const byUid = collectMemberResults(matchupData, memberProfiles);
  const title = `Week ${week} results are in 🏆`;

  const pushes = [];
  for (const [uid, results] of byUid) {
    pushes.push({
      uid,
      title,
      body:
        results.length === 1
          ? singleResultBody(results[0], leagueName)
          : summaryBody(results, leagueName),
      url: "/leagues",
      data: { week: String(week), matchups: String(results.length) },
    });
  }
  return pushes;
}

module.exports = { buildMatchupResultPushes, collectMemberResults };
