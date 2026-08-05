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
 * THE CROWN (see `decideCrown`) is the one place a tie cannot stand: a trophy
 * has one name on it. So the finals ballot carries the three measures above
 * and then, only for corps still level: who led at the most recent major, who
 * reached the tied total first, and — if the room truly said nothing to
 * separate them — a seeded draw that is announced AS a draw. The corps' scores
 * are deliberately absent from that ladder. The Fan Favorite is the one trophy
 * the field can't score for, and a tiebreaker that reached for the recap sheet
 * would hand it to the deepest championship run every time. Whatever decides
 * it, `winner.tiebreak` records the rule and its numbers, and the crowning
 * announcement says so out loud (fanFavoriteDiscord.buildWinnerPayload).
 *
 * Ballots: podium-fan/{seasonUid}/ballots/{voterUid} (server-only — votes
 * are private). Tallies/finalists/winner: podium-fan/{seasonUid} (public).
 */

const { logger } = require("firebase-functions/v2");
const store = require("./store");
const engine = require("./engine");

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

/**
 * Read every ballot ONCE: the per-major prelims tallies, each corps'
 * season-wide prelims record, and the finals tally with the times its votes
 * landed.
 *
 * The season-wide record is what makes a vote cast at a major a corps didn't
 * win still count for something: it is the first tiebreaker everywhere below,
 * so a corps polling across all three majors outranks one that drew the same
 * count at a single major. (It also collapses what used to be one full
 * collection read per major into one read total.)
 *
 * `finals.times` carries every finals vote's `finalsAt` — including the
 * `null`s from ballots cast before votes were stamped, because a corps whose
 * arrival time is only partly known has no arrival time at all (see
 * `arrivalOf`), and silently treating a missing stamp as "very early" would
 * decide a crown on the absence of data.
 *
 * @returns {Promise<{perMajor: Object<string, Object<string, number>>,
 *                    totals: Object<string, {votes: number, majors: Set<number>}>,
 *                    finals: {counts: Object<string, number>,
 *                             times: Object<string, Array<?string>>}}>}
 */
async function readBallots(db, seasonUid) {
  const snapshot = await db.collection(`podium-fan/${seasonUid}/ballots`).get();
  /** @type {Object<string, Object<string, number>>} */
  const perMajor = Object.fromEntries(MAJORS.map((major) => [String(major), {}]));
  /** @type {Object<string, {votes: number, majors: Set<number>}>} */
  const totals = {};
  /** @type {Object<string, number>} */
  const finalsCounts = {};
  /** @type {Object<string, Array<?string>>} */
  const finalsTimes = {};
  for (const doc of snapshot.docs) {
    const ballot = doc.data();
    const prelims = ballot.prelims || {};
    for (const major of MAJORS) {
      const vote = prelims[String(major)];
      if (!vote) continue;
      const counts = perMajor[String(major)];
      counts[vote] = (counts[vote] || 0) + 1;
      if (!totals[vote]) totals[vote] = { votes: 0, majors: new Set() };
      totals[vote].votes += 1;
      totals[vote].majors.add(major);
    }
    if (ballot.finals) {
      finalsCounts[ballot.finals] = (finalsCounts[ballot.finals] || 0) + 1;
      (finalsTimes[ballot.finals] = finalsTimes[ballot.finals] || []).push(
        ballot.finalsAt || null
      );
    }
  }
  return { perMajor, totals, finals: { counts: finalsCounts, times: finalsTimes } };
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
    compareBallotMeasures(a, b) ||
    String(a.corpsName || "").localeCompare(String(b.corpsName || "")) ||
    String(a.uid).localeCompare(String(b.uid))
  );
}

/**
 * The three measures every ballot ranks on, with no display tail: votes here,
 * season-wide prelims votes, majors polled. Two rows this returns 0 for are
 * tied on everything the ballot published — `tieKey` is the same statement as
 * a string, and the crown cascade starts where this stops.
 */
