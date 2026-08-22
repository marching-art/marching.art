// Unit tests for the pure standings fold. The fold is intentionally not
// idempotent per pair (each resolved pair counts exactly once), which is why
// every write path wraps it in a Firestore transaction — and why purity
// matters: a transaction retry re-runs the fold against freshly-read records,
// so folding must never mutate its input.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  foldPairsIntoStandings,
  rebuildStandingsFromMatchups,
  applyStandingsInTransaction,
  computeRankDrops,
} = require("./leagueStandings");

const freshRecords = () => ({
  alice: { wins: 1, losses: 0, ties: 0, pointsFor: 80, pointsAgainst: 70, currentStreak: 1, streakType: "W" },
  bob: { wins: 0, losses: 1, ties: 0, pointsFor: 70, pointsAgainst: 80, currentStreak: 1, streakType: "L" },
});

describe("foldPairsIntoStandings", () => {
  test("folds a decided pair into wins/losses, points, and streaks", () => {
    const { records, standings } = foldPairsIntoStandings(freshRecords(), [
      {
        player1: "alice",
        player2: "bob",
        player1Score: 90,
        player2Score: 85,
        winner: "alice",
        completed: true,
      },
    ]);

    assert.equal(records.alice.wins, 2);
    assert.equal(records.alice.currentStreak, 2);
    assert.equal(records.alice.streakType, "W");
    assert.equal(records.alice.pointsFor, 170);
    assert.equal(records.alice.pointsAgainst, 155);

    assert.equal(records.bob.losses, 2);
    assert.equal(records.bob.currentStreak, 2);
    assert.equal(records.bob.streakType, "L");

    // Standings array sorted by wins then points, in the frontend shape.
    assert.deepEqual(
      standings.map((s) => s.uid),
      ["alice", "bob"]
    );
    assert.equal(standings[0].totalPoints, 170);
    assert.equal(standings[0].streak, 2);
  });

  test("a loss breaks a win streak and starts a loss streak at 1", () => {
    const { records } = foldPairsIntoStandings(freshRecords(), [
      {
        player1: "alice",
        player2: "bob",
        player1Score: 60,
        player2Score: 75,
        winner: "bob",
        completed: true,
      },
    ]);
    assert.equal(records.alice.losses, 1);
    assert.equal(records.alice.currentStreak, 1);
    assert.equal(records.alice.streakType, "L");
    assert.equal(records.bob.wins, 1);
    assert.equal(records.bob.streakType, "W");
  });

  test("ties increment ties, add points, and reset both streaks", () => {
    const { records } = foldPairsIntoStandings(freshRecords(), [
      {
        player1: "alice",
        player2: "bob",
        player1Score: 88,
        player2Score: 88,
        winner: "tie",
        completed: true,
      },
    ]);
    assert.equal(records.alice.ties, 1);
    assert.equal(records.bob.ties, 1);
    assert.equal(records.alice.currentStreak, 0);
    assert.equal(records.alice.streakType, null);
    assert.equal(records.alice.pointsFor, 168);
    assert.equal(records.bob.pointsFor, 158);
  });

  test("byes count as a win with no points", () => {
    const { records } = foldPairsIntoStandings(freshRecords(), [
      { player1: "bob", player2: null, winner: "bob", completed: true },
    ]);
    assert.equal(records.bob.wins, 1);
    assert.equal(records.bob.streakType, "W");
    assert.equal(records.bob.pointsFor, 70); // unchanged
  });

  test("incomplete pairs are ignored", () => {
    const base = freshRecords();
    const { records } = foldPairsIntoStandings(base, [
      { player1: "alice", player2: "bob", winner: "alice", completed: false },
    ]);
    // Every field the input carried survives untouched; the normalized
    // counters are simply defaulted in.
    assert.equal(records.alice.wins, base.alice.wins);
    assert.equal(records.alice.pointsFor, base.alice.pointsFor);
    assert.equal(records.bob.losses, base.bob.losses);
    assert.equal(records.alice.normalizedWeeks, 0);
  });

  // The fold used to guard every branch with `if (records[uid])`, so a member
  // whose record had never been seeded played their whole season without a
  // single result being recorded — silently, with no error anywhere.
  test("seeds a record for a resolved participant who has none", () => {
    const { records, standings } = foldPairsIntoStandings(freshRecords(), [
      {
        player1: "newcomer",
        player2: "alice",
        player1Score: 95,
        player2Score: 90,
        winner: "newcomer",
        completed: true,
      },
    ]);

    assert.equal(records.newcomer.wins, 1);
    assert.equal(records.newcomer.losses, 0);
    assert.equal(records.newcomer.pointsFor, 95);
    assert.equal(records.newcomer.pointsAgainst, 90);
    assert.equal(records.newcomer.streakType, "W");
    assert.equal(records.alice.losses, 1);
    assert.ok(standings.some((row) => row.uid === "newcomer"));
  });

  test("never mutates the input records (transaction-retry safety)", () => {
    const base = freshRecords();
    const snapshot = JSON.parse(JSON.stringify(base));
    foldPairsIntoStandings(base, [
      {
        player1: "alice",
        player2: "bob",
        player1Score: 90,
        player2Score: 85,
        winner: "alice",
        completed: true,
      },
    ]);
    assert.deepEqual(base, snapshot);
  });
});

