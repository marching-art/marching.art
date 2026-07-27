// Unit tests for the pure standings fold. The fold is intentionally not
// idempotent per pair (each resolved pair counts exactly once), which is why
// every write path wraps it in a Firestore transaction — and why purity
// matters: a transaction retry re-runs the fold against freshly-read records,
// so folding must never mutate its input.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { foldPairsIntoStandings, rebuildStandingsFromMatchups } = require("./leagueStandings");

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
