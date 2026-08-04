/**
 * Fan Favorite (design §14.1.5, decision 30) — the FMA community ritual,
 * productized as a two-level ballot. Purely cosmetic: zero score impact.
 *
 *   PRELIMS — each major (Southwestern day 28, Southeastern day 35, the
 *   Eastern Classic days 41-42) opens a ballot the morning after its last
 *   night, once the results it draws candidates from exist, and closes
 *   `voteWindowDays` days after that last night. Any signed-in user casts ONE
 *   vote per major for any Podium corps that performed there. The top
 *   `finalistsPerMajor` per major advance.
 *
 *   FINALS — championship week (from `finalsFromDay`), one ballot across
 *   the union of finalists. The winner is crowned at season archival:
 *   banner on the season record, Fan Favorite trophy on the profile.
 *
 * RANKING (see `compareRows`): votes at that ballot, then the corps' prelims
 * votes across the whole season, then how many majors those came from. Ties
 * that survive all three are real — tied corps share a place, and everyone
 * tied on the finalist cut line advances. Nothing is decided by document ID.
 *
 * Ballots: podium-fan/{seasonUid}/ballots/{voterUid} (server-only — votes
 * are private). Tallies/finalists/winner: podium-fan/{seasonUid} (public).
 */

const { logger } = require("firebase-functions/v2");
const store = require("./store");

const MAJORS = [28, 35, 41]; // 41 covers the two-night Eastern (41-42)

// How deep the published per-major prelims results run. The ballot's public
// record — enough to show the race, short enough to keep the (world-readable)
// fan doc small and an announcement embed inside Discord's field limits.
//
// The depth is extended through the end of whatever tie straddles it (see
// `publishedDepth`): cutting a tie group in half would print one corps at N
// votes and drop another at the same N, which reads as a ranking the ballot
// never produced. RESULTS_MAX is the hard stop that keeps the doc and the
// embed bounded when a tie group runs long.
const RESULTS_PER_MAJOR = 5;
const RESULTS_MAX = 10;

function fanDocRef(db, seasonUid) {
  return db.doc(`podium-fan/${seasonUid}`);
}

function ballotRef(db, seasonUid, voterUid) {
  return db.doc(`podium-fan/${seasonUid}/ballots/${voterUid}`);
}

/** The last night a major is performed on (the Eastern spans two). */
function lastNightOf(major) {
  return major === 41 ? 42 : major;
}

/**
 * First competition day a major's prelims ballot accepts votes: the day AFTER
 * its last night.
 *
 * A ballot is only votable once the recaps it draws its candidates from exist,
 * and a day's recap is written by the run that scores that night. Opening on
 * the show day itself gave every major a first day with no candidates at all —
 * `castFanFavoriteVote` rejected every ballot with "vote for a corps that
 * performed at this major" — and gave the Eastern Classic something worse: it
 * spans two nights, so for a whole day only the corps seeded into night 1 were
 * votable, a head start at the one major where the field is split.
 */
function prelimsOpensOn(major) {
  return lastNightOf(major) + 1;
}

/** Last competition day a major's prelims ballot accepts votes. */
function prelimsClosesOn(major, cfg) {
  return lastNightOf(major) + cfg.fanFavorite.voteWindowDays - 1;
}

/** The major whose prelims ballot is open on `competitionDay`, or null. */
function openPrelimsMajor(competitionDay, cfg) {
  for (const major of MAJORS) {
    if (competitionDay >= prelimsOpensOn(major) && competitionDay <= prelimsClosesOn(major, cfg)) {
      return major;
    }
  }
  return null;
}

/** True while the finals ballot is open. */
function finalsOpen(competitionDay, cfg) {
  return competitionDay >= cfg.fanFavorite.finalsFromDay && competitionDay <= 49;
}

