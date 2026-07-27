/**
 * League standings updater — shared by the commissioner callable
 * (callable/leagues.js updateMatchupResults) and the automatic weekly
 * matchup resolution in the nightly scoring run
 * (helpers/weeklyMatchups.js processWeeklyMatchups).
 *
 * Takes resolved pairs in the shape both producers emit:
 *   { player1, player2|null, player1Score?, player2Score?,
 *     winner: uid | 'tie', completed: boolean }
 * and folds them into the league's standings/current doc (records map +
 * sorted standings array the frontend reads).
 *
 * The fold is NOT idempotent per pair — each pair must be counted exactly
 * once. That is why every write path is transactional: the old get-then-
 * update flow let two concurrent folds (a commissioner call racing the
 * nightly run, or two commissioner calls) read the same base records and
 * double-count the same week into wins/losses/streaks.
 */

const admin = require("firebase-admin");

/**
 * Pure fold: applies resolved pairs to a records map and derives the sorted
 * standings array. Mutates nothing — returns fresh objects.
 *
 * @param {Object} baseRecords records map from standings/current
 * @param {Array} pairs resolved matchup pairs (see module header)
 * @returns {{records: Object, standings: Array}}
 */
const EMPTY_RECORD = {
  wins: 0,
  losses: 0,
  ties: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  currentStreak: 0,
  streakType: null,
};

function foldPairsIntoStandings(baseRecords, pairs) {
  const records = {};
  for (const [uid, data] of Object.entries(baseRecords || {})) {
    records[uid] = { ...EMPTY_RECORD, ...data };
  }

  // Every director in a resolved pair gets a row. The fold used to be guarded
  // by `if (records[uid])` at every branch, so a member whose record was never
  // seeded — a league created before standings existed, a roster repaired by
  // hand, a member added by a path that skipped the standings write — played
  // their whole season without a single result being recorded, silently.
  const ensureRecord = (uid) => {
    if (uid && !records[uid]) records[uid] = { ...EMPTY_RECORD };
  };
  pairs.forEach((pair) => {
    if (!pair.completed || pair.winner === null) return;
    ensureRecord(pair.player1);
    ensureRecord(pair.player2);
  });

  pairs.forEach(pair => {
    if (!pair.completed || pair.winner === null) return;

    if (pair.player2 === null) {
      // Bye week - count as a win
      if (records[pair.player1]) {
        records[pair.player1].wins += 1;
        records[pair.player1].currentStreak = records[pair.player1].streakType === 'W'
          ? records[pair.player1].currentStreak + 1
          : 1;
        records[pair.player1].streakType = 'W';
      }
    } else if (pair.winner === 'tie') {
      // Tie
      if (records[pair.player1]) {
        records[pair.player1].ties += 1;
        records[pair.player1].pointsFor += pair.player1Score || 0;
        records[pair.player1].pointsAgainst += pair.player2Score || 0;
        records[pair.player1].currentStreak = 0;
        records[pair.player1].streakType = null;
      }
      if (records[pair.player2]) {
        records[pair.player2].ties += 1;
        records[pair.player2].pointsFor += pair.player2Score || 0;
        records[pair.player2].pointsAgainst += pair.player1Score || 0;
        records[pair.player2].currentStreak = 0;
        records[pair.player2].streakType = null;
      }
    } else {
      // One player won
      const loser = pair.winner === pair.player1 ? pair.player2 : pair.player1;

      if (records[pair.winner]) {
        records[pair.winner].wins += 1;
        records[pair.winner].pointsFor += (pair.winner === pair.player1 ? pair.player1Score : pair.player2Score) || 0;
        records[pair.winner].pointsAgainst += (pair.winner === pair.player1 ? pair.player2Score : pair.player1Score) || 0;
        records[pair.winner].currentStreak = records[pair.winner].streakType === 'W'
          ? records[pair.winner].currentStreak + 1
          : 1;
        records[pair.winner].streakType = 'W';
      }

      if (records[loser]) {
        records[loser].losses += 1;
        records[loser].pointsFor += (loser === pair.player1 ? pair.player1Score : pair.player2Score) || 0;
        records[loser].pointsAgainst += (loser === pair.player1 ? pair.player2Score : pair.player1Score) || 0;
        records[loser].currentStreak = records[loser].streakType === 'L'
          ? records[loser].currentStreak + 1
          : 1;
        records[loser].streakType = 'L';
      }
    }
  });

  // Convert records object to sorted standings array (for frontend compatibility)
  const standings = Object.entries(records)
    .map(([uid, data]) => ({
      uid,
      wins: data.wins || 0,
      losses: data.losses || 0,
      ties: data.ties || 0,
      totalPoints: data.pointsFor || 0,
      pointsAgainst: data.pointsAgainst || 0,
      streak: data.currentStreak || 0,
      streakType: data.streakType || null,
    }))
    .sort(compareStandingRows);

  return { records, standings };
}

/**
 * The league's ordering rule, in one place so the table, the playoff cut line,
 * and the champion selector can never disagree about who is first.
 *
 * Win percentage before raw wins: byes, and directors who field a class for
 * only part of a season, mean members do not all play the same number of
 * matchups. Ranking on raw wins alone rewarded whoever happened to be paired
 * most often. Ties count as half a win, the standard convention.
 *
 * Order: win% → wins → points for → points against (fewer is better) → uid, so
 * the result is total and deterministic rather than dependent on object key
 * order.
 */
function winPercentage(row) {
  const wins = row.wins || 0;
  const losses = row.losses || 0;
  const ties = row.ties || 0;
  const played = wins + losses + ties;
  if (played === 0) return 0;
  return (wins + ties / 2) / played;
}

function compareStandingRows(a, b) {
  const pctDiff = winPercentage(b) - winPercentage(a);
  if (pctDiff !== 0) return pctDiff;
  if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
  if ((b.totalPoints || 0) !== (a.totalPoints || 0)) {
    return (b.totalPoints || 0) - (a.totalPoints || 0);
  }
  if ((a.pointsAgainst || 0) !== (b.pointsAgainst || 0)) {
    return (a.pointsAgainst || 0) - (b.pointsAgainst || 0);
  }
  return String(a.uid).localeCompare(String(b.uid));
}

/**
 * Fold pairs into standings/current inside an existing transaction. The
 * standings doc MUST have been read through the same transaction (Firestore
 * requires all reads before writes) and is passed in as standingsDoc.
 *
 * @param {FirebaseFirestore.Transaction} t
 * @param {FirebaseFirestore.DocumentSnapshot} standingsDoc snapshot of
 *   standings/current read via t.get()
 * @param {Array} pairs resolved matchup pairs
 */
function applyStandingsInTransaction(t, standingsDoc, pairs) {
  if (!standingsDoc.exists) return;

  const { records, standings } = foldPairsIntoStandings(standingsDoc.data().records, pairs);

  t.update(standingsDoc.ref, {
    records,
    standings, // Array format for frontend API
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Standalone transactional fold — reads standings/current and applies the
 * pairs atomically. Used by the nightly weekly resolution, whose matchup
 * docs are committed separately under the scoringRunGuard lease.
 */
async function updateStandings(db, leagueRef, pairs) {
  const standingsRef = leagueRef.collection('standings').doc('current');
  await db.runTransaction(async (t) => {
    const standingsDoc = await t.get(standingsRef);
    applyStandingsInTransaction(t, standingsDoc, pairs);
  });
}

module.exports = {
  foldPairsIntoStandings,
  applyStandingsInTransaction,
  updateStandings,
  compareStandingRows,
  winPercentage,
};
