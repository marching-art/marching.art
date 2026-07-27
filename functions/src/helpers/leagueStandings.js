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
  // Sum of this director's weekly class percentiles — "how did you do against
  // your OWN field", which means the same thing in every corps class. Raw
  // points do not: a World Class week is ~90 and a SoundSport week ~60, so
  // ranking a mixed-class league on points sorted by class, not by
  // performance. See helpers/leagueScoring.js applyClassPercentiles.
  normalizedFor: 0,
  normalizedWeeks: 0,
  currentStreak: 0,
  streakType: null,
};

function foldPairsIntoStandings(baseRecords, pairs) {
  const records = {};
  for (const [uid, data] of Object.entries(baseRecords || {})) {
    records[uid] = { ...EMPTY_RECORD, ...data };
  }

  // Counted only when the pair actually carries a percentile: matchups resolved
  // before normalization existed have none, and averaging a missing value in as
  // 0 would punish every director for the age of their league.
  const addNormalized = (record, value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return;
    record.normalizedFor += value;
    record.normalizedWeeks += 1;
  };

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
        addNormalized(records[pair.player1], pair.player1Normalized);
        records[pair.player1].currentStreak = 0;
        records[pair.player1].streakType = null;
      }
      if (records[pair.player2]) {
        records[pair.player2].ties += 1;
        records[pair.player2].pointsFor += pair.player2Score || 0;
        records[pair.player2].pointsAgainst += pair.player1Score || 0;
        addNormalized(records[pair.player2], pair.player2Normalized);
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
        addNormalized(
          records[pair.winner],
          pair.winner === pair.player1 ? pair.player1Normalized : pair.player2Normalized
        );
        records[pair.winner].currentStreak = records[pair.winner].streakType === 'W'
          ? records[pair.winner].currentStreak + 1
          : 1;
        records[pair.winner].streakType = 'W';
      }

      if (records[loser]) {
        records[loser].losses += 1;
        records[loser].pointsFor += (loser === pair.player1 ? pair.player1Score : pair.player2Score) || 0;
        records[loser].pointsAgainst += (loser === pair.player1 ? pair.player2Score : pair.player1Score) || 0;
        addNormalized(
          records[loser],
          loser === pair.player1 ? pair.player1Normalized : pair.player2Normalized
        );
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
      // Mean class percentile — the cross-class comparable figure the table
      // ranks on. Null when no resolved week carried one.
      normalizedScore: data.normalizedWeeks
        ? (data.normalizedFor || 0) / data.normalizedWeeks
        : null,
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
 * The tiebreaker is the NORMALIZED score, not raw points. Matchups are
 * class-segregated but the table is league-wide, so raw points compare a ~90
 * World Class week against a ~60 SoundSport week — the old tiebreaker sorted a
 * mixed-class league by class rather than by performance. A mean class
 * percentile means the same thing in every class. Raw points stay as the next
 * tiebreak for leagues (and legacy rows) that carry no normalized figure.
 *
 * Order: win% → wins → normalized → points for → points against (fewer is
 * better) → uid, so the result is total and deterministic rather than
 * dependent on object key order.
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
  // Only when BOTH sides have one — comparing a director who has a normalized
  // figure against one who does not would rank on data availability.
  if (typeof a.normalizedScore === 'number' && typeof b.normalizedScore === 'number') {
    if (b.normalizedScore !== a.normalizedScore) return b.normalizedScore - a.normalizedScore;
  }
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

/**
 * Rebuild a league's standings from scratch, by re-folding every resolved
 * matchup in week order.
 *
 * The incremental fold is not idempotent — each pair must be counted exactly
 * once — which makes it correct but unforgiving: there was no way to fix a
 * league whose table had drifted, and no way to correct a matchup result at
 * all, because "unfold the old result and fold the new one" is the kind of
 * arithmetic that goes wrong silently.
 *
 * Deriving the whole table from the matchup documents sidesteps that. It is the
 * escape hatch for a corrected result, and for any historical corruption.
 *
 * Members with no resolved matchups still get an empty row, so a director who
 * joined mid-season appears in the table rather than vanishing from it.
 *
 * @param {Array<{id: string, data: Object}>} weekDocs - `week-N` documents
 * @param {string[]} corpsClasses
 * @param {string[]} [members] - current roster; rows are limited to these when given
 * @returns {{records: Object, standings: Array}}
 */
function rebuildStandingsFromMatchups(weekDocs, corpsClasses, members = null) {
  const ordered = [...weekDocs]
    .map((doc) => ({ week: parseInt(String(doc.id).replace("week-", ""), 10), data: doc.data }))
    .filter((entry) => Number.isFinite(entry.week))
    .sort((a, b) => a.week - b.week);

  const pairs = [];
  for (const { data } of ordered) {
    for (const corpsClass of corpsClasses) {
      for (const matchup of data?.[`${corpsClass}Matchups`] || []) {
        if (!matchup?.completed || !matchup.pair?.[0]) continue;

        const [p1, p2] = matchup.pair;
        if (!p2 || matchup.isBye) {
          pairs.push({ player1: p1, player2: null, winner: p1, completed: true, corpsClass });
          continue;
        }
        pairs.push({
          player1: p1,
          player2: p2,
          player1Score: matchup.scores?.[p1] || 0,
          player2Score: matchup.scores?.[p2] || 0,
          player1Normalized: matchup.normalized?.[p1],
          player2Normalized: matchup.normalized?.[p2],
          winner: matchup.winner ?? "tie",
          completed: true,
          corpsClass,
        });
      }
    }
  }

  // Seed every current member so the roster and the table agree.
  const base = {};
  for (const uid of members || []) base[uid] = { ...EMPTY_RECORD };

  const folded = foldPairsIntoStandings(base, pairs);
  if (!members) return folded;

  // Drop rows for directors who have since left — the same cleanup the
  // removal and leave paths do.
  const roster = new Set(members);
  const records = {};
  for (const [uid, record] of Object.entries(folded.records)) {
    if (roster.has(uid)) records[uid] = record;
  }
  return {
    records,
    standings: folded.standings.filter((row) => roster.has(row.uid)),
  };
}

module.exports = {
  foldPairsIntoStandings,
  rebuildStandingsFromMatchups,
  applyStandingsInTransaction,
  updateStandings,
  compareStandingRows,
  winPercentage,
};