/** Podium corps that performed at a major: {uid, corpsName, division}. */
async function candidatesForMajor(db, seasonUid, majorDay) {
  const days = majorDay === 41 ? [41, 42] : [majorDay];
  const seen = new Map();
  for (const day of days) {
    const recap = await store.recapDayRef(db, seasonUid, day).get();
    if (!recap.exists) continue;
    const data = recap.data();
    // Per-show recaps carry `shows: [{results}]`; legacy docs a flat `results`.
    const results = data.shows
      ? data.shows.flatMap((s) => s.results || [])
      : data.results || [];
    for (const result of results) {
      if (result.uid && !seen.has(result.uid)) {
        seen.set(result.uid, {
          uid: result.uid,
          corpsName: result.corpsName || null,
          division: result.division || "aClass",
        });
      }
    }
  }
  return [...seen.values()];
}

/** Tally every ballot's votes for one prelims major (or the finals). */
async function tally(db, seasonUid, field) {
  const snapshot = await db.collection(`podium-fan/${seasonUid}/ballots`).get();
  /** @type {Object<string, number>} */
  const counts = {};
  for (const doc of snapshot.docs) {
    const vote = field === "finals" ? doc.data().finals : (doc.data().prelims || {})[field];
    if (vote) counts[vote] = (counts[vote] || 0) + 1;
  }
  return counts;
}

/**
 * Read every ballot ONCE and return both the per-major tallies and each corps'
 * season-wide prelims record.
 *
 * The season-wide record is what makes a vote cast at a major a corps didn't
 * win still count for something: it is the first tiebreaker everywhere below,
 * so a corps polling across all three majors outranks one that drew the same
 * count at a single major. (It also collapses what used to be one full
 * collection read per major into one read total.)
 *
 * @returns {Promise<{perMajor: Object<string, Object<string, number>>,
 *                    totals: Object<string, {votes: number, majors: Set<number>}>}>}
 */
async function readPrelimsBallots(db, seasonUid) {
  const snapshot = await db.collection(`podium-fan/${seasonUid}/ballots`).get();
  /** @type {Object<string, Object<string, number>>} */
  const perMajor = Object.fromEntries(MAJORS.map((major) => [String(major), {}]));
  /** @type {Object<string, {votes: number, majors: Set<number>}>} */
  const totals = {};
  for (const doc of snapshot.docs) {
    const prelims = doc.data().prelims || {};
    for (const major of MAJORS) {
      const vote = prelims[String(major)];
      if (!vote) continue;
      const counts = perMajor[String(major)];
      counts[vote] = (counts[vote] || 0) + 1;
      if (!totals[vote]) totals[vote] = { votes: 0, majors: new Set() };
      totals[vote].votes += 1;
      totals[vote].majors.add(major);
    }
  }
  return { perMajor, totals };
}

/** A corps' season-wide prelims record, defaulted for one that drew no votes. */
function standingOf(totals, uid) {
  const total = totals[uid];
  return {
    totalVotes: total ? total.votes : 0,
    majorsPolled: total ? total.majors.size : 0,
  };
}

/**
 * Everything the ballot actually measured about a corps, most significant
 * first. Two corps that match on all of it are genuinely tied — there is
 * nothing left in the votes to separate them, and no amount of sorting will
 * invent it.
 */
function tieKey(row) {
  return `${row.votes}|${row.totalVotes}|${row.majorsPolled}`;
}

/**
 * Rank one ballot: votes here, then season-wide votes, then how many majors
 * those came from.
 *
 * The name comparison is a display-stability tail, NOT a placing rule — rows
 * that reach it are tied (`tiedWith` says so, and they share a `place`). It
 * used to be a UID comparison, which decided real outcomes: on a four-way tie
 * for two finalist slots, the two corps whose Firestore document IDs happened
 * to sort first advanced, and the medals on the announcement embed were handed
 * out in that same order.
 */
function compareRows(a, b) {
  return (
    b.votes - a.votes ||
    b.totalVotes - a.totalVotes ||
    b.majorsPolled - a.majorsPolled ||
    String(a.corpsName || "").localeCompare(String(b.corpsName || "")) ||
    String(a.uid).localeCompare(String(b.uid))
  );
}

