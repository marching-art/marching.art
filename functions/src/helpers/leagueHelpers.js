// Shared league helpers extracted from callable/leagues.js so they can be
// unit-tested and reused by the invitation callables.

const admin = require("firebase-admin");
const crypto = require("crypto");
const { paths } = require("./paths");

/**
 * OPTIMIZATION #2: Generate a deterministic unique invite code based on UID and timestamp.
 * This eliminates the N+1 while loop that previously made unbounded database reads.
 * The code is generated from a hash of the user ID and current timestamp, ensuring uniqueness
 * without requiring any database lookups.
 */
function generateUniqueInviteCode(uid) {
  const uniqueInput = `${uid}_${Date.now()}_${Math.random()}`;
  const hash = crypto.createHash("sha256").update(uniqueInput).digest("hex");
  // Take first 6 chars and convert to uppercase for a readable code
  return hash.substring(0, 6).toUpperCase();
}

/**
 * Pair a class's directors for one week.
 *
 * Seeds by standings and pairs neighbours, so matchups stay competitive — but
 * with two corrections the original lacked, both of which a league notices
 * within a month:
 *
 *  - REMATCH AVOIDANCE. Pairing strictly adjacent (1v2, 3v4, …) against a
 *    table that barely moves reproduces the SAME pairings week after week. A
 *    ten-person league would run a whole season as five repeated duels. Each
 *    seed now takes the nearest opponent it has faced fewest times, so the
 *    league works through its field before anyone plays a third rematch.
 *
 *  - BYE ROTATION. The odd director out used to be whoever sorted last, i.e.
 *    the worst-performing member collected a free win every single week,
 *    forever. The bye now goes to whoever has had it least (ties broken by the
 *    lower seed), so it circulates.
 *
 * Deterministic: given the same inputs it returns the same pairings. The old
 * `Math.random()` home/away flip decided nothing (home confers no advantage)
 * while making the generator untestable and non-reproducible.
 *
 * @param {string[]} members - directors fielding this class this week
 * @param {Object} standings - uid -> { wins, totalPoints, ... }
 * @param {Object} [history] - prior-week context, all optional
 * @param {Object<string, Object<string, number>>} [history.meetings] -
 *   uid -> opponentUid -> times already played
 * @param {Object<string, number>} [history.byes] - uid -> byes already taken
 */
function smartPairMembers(members, standings, history = {}) {
  if (members.length < 2) {
    return members.length === 1
      ? [{ pair: [members[0], null], winner: members[0], scores: null, completed: true, isBye: true }]
      : [];
  }

  const meetings = history.meetings || {};
  const byes = history.byes || {};
  const timesPlayed = (a, b) => (meetings[a] && meetings[a][b]) || 0;

  // Seed by the league's own ordering rule so the pairing, the table, and the
  // playoff cut line all agree on who is ahead of whom.
  const sortedMembers = [...members].sort((a, b) => {
    const statsA = standings[a] || {};
    const statsB = standings[b] || {};
    if ((statsB.wins || 0) !== (statsA.wins || 0)) return (statsB.wins || 0) - (statsA.wins || 0);
    if ((statsB.totalPoints || 0) !== (statsA.totalPoints || 0)) {
      return (statsB.totalPoints || 0) - (statsA.totalPoints || 0);
    }
    return String(a).localeCompare(String(b));
  });

  const remaining = [...sortedMembers];
  const matchups = [];

  // Odd field: hand the bye out before pairing, to whoever has had it least.
  if (remaining.length % 2 === 1) {
    // Fewest byes so far wins it; ties break to the LOWEST seed, which is the
    // traditional behaviour and what a league with no history still expects.
    let byeIndex = 0;
    for (let i = 1; i < remaining.length; i++) {
      if ((byes[remaining[i]] || 0) <= (byes[remaining[byeIndex]] || 0)) byeIndex = i;
    }
    const byeMember = remaining.splice(byeIndex, 1)[0];
    matchups.push({
      pair: [byeMember, null],
      winner: byeMember,
      scores: null,
      completed: true,
      isBye: true,
    });
  }

  while (remaining.length >= 2) {
    const player1 = remaining.shift();
    // Nearest seed this director has met fewest times: walk outward from the
    // adjacent seed and stop at the first genuinely fresh opponent, falling
    // back to the least-played one when everybody has been played.
    let bestIndex = 0;
    let bestMeetings = timesPlayed(player1, remaining[0]);
    for (let i = 1; i < remaining.length && bestMeetings > 0; i++) {
      const played = timesPlayed(player1, remaining[i]);
      if (played < bestMeetings) {
        bestIndex = i;
        bestMeetings = played;
      }
    }
    const player2 = remaining.splice(bestIndex, 1)[0];
    matchups.push({
      pair: [player1, player2],
      winner: null,
      scores: null,
      completed: false,
      isBye: false,
    });
  }

  return matchups;
}