// Rebuilding from the matchup documents is what makes a correction possible at
// all: the incremental fold counts each pair exactly once, so "unfold the old
// result and fold the new one" is exactly the arithmetic that goes wrong
// quietly. Deriving the whole table sidesteps it.
// Matchups are class-segregated but the table is league-wide, so raw points
// compare a ~90 World Class week against a ~60 SoundSport week — the old
// tiebreaker sorted a mixed-class league by class rather than by performance.
describe("normalized (cross-class) ranking", () => {
  const pair = (p1, p2, s1, s2, n1, n2) => ({
    player1: p1,
    player2: p2,
    player1Score: s1,
    player2Score: s2,
    player1Normalized: n1,
    player2Normalized: n2,
    winner: s1 > s2 ? p1 : p2,
    completed: true,
  });

  test("ranks equal records on class percentile, not raw points", () => {
    const { standings } = foldPairsIntoStandings({}, [
      // World Class: big raw numbers, middling against its own field.
      pair("worldPro", "worldFoe", 92, 88, 55, 20),
      // SoundSport: small raw numbers, dominant against its own field.
      pair("soundStar", "soundFoe", 61, 55, 98, 15),
    ]);

    const order = standings.map((row) => row.uid);
    assert.ok(
      order.indexOf("soundStar") < order.indexOf("worldPro"),
      "the director who dominated their own class should rank first"
    );
    assert.equal(standings[0].normalizedScore, 98);
  });

  test("averages the percentile across weeks rather than summing it", () => {
    const { standings } = foldPairsIntoStandings({}, [
      pair("alice", "bob", 90, 80, 80, 20),
      pair("alice", "bob", 90, 80, 60, 20),
    ]);
    const alice = standings.find((row) => row.uid === "alice");
    assert.equal(alice.normalizedScore, 70);
  });

  test("falls back to raw points when neither side carries a percentile", () => {
    // Matchups resolved before normalization existed carry none, and ranking
    // on data availability would be worse than ranking on raw points.
    const { standings } = foldPairsIntoStandings({}, [
      { player1: "a", player2: "b", player1Score: 95, player2Score: 90, winner: "a", completed: true },
      { player1: "c", player2: "d", player1Score: 99, player2Score: 10, winner: "c", completed: true },
    ]);
    assert.equal(standings[0].normalizedScore, null);
    assert.equal(standings[0].uid, "c");
  });
});