function compareBallotMeasures(a, b) {
  return b.votes - a.votes || b.totalVotes - a.totalVotes || b.majorsPolled - a.majorsPolled;
}

/**
 * Ranked rows for a tally, each carrying its competition place (1224: tied
 * corps share a place and the next corps skips the ones it lost to) and the
 * corps it is tied with.
 *
 * @param {Object<string, number>} counts - uid → votes on this ballot.
 * @param {Object<string, Object>} byUid - uid → eligible candidate.
 * @param {Object} totals - from `readBallots`.
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

  const { perMajor, totals } = await readBallots(db, seasonUid);
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

// ---------------------------------------------------------------------------
// The crown cascade
// ---------------------------------------------------------------------------
// Everywhere else a tie is allowed to stand: tied corps share a place, and a
// tie on the finalist cut line advances everyone in it. The crown can't — one
// corps gets the trophy — so it keeps asking the ballots questions until one
// of them answers, and reports which one did.

/** Majors newest-first: a tied crown asks the most recent room first. */
const RECENCY_ORDER = [...MAJORS].reverse();

/**
 * The most recent major where these two drew different prelims support, and
 * what each drew there — or null when all three majors rated them identically.
 *
 * Reading the majors newest-first is a lexicographic comparison of the vote
 * vector (41, 35, 28), so it stays a proper ordering however many corps are
 * tied: whoever was ahead at the last room to see them both goes first.
 */
function majorLeadOf(a, b, perMajor) {
  for (const major of RECENCY_ORDER) {
    const counts = (perMajor || {})[String(major)] || {};
    const forA = counts[a.uid] || 0;
    const forB = counts[b.uid] || 0;
    if (forA !== forB) return { major, forA, forB };
  }
  return null;
}

function compareMajorLead(a, b, perMajor) {
  const lead = majorLeadOf(a, b, perMajor);
  return lead ? lead.forB - lead.forA : 0;
}

/**
 * When a corps reached the total it finished on: the timestamp of the finals
 * vote that got it there. Null when any of its votes is unstamped (ballots
 * cast before `castFanFavoriteVote` recorded `finalsAt`) — a partly-known
 * arrival is not an arrival, and `compareArrival` skips the measure rather
 * than rank a corps by which of its voters happened to be logged.
 */
function arrivalOf(finalsTimes, uid) {
  const stamps = (finalsTimes || {})[uid] || [];
  if (stamps.length === 0 || stamps.some((stamp) => !stamp)) return null;
  return [...stamps].sort()[stamps.length - 1];
}