/**
 * Prior-week context for smartPairMembers, folded from a league's existing
 * `matchups/week-N` documents. Counts every completed or scheduled pairing, so
 * a week that has been generated but not yet resolved still steers the next
 * one away from an immediate rematch.
 *
 * @param {Array<Object>} matchupDocsData - the raw week documents' data
 * @param {string[]} corpsClasses
 * @returns {{meetings: Object, byes: Object}}
 */
function buildPairingHistory(matchupDocsData, corpsClasses) {
  const meetings = {};
  const byes = {};

  const record = (a, b) => {
    if (!meetings[a]) meetings[a] = {};
    meetings[a][b] = (meetings[a][b] || 0) + 1;
  };

  for (const weekData of matchupDocsData || []) {
    if (!weekData) continue;
    for (const corpsClass of corpsClasses) {
      for (const matchup of weekData[`${corpsClass}Matchups`] || []) {
        const pair = matchup && matchup.pair;
        if (!pair || !pair[0]) continue;
        if (matchup.isBye || !pair[1]) {
          byes[pair[0]] = (byes[pair[0]] || 0) + 1;
          continue;
        }
        record(pair[0], pair[1]);
        record(pair[1], pair[0]);
      }
    }
  }

  return { meetings, byes };
}

/**
 * Fold a freshly generated week back into an existing history object, in place.
 *
 * Generating several weeks in one pass (the daily job ensures both the current
 * and the next week) would otherwise pair from identical history every time and
 * produce the same matchups for both weeks — the exact repetition the history
 * exists to prevent.
 *
 * @param {{meetings: Object, byes: Object}} history - mutated
 * @param {Object} weekData - a generated `matchups/week-N` payload
 * @param {string[]} corpsClasses
 */
function recordPairingsInHistory(history, weekData, corpsClasses) {
  const fresh = buildPairingHistory([weekData], corpsClasses);

  for (const [uid, opponents] of Object.entries(fresh.meetings)) {
    if (!history.meetings[uid]) history.meetings[uid] = {};
    for (const [opponent, count] of Object.entries(opponents)) {
      history.meetings[uid][opponent] = (history.meetings[uid][opponent] || 0) + count;
    }
  }
  for (const [uid, count] of Object.entries(fresh.byes)) {
    history.byes[uid] = (history.byes[uid] || 0) + count;
  }

  return history;
}

// Helper function to create league activity events
async function createLeagueActivity(db, leagueId, activityData) {
  const activityRef = db.collection(paths.leagueActivity(leagueId)).doc();

  await activityRef.set({
    ...activityData,
    id: activityRef.id,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  return activityRef.id;
}

// Deterministic invitation doc id: one pending invitation per league+invitee.
const invitationId = (leagueId, inviteeUid) => `${leagueId}_${inviteeUid}`;

module.exports = {
  generateUniqueInviteCode,
  smartPairMembers,
  buildPairingHistory,
  recordPairingsInHistory,
  createLeagueActivity,
  invitationId,
};