// Caption Wars ranks equal records on the format the league actually played:
// twelve categories to six is a more dominant 4-2 than seven to eleven.
describe("category record ranking", () => {
  const pair = (p1, p2, s1, s2, c1, c2) => ({
    player1: p1,
    player2: p2,
    player1Score: s1,
    player2Score: s2,
    player1Captions: c1,
    player2Captions: c2,
    winner: s1 > s2 ? p1 : p2,
    completed: true,
  });

  test("separates two identical records on categories taken", () => {
    const { standings, records } = foldPairsIntoStandings({}, [
      // Both win once, but alice swept and carol scraped it 2-1.
      pair("alice", "bob", 90, 80, { won: 3, lost: 0 }, { won: 0, lost: 3 }),
      pair("carol", "dave", 90, 80, { won: 2, lost: 1 }, { won: 1, lost: 2 }),
    ]);

    assert.equal(records.alice.captionsWon, 3);
    assert.equal(records.alice.captionsLost, 0);
    const order = standings.map((row) => row.uid);
    assert.ok(order.indexOf("alice") < order.indexOf("carol"));
  });

  // The margin, not the raw count: a director who took 7 while dropping 11 has
  // been worse than one who took 6 while dropping 3, whatever the totals say.
  test("ranks on the margin rather than categories taken alone", () => {
    const { standings } = foldPairsIntoStandings({}, [
      pair("busy", "b", 90, 80, { won: 2, lost: 1 }, { won: 1, lost: 2 }),
      pair("busy", "b", 90, 80, { won: 2, lost: 1 }, { won: 1, lost: 2 }),
      pair("clean", "d", 90, 80, { won: 3, lost: 0 }, { won: 0, lost: 3 }),
      pair("clean", "d", 90, 80, { won: 3, lost: 0 }, { won: 0, lost: 3 }),
    ]);

    const order = standings.map((row) => row.uid);
    assert.ok(order.indexOf("clean") < order.indexOf("busy"));
  });

  test("outranks the normalized score, which only breaks a category tie", () => {
    const { standings } = foldPairsIntoStandings({}, [
      {
        player1: "sweeper", player2: "a", player1Score: 70, player2Score: 60,
        player1Normalized: 10, player2Normalized: 5,
        player1Captions: { won: 3, lost: 0 }, player2Captions: { won: 0, lost: 3 },
        winner: "sweeper", completed: true,
      },
      {
        // A far better week against its own class, but a narrower win.
        player1: "ranker", player2: "b", player1Score: 95, player2Score: 90,
        player1Normalized: 99, player2Normalized: 40,
        player1Captions: { won: 2, lost: 1 }, player2Captions: { won: 1, lost: 2 },
        winner: "ranker", completed: true,
      },
    ]);

    const order = standings.map((row) => row.uid);
    assert.ok(
      order.indexOf("sweeper") < order.indexOf("ranker"),
      "the category record is checked before the class percentile"
    );
  });

  // The regression guard: with no captions anywhere the term is a constant and
  // the table sorts exactly as it did before the format existed.
  test("a league on the default format is ordered exactly as before", () => {
    const { standings, records } = foldPairsIntoStandings({}, [
      {
        player1: "a", player2: "b", player1Score: 92, player2Score: 88,
        player1Normalized: 55, player2Normalized: 20,
        winner: "a", completed: true,
      },
      {
        player1: "c", player2: "d", player1Score: 61, player2Score: 55,
        player1Normalized: 98, player2Normalized: 15,
        winner: "c", completed: true,
      },
    ]);

    assert.equal(records.a.captionsWon, 0);
    assert.equal(records.a.captionsLost, 0);
    // Still the class percentile that decides, as it did before.
    assert.equal(standings[0].uid, "c");
  });

  test("a tie splits categories without touching the win column", () => {
    const { records } = foldPairsIntoStandings({}, [
      {
        player1: "a", player2: "b", player1Score: 86, player2Score: 86,
        player1Captions: { won: 1, lost: 1 }, player2Captions: { won: 1, lost: 1 },
        winner: "tie", completed: true,
      },
    ]);

    assert.equal(records.a.ties, 1);
    assert.equal(records.a.captionsWon, 1);
    assert.equal(records.a.captionsLost, 1);
  });
});

