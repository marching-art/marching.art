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

const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { captionsWonBy } = require("./captionWars");

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
  // Weeks sat out in an odd-sized league. A bye is a non-game: it counts
  // toward nothing in the record and leaves the streak alone. It used to be
  // scored as a win, which in a 5-member league decided the table by bye
  // rotation rather than by results.
  byes: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  // Sum of this director's weekly class percentiles — "how did you do against
  // your OWN field", which means the same thing in every corps class. Raw
  // points do not: a World Class week is ~90 and a SoundSport week ~60, so
  // ranking a mixed-class league on points sorted by class, not by
  // performance. See helpers/leagueScoring.js applyClassPercentiles.
  normalizedFor: 0,
  normalizedWeeks: 0,
  // Categories taken and dropped, in a league running Caption Wars
  // (helpers/captionWars.js). Zero for everyone on the default format, where
  // the term below is a constant and the ordering is unchanged.
  captionsWon: 0,
  captionsLost: 0,
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

  // Only Caption Wars matchups carry these; a pair from a `total` league passes
  // undefined and the counters stay where they are.
  const addCaptions = (record, captions) => {
    if (!captions) return;
    record.captionsWon += Number(captions.won) || 0;
    record.captionsLost += Number(captions.lost) || 0;
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
      // Bye week — a non-game. Recorded so the table can show it, but no
      // win, no points, and the streak carries over untouched.
      if (records[pair.player1]) {
        records[pair.player1].byes += 1;
      }
    } else if (pair.winner === 'tie') {
      // Tie
      if (records[pair.player1]) {
        records[pair.player1].ties += 1;
        records[pair.player1].pointsFor += pair.player1Score || 0;
        records[pair.player1].pointsAgainst += pair.player2Score || 0;
        addNormalized(records[pair.player1], pair.player1Normalized);
        addCaptions(records[pair.player1], pair.player1Captions);
        records[pair.player1].currentStreak = 0;
        records[pair.player1].streakType = null;
      }
      if (records[pair.player2]) {
        records[pair.player2].ties += 1;
        records[pair.player2].pointsFor += pair.player2Score || 0;
        records[pair.player2].pointsAgainst += pair.player1Score || 0;
        addNormalized(records[pair.player2], pair.player2Normalized);
        addCaptions(records[pair.player2], pair.player2Captions);
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
        addCaptions(
          records[pair.winner],
          pair.winner === pair.player1 ? pair.player1Captions : pair.player2Captions
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
        addCaptions(
          records[loser],
          loser === pair.player1 ? pair.player1Captions : pair.player2Captions
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
      byes: data.byes || 0,
      totalPoints: data.pointsFor || 0,
      pointsAgainst: data.pointsAgainst || 0,
      // Mean class percentile — the cross-class comparable figure the table
      // ranks on. Null when no resolved week carried one.
      normalizedScore: data.normalizedWeeks
        ? (data.normalizedFor || 0) / data.normalizedWeeks
        : null,
      // Caption Wars only; 0-0 everywhere else, which sorts as a constant.
      captionsWon: data.captionsWon || 0,
      captionsLost: data.captionsLost || 0,
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
 * In a league running Caption Wars the first tiebreak is the CATEGORY RECORD,
 * because that is the format they actually played: two directors at 4-2 are
 * separated first by how they got there, and 12 categories to 6 is a more
 * dominant 4-2 than 7 to 11. It sits above the normalized score so the Finals
 * field is seeded on the league's own format, falling through only when two
 * directors' category records are identical too. On the default format both
 * counters are zero for everyone, the term is a constant, and the ordering
 * below is exactly what it always was.
 *
 * The next tiebreaker is the NORMALIZED score, not raw points. Matchups are
 * class-segregated but the table is league-wide, so raw points compare a ~90
 * World Class week against a ~60 SoundSport week — the old tiebreaker sorted a
 * mixed-class league by class rather than by performance. A mean class
 * percentile means the same thing in every class. Raw points stay as the next
 * tiebreak for leagues (and legacy rows) that carry no normalized figure.
 *
 * Order: win% → wins → category record → normalized → points for → points
 * against (fewer is better) → uid, so the result is total and deterministic
 * rather than dependent on object key order.
 */

/** Categories taken less categories dropped. Zero on the default format. */
function captionMargin(row) {
  return (row.captionsWon || 0) - (row.captionsLost || 0);
}
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
  if (captionMargin(b) !== captionMargin(a)) return captionMargin(b) - captionMargin(a);
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
 * A MISSING document is written rather than skipped. `createLeague` is the only
 * thing that seeds standings/current, so a league that reached the season by any
 * other route — restored from a backup, repaired by hand, created by a future
 * path that forgets — used to play its whole season into a document that was
 * never there: every week resolved, every result was dropped here without a
 * log line, the table stayed empty, and archival crowned nobody because it
 * found no rows. That is the same failure the row-level `ensureRecord` above
 * was added to fix, one level up, and it fails exactly as quietly.
 *
 * Writing it is safe: the fold seeds a row for every director in a resolved
 * pair, so a document built this way holds the same table it would have held
 * had it existed all along — minus any week that was already lost, which no
 * amount of guarding here can bring back.
 *
 * @param {FirebaseFirestore.Transaction} t
 * @param {FirebaseFirestore.DocumentSnapshot} standingsDoc snapshot of
 *   standings/current read via t.get()
 * @param {Array} pairs resolved matchup pairs
 */
function applyStandingsInTransaction(t, standingsDoc, pairs) {
  const existing = standingsDoc.exists ? standingsDoc.data().records : null;
  if (!standingsDoc.exists) {
    logger.warn(
      `Standings document ${standingsDoc.ref.path} did not exist; creating it from this ` +
        "week's results. Weeks resolved before now were not recorded in it."
    );
  }

  // The table as it stood BEFORE this fold, so a caller can diff rank movement
  // (standings_change notifications). Absent on a first-ever write.
  const previousStandings = standingsDoc.exists
    ? standingsDoc.data().standings || []
    : [];

  const { records, standings } = foldPairsIntoStandings(existing, pairs);

  t.set(
    standingsDoc.ref,
    {
      records,
      standings, // Array format for frontend API
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { previousStandings, standings };
}

/**
 * Standalone transactional fold — reads standings/current and applies the
 * pairs atomically. Used by the nightly weekly resolution, whose matchup
 * docs are committed separately under the scoringRunGuard lease.
 *
 * @returns {Promise<{previousStandings: Array, standings: Array}>} the table
 *   before and after this fold, for rank-movement diffing.
 */
async function updateStandings(db, leagueRef, pairs) {
  const standingsRef = leagueRef.collection('standings').doc('current');
  return db.runTransaction(async (t) => {
    const standingsDoc = await t.get(standingsRef);
    return applyStandingsInTransaction(t, standingsDoc, pairs);
  });
}

/**
 * Directors who FELL in the overall table between two standings arrays,
 * restricted to `affectedUids` (the ones who actually played this week — a
 * bystander whose rank only moved because others changed shouldn't be pinged).
 *
 * Rank is 1-based array position (the arrays are pre-sorted by
 * compareStandingRows). A director absent from the previous table (new this
 * week) has no drop to report. Pure — no reads/writes — so it is safe to run
 * outside the scoring transaction.
 *
 * @param {Array<{uid: string}>} previousStandings
 * @param {Array<{uid: string}>} newStandings
 * @param {Iterable<string>} affectedUids
 * @returns {Array<{uid: string, previousRank: number, newRank: number}>}
 */
function computeRankDrops(previousStandings, newStandings, affectedUids) {
  const prevRank = new Map();
  (previousStandings || []).forEach((row, i) => prevRank.set(row.uid, i + 1));
  const newRank = new Map();
  (newStandings || []).forEach((row, i) => newRank.set(row.uid, i + 1));

  const drops = [];
  for (const uid of new Set(affectedUids)) {
    const before = prevRank.get(uid);
    const after = newRank.get(uid);
    if (before != null && after != null && after > before) {
      drops.push({ uid, previousRank: before, newRank: after });
    }
  }
  return drops;
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
          // Read off the stored block rather than recomputed, so a rebuild
          // after a commissioner correction cannot make the category column
          // disagree with the matchup card. Absent on the default format.
          player1Captions: matchup.captions ? captionsWonBy(matchup.captions, p1) : undefined,
          player2Captions: matchup.captions ? captionsWonBy(matchup.captions, p2) : undefined,
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
  computeRankDrops,
  compareStandingRows,
  winPercentage,
  captionMargin,
};
