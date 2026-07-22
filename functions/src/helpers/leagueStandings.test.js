// Unit tests for the pure standings fold. The fold is intentionally not
// idempotent per pair (each resolved pair counts exactly once), which is why
// every write path wraps it in a Firestore transaction — and why purity
// matters: a transaction retry re-runs the fold against freshly-read records,
// so folding must never mutate its input.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { foldPairsIntoStandings } = require("./leagueStandings");

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

  test("incomplete pairs and unknown uids are ignored", () => {
    const base = freshRecords();
    const { records } = foldPairsIntoStandings(base, [
      { player1: "alice", player2: "bob", winner: "alice", completed: false },
      { player1: "ghost", player2: "phantom", winner: "ghost", completed: true },
    ]);
    assert.deepEqual(records, base);
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