describe("rebuildStandingsFromMatchups", () => {
  const classes = ["worldClass", "soundSport"];
  const week = (n, worldClass = [], soundSport = []) => ({
    id: `week-${n}`,
    data: { worldClassMatchups: worldClass, soundSportMatchups: soundSport },
  });
  const decided = (p1, p2, s1, s2) => ({
    pair: [p1, p2],
    scores: { [p1]: s1, [p2]: s2 },
    winner: s1 === s2 ? "tie" : s1 > s2 ? p1 : p2,
    completed: true,
  });

  test("derives the whole table from every resolved week", () => {
    const { records } = rebuildStandingsFromMatchups(
      [week(1, [decided("alice", "bob", 90, 80)]), week(2, [decided("alice", "bob", 70, 85)])],
      classes
    );

    assert.equal(records.alice.wins, 1);
    assert.equal(records.alice.losses, 1);
    assert.equal(records.alice.pointsFor, 160);
    assert.equal(records.bob.pointsFor, 165);
    // Streak reflects the LAST week, so weeks must be folded in order.
    assert.equal(records.bob.streakType, "W");
  });

  test("ignores unresolved weeks and counts byes once", () => {
    const { records } = rebuildStandingsFromMatchups(
      [
        week(1, [{ pair: ["alice", null], winner: "alice", completed: true, isBye: true }]),
        week(2, [{ pair: ["alice", "bob"], completed: false }]),
      ],
      classes
    );

    assert.equal(records.alice.wins, 1);
    assert.equal(records.bob, undefined);
  });

  // A rebuild is what repairs a drifted table and what applies a commissioner's
  // correction, so it has to recover the category record too — otherwise the
  // repair itself would silently zero the column the league is ranked on.
  test("recovers the category record from the stored captions block", () => {
    const captionMatchup = {
      pair: ["alice", "bob"],
      scores: { alice: 86, bob: 94 },
      captions: {
        ge: { scores: { alice: 30, bob: 40 }, winner: "bob" },
        visual: { scores: { alice: 28, bob: 27 }, winner: "alice" },
        music: { scores: { alice: 28, bob: 27 }, winner: "alice" },
        tally: { alice: 2, bob: 1 },
      },
      winner: "alice",
      completed: true,
    };

    const { records } = rebuildStandingsFromMatchups([week(1, [captionMatchup])], classes);

    assert.equal(records.alice.wins, 1);
    assert.equal(records.alice.captionsWon, 2);
    assert.equal(records.alice.captionsLost, 1);
    assert.equal(records.bob.captionsWon, 1);
    assert.equal(records.bob.captionsLost, 2);
    // Points still come from the totals, so the loser's bigger week survives.
    assert.equal(records.bob.pointsFor, 94);
  });

  test("weeks with no captions block leave the counters at zero", () => {
    const { records } = rebuildStandingsFromMatchups(
      [week(1, [decided("alice", "bob", 90, 80)])],
      classes
    );
    assert.equal(records.alice.captionsWon, 0);
    assert.equal(records.alice.captionsLost, 0);
  });

  test("running it twice produces the same table (unlike the incremental fold)", () => {
    const weeks = [week(1, [decided("alice", "bob", 90, 80)])];
    const first = rebuildStandingsFromMatchups(weeks, classes);
    const second = rebuildStandingsFromMatchups(weeks, classes);
    assert.deepEqual(first.records, second.records);
  });

  test("seeds every current member and drops directors who left", () => {
    const { records, standings } = rebuildStandingsFromMatchups(
      [week(1, [decided("alice", "departed", 90, 80)])],
      classes,
      ["alice", "newcomer"]
    );

    // A director who joined mid-season appears rather than vanishing.
    assert.ok(records.newcomer, "current members get a row even with no results");
    assert.equal(records.newcomer.wins, 0);
    assert.equal(records.departed, undefined);
    assert.deepEqual(standings.map((r) => r.uid).sort(), ["alice", "newcomer"]);
  });

  test("folds every corps class, not just the first", () => {
    const { records } = rebuildStandingsFromMatchups(
      [week(1, [decided("alice", "bob", 90, 80)], [decided("alice", "carol", 40, 60)])],
      classes
    );

    assert.equal(records.alice.wins, 1);
    assert.equal(records.alice.losses, 1);
  });
});