/**
 * Ranked rows for a tally, each carrying its competition place (1224: tied
 * corps share a place and the next corps skips the ones it lost to) and the
 * corps it is tied with.
 *
 * @param {Object<string, number>} counts - uid → votes on this ballot.
 * @param {Object<string, Object>} byUid - uid → eligible candidate.
 * @param {Object} totals - from `readPrelimsBallots`.
 */
function rankBallot(counts, byUid, totals) {
  const rows = Object.keys(byUid)
    .map((uid) => ({
      ...byUid[uid],
      votes: counts[uid] || 0,
      ...standingOf(totals, uid),
    }))
    .sort(compareRows);

  let place = 0;
  let previousKey = null;
  const placed = rows.map((row, index) => {
    const key = tieKey(row);
    if (key !== previousKey) {
      place = index + 1;
      previousKey = key;
    }
    return { ...row, place };
  });
  return placed.map((row) => ({
    ...row,
    tiedWith: placed.filter((o) => o.uid !== row.uid && tieKey(o) === tieKey(row)).map((o) => o.uid),
  }));
}

/**
 * The rows that advance from one prelims ballot: the top `slots`, plus anyone
 * genuinely tied with the corps holding the last slot.
 *
 * Expanding the field is the only non-arbitrary way to resolve a tie ON the
 * cut line. The alternative is picking between corps the ballot rated exactly
 * equally, which is the coin flip this whole change exists to remove.
 */
function advancingRows(rows, slots) {
  if (rows.length <= slots) return rows;
  const cutKey = tieKey(rows[slots - 1]);
  return rows.filter((row, index) => index < slots || tieKey(row) === cutKey);
}

/** Published results depth: RESULTS_PER_MAJOR, never splitting a tie group. */
function publishedDepth(rows) {
  if (rows.length <= RESULTS_PER_MAJOR) return rows;
  const cutKey = tieKey(rows[RESULTS_PER_MAJOR - 1]);
  return rows
    .filter((row, index) => index < RESULTS_PER_MAJOR || tieKey(row) === cutKey)
    .slice(0, RESULTS_MAX);
}

/**
 * Shape a ranked row for the public doc. `seasonVotes` rides along because it
 * is what broke the tie — a reader looking at two corps on the same count and
 * different places deserves to see the reason rather than assume a coin flip.
 */
function publishable(row) {
  const { totalVotes, majorsPolled: _majorsPolled, ...rest } = row;
  return { ...rest, seasonVotes: totalVotes };
}

/**
 * Compute + publish the finalists (called once, at the end of the last
 * prelims window — the Day-44 processor run). Idempotent.
 */