/** Earlier arrival wins. Unknown on either side means the measure is silent. */
function compareArrival(a, b) {
  if (!a || !b || a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * The draw of last resort: a deterministic ticket per corps, seeded on the
 * season and the uid.
 *
 * Deterministic because `crownWinner` must be idempotent — a re-run at
 * archival has to crown the same corps — and seeded on `seasonUid` so it is
 * not a standing property of a uid that could be gamed across seasons. This is
 * a coin, and the announcement calls it one.
 */
function drawTicket(seasonUid, uid) {
  return engine.seededUnit(`${seasonUid}|fanFavorite|${uid}`);
}

function compareDraw(seasonUid, a, b) {
  return (
    drawTicket(seasonUid, b.uid) - drawTicket(seasonUid, a.uid) ||
    String(a.uid).localeCompare(String(b.uid))
  );
}

/**
 * Which measure separated the crowned corps from the one closest to it, and
 * the two numbers that did it — the "why" the crowning announcement prints.
 */
function crownRuleFor(winner, rival, { perMajor, finalsTimes }) {
  if (winner.totalVotes !== rival.totalVotes) {
    return { rule: "seasonVotes", winnerValue: winner.totalVotes, rivalValue: rival.totalVotes };
  }
  if (winner.majorsPolled !== rival.majorsPolled) {
    return { rule: "majorsPolled", winnerValue: winner.majorsPolled, rivalValue: rival.majorsPolled };
  }
  const lead = majorLeadOf(winner, rival, perMajor);
  if (lead) {
    return { rule: "majorLead", major: lead.major, winnerValue: lead.forA, rivalValue: lead.forB };
  }
  const winnerArrival = arrivalOf(finalsTimes, winner.uid);
  const rivalArrival = arrivalOf(finalsTimes, rival.uid);
  if (compareArrival(winnerArrival, rivalArrival) !== 0) {
    return { rule: "firstToCount", winnerValue: winnerArrival, rivalValue: rivalArrival };
  }
  return { rule: "draw" };
}

/**
 * Crown one corps out of the ranked finals field, and record what decided it.
 *
 * The tie that matters here is on the number the announcement prints — the
 * finals vote count — so every corps level on THAT is in the cascade, even
 * ones the season-wide measures separate a line later. Two corps shown with
 * the same count in different places is exactly the moment a reader assumes a
 * coin flip; `tiebreak` is the answer to that.
 *
 * Pure: every measure comes from the ballots already read. Nothing here reads
 * a score, a recap, or a placement — see the module header.
 *
 * @param {Array<Object>} ranked - `rankBallot` output for the finals ballot.
 * @param {{seasonUid: string, perMajor: Object, finalsTimes: Object}} context
 * @returns {{winner: Object, tiebreak: ?Object}} `tiebreak` is null for an
 *   outright win — nobody else was on the winner's count.
 */
function decideCrown(ranked, { seasonUid, perMajor, finalsTimes }) {
  const leader = ranked[0];
  const level = ranked.filter((row) => row.votes === leader.votes);
  if (level.length === 1) return { winner: leader, tiebreak: null };

  const ordered = [...level].sort(
    (a, b) =>
      compareBallotMeasures(a, b) ||
      compareMajorLead(a, b, perMajor) ||
      compareArrival(arrivalOf(finalsTimes, a.uid), arrivalOf(finalsTimes, b.uid)) ||
      compareDraw(seasonUid, a, b)
  );
  const [winner, rival] = ordered;
  return {
    winner,
    tiebreak: {
      ...crownRuleFor(winner, rival, { perMajor, finalsTimes }),
      rival: rival.corpsName || rival.uid,
      tiedWith: ordered.slice(1).map((row) => row.corpsName || row.uid),
    },
  };
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

  const { perMajor, totals, finals } = await readBallots(db, seasonUid);
  const byUid = Object.fromEntries(finalists.map((f) => [f.uid, f]));
  // Rank the WHOLE finals field, including finalists who drew no finals votes:
  // a corps on the ballot placed last, it didn't vanish. It also makes the
  // documented "no finals votes at all" fallback fall out for free — every row
  // sits at zero, so the comparator drops through to the prelims record.
  const ranked = rankBallot(finals.counts, byUid, totals);
  const { winner: winnerRow, tiebreak } = decideCrown(ranked, {
    seasonUid,
    perMajor,
    finalsTimes: finals.times,
  });
  const winner = {
    ...byUid[winnerRow.uid],
    finalsVotes: winnerRow.votes,
    // A crown the ballot didn't decide outright says which measure did, and
    // who it was decided against — the announcement reads straight off this.
    ...(tiebreak ? { tiebreak, tiedWith: tiebreak.tiedWith } : {}),
  };
  // The finals tally, public like the prelims one — the result the ballot
  // produced, not only the corps it crowned. The crowned corps leads it: it
  // shares its place with whoever it tied (the places are the ballot's, and
  // the ballot really did tie them), but the corps holding the trophy should
  // not be printed second in its own results.
  const finalsResults = [
    winnerRow,
    ...ranked.filter((row) => row.uid !== winnerRow.uid),
  ].map(publishable);
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
  readBallots,
  compareRows,
  compareBallotMeasures,
  rankBallot,
  advancingRows,
  publishedDepth,
  decideCrown,
  drawTicket,
  fanDocRef,
  ballotRef,
  prelimsOpensOn,
  prelimsClosesOn,
  openPrelimsMajor,
  finalsOpen,
  candidatesForMajor,
  publishFinalists,
  crownWinner,
};