describe("applyStandingsInTransaction", () => {
  /** A transaction that records what it was asked to write. */
  const fakeTransaction = () => {
    const writes = [];
    return {
      writes,
      set: (ref, data, options) => writes.push({ op: "set", ref, data, options }),
      update: (ref, data) => writes.push({ op: "update", ref, data }),
    };
  };

  const snapshot = (exists, records) => ({
    exists,
    ref: { path: "artifacts/ns/leagues/L1/standings/current" },
    data: () => ({ records }),
  });

  const decidedPair = [
    {
      player1: "alice",
      player2: "bob",
      player1Score: 90,
      player2Score: 80,
      winner: "alice",
      completed: true,
    },
  ];

  test("folds into an existing document", () => {
    const t = fakeTransaction();
    applyStandingsInTransaction(t, snapshot(true, freshRecords()), decidedPair);

    assert.equal(t.writes.length, 1);
    assert.equal(t.writes[0].data.records.alice.wins, 2);
  });

  test("CREATES the document when it is missing instead of dropping the week", () => {
    // The regression the championship-week rehearsal found: this used to
    // `return` on a missing document, so every week of the season resolved and
    // was silently discarded, the table stayed empty, and season archival
    // crowned nobody because it found no standings rows.
    const t = fakeTransaction();
    applyStandingsInTransaction(t, snapshot(false, undefined), decidedPair);

    assert.equal(t.writes.length, 1, "the week must be recorded, not dropped");
    assert.equal(t.writes[0].op, "set", "a missing document cannot be update()d");
    assert.equal(t.writes[0].options?.merge, true);
    // Both directors get a row, seeded by the fold.
    assert.equal(t.writes[0].data.records.alice.wins, 1);
    assert.equal(t.writes[0].data.records.bob.losses, 1);
    assert.equal(t.writes[0].data.standings.length, 2);
  });

  test("returns the previous and new standings for rank diffing", () => {
    const t = fakeTransaction();
    const prev = [{ uid: "bob" }, { uid: "alice" }];
    const diff = applyStandingsInTransaction(
      t,
      { exists: true, ref: { path: "x" }, data: () => ({ records: freshRecords(), standings: prev }) },
      decidedPair
    );
    assert.deepEqual(diff.previousStandings, prev);
    assert.ok(Array.isArray(diff.standings));
  });
});

describe("computeRankDrops", () => {
  const rows = (...uids) => uids.map((uid) => ({ uid }));

  test("reports only directors who fell AND played this week", () => {
    // bob 1→3 (dropped), carol 2→1 (climbed), dave 3→2 (climbed), eve absent.
    const prev = rows("bob", "carol", "dave");
    const next = rows("carol", "dave", "bob");
    const drops = computeRankDrops(prev, next, ["bob", "carol", "dave"]);
    assert.deepEqual(drops, [{ uid: "bob", previousRank: 1, newRank: 3 }]);
  });

  test("ignores a dropped director who did not play this week", () => {
    const prev = rows("bob", "carol");
    const next = rows("carol", "bob");
    // Only carol is in the affected set, and carol climbed — so nothing.
    assert.deepEqual(computeRankDrops(prev, next, ["carol"]), []);
  });

  test("a director new to the table has no drop to report", () => {
    const drops = computeRankDrops(rows("alice"), rows("alice", "bob"), ["bob"]);
    assert.deepEqual(drops, []);
  });

  test("tolerates empty/missing standings", () => {
    assert.deepEqual(computeRankDrops([], [], ["a"]), []);
    assert.deepEqual(computeRankDrops(undefined, undefined, []), []);
  });
});