async function publishFinalists(db, seasonUid, cfg) {
  const fanRef = fanDocRef(db, seasonUid);
  const existing = await fanRef.get();
  if (existing.exists && existing.data().finalists) return existing.data().finalists;

  const { perMajor, totals } = await readPrelimsBallots(db, seasonUid);
  const finalists = new Map();
  // Per-major ranked tallies, published alongside the finalists: the ballot's
  // RESULTS, not just its survivors (votes are private, counts are public —
  // see the header). Feeds the Podium display copy and the Discord recap of
  // each prelims poll.
  const prelimsResults = {};
  for (const major of MAJORS) {
    const candidates = await candidatesForMajor(db, seasonUid, major);
    const byUid = Object.fromEntries(candidates.map((c) => [c.uid, c]));
    // Rank the whole eligible field, then drop the corps nobody voted for —
    // they belong to the candidate list, not to the results.
    const ranked = rankBallot(perMajor[String(major)], byUid, totals).filter((row) => row.votes > 0);
    prelimsResults[String(major)] = publishedDepth(ranked).map(publishable);
    for (const row of advancingRows(ranked, cfg.fanFavorite.finalistsPerMajor)) {
      const prior = finalists.get(row.uid);
      finalists.set(row.uid, {
        ...byUid[row.uid],
        // Every prelims vote the corps drew all season — not just the ones
        // cast at the majors it happened to advance from. A corps that made
        // the cut at one major and finished fourth at another had those
        // fourth-place votes silently dropped from this number.
        prelimVotes: totals[row.uid] ? totals[row.uid].votes : row.votes,
        fromMajors: [...(prior ? prior.fromMajors : []), major],
      });
    }
  }
  // Same comparator as the ballots themselves: prelim votes, then breadth of
  // support. (`votes` is the sort key; `prelimVotes` is the stored field.)
  const list = [...finalists.values()]
    .map((finalist) => ({
      ...finalist,
      votes: finalist.prelimVotes,
      ...standingOf(totals, finalist.uid),
    }))
    .sort(compareRows)
    .map(({ votes: _votes, totalVotes: _totalVotes, majorsPolled: _majorsPolled, ...finalist }) => finalist);
  await fanRef.set(
    {
      seasonUid,
      finalists: list,
      prelimsResults,
      finalistsPublishedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  logger.info(`[podium] Fan Favorite finalists published: ${list.length}`);
  return list;
}

/**
 * Crown the winner at season archival. Idempotent; returns the winner or
 * null when there were no finals votes (falls back to prelim vote order).
 */
async function crownWinner(db, seasonUid) {
  const fanRef = fanDocRef(db, seasonUid);
  const snapshot = await fanRef.get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  if (data.winner) return data.winner;
  const finalists = data.finalists || [];
  if (finalists.length === 0) return null;

  const counts = await tally(db, seasonUid, "finals");
  const { totals } = await readPrelimsBallots(db, seasonUid);
  const byUid = Object.fromEntries(finalists.map((f) => [f.uid, f]));
  // Rank the WHOLE finals field, including finalists who drew no finals votes:
  // a corps on the ballot placed last, it didn't vanish. It also makes the
  // documented "no finals votes at all" fallback fall out for free — every row
  // sits at zero, so the comparator drops through to the prelims record.
  const ranked = rankBallot(counts, byUid, totals);
  const winnerRow = ranked[0];
  const winner = {
    ...byUid[winnerRow.uid],
    finalsVotes: winnerRow.votes,
    // A crown the ballot didn't actually decide says so. `compareRows` still
    // returns one corps first (something has to be written to the trophy), but
    // a name-sort tail is not a mandate and shouldn't be reported as one.
    ...(winnerRow.tiedWith.length > 0
      ? { tiedWith: winnerRow.tiedWith.map((uid) => byUid[uid].corpsName || uid) }
      : {}),
  };
  // The finals tally, public like the prelims one — the result the ballot
  // produced, not only the corps it crowned.
  const finalsResults = ranked.map(publishable);
  await fanRef.set(
    { winner, finalsResults, crownedAt: new Date().toISOString() },
    { merge: true }
  );

  // Cosmetic hardware: a Fan Favorite entry in the profile trophy case and
  // a banner flag on the Podium display copy. Never score, never budget.
  try {
    const profileSnapshot = await store.profileRef(db, winnerRow.uid).get();
    const existing =
      (profileSnapshot.exists &&
        profileSnapshot.data().trophies &&
        profileSnapshot.data().trophies.fanFavorites) ||
      [];
    if (!existing.some((t) => t && t.seasonName === seasonUid)) {
      await store.profileRef(db, winnerRow.uid).set(
        {
          trophies: {
            fanFavorites: [
              ...existing,
              {
                type: "fanFavorite",
                corpsClass: "podiumClass",
                seasonName: seasonUid,
                corpsName: winner.corpsName,
                votes: winner.finalsVotes,
              },
            ],
          },
        },
        { merge: true }
      );
    }
  } catch (error) {
    logger.warn(`[podium] Fan Favorite trophy write failed: ${error.message}`);
  }
  logger.info(`[podium] Fan Favorite: ${winner.corpsName} (${winnerRow.uid})`);
  return winner;
}

module.exports = {
  MAJORS,
  RESULTS_PER_MAJOR,
  RESULTS_MAX,
  readPrelimsBallots,
  compareRows,
  rankBallot,
  advancingRows,
  publishedDepth,
  fanDocRef,
  ballotRef,
  prelimsOpensOn,
  prelimsClosesOn,
  openPrelimsMajor,
  finalsOpen,
  candidatesForMajor,
  tally,
  publishFinalists,
  crownWinner,
};
