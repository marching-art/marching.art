// Unit tests for the pure matchup-notification builder. The fan-out itself is
// best-effort I/O (createUserNotifications), so the logic worth locking down is
// how resolved pairs + a standings diff become per-director inbox entries.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { buildMatchupEntries } = require("./matchupNotifications");

const names = new Map([
  ["alice", "Alice"],
  ["bob", "Bob"],
]);

const baseArgs = {
  week: 3,
  leagueId: "league-1",
  leagueName: "Test League",
  seasonUid: "season-1",
  previousStandings: [],
  newStandings: [],
};

describe("buildMatchupEntries", () => {
  test("emits a result for BOTH participants with the right outcome", () => {
    const entries = buildMatchupEntries(names, {
      ...baseArgs,
      pairs: [
        { player1: "alice", player2: "bob", player1Score: 90, player2Score: 80, winner: "alice", corpsClass: "worldClass" },
      ],
    });

    const results = entries.filter((e) => e.type === "matchup_result");
    assert.equal(results.length, 2);

    const alice = results.find((e) => e.uid === "alice");
    const bob = results.find((e) => e.uid === "bob");
    assert.equal(alice.metadata.won, true);
    assert.match(alice.message, /beat Bob/);
    assert.equal(bob.metadata.won, false);
    assert.match(bob.message, /lost to Alice/);
    // Opponent-relative scores.
    assert.equal(alice.metadata.userScore, 90);
    assert.equal(alice.metadata.opponentScore, 80);
    assert.equal(bob.metadata.userScore, 80);
  });

  test("labels a tie for both sides", () => {
    const entries = buildMatchupEntries(names, {
      ...baseArgs,
      pairs: [
        { player1: "alice", player2: "bob", player1Score: 85, player2Score: 85, winner: "tie", corpsClass: "openClass" },
      ],
    });
    for (const e of entries.filter((x) => x.type === "matchup_result")) {
      assert.equal(e.metadata.won, false);
      assert.match(e.message, /tie/);
    }
  });

  test("skips byes (no opponent) but still counts the player as having played", () => {
    const entries = buildMatchupEntries(names, {
      ...baseArgs,
      // alice has a bye; the standings diff drops her a place.
      previousStandings: [{ uid: "alice" }, { uid: "bob" }],
      newStandings: [{ uid: "bob" }, { uid: "alice" }],
      pairs: [{ player1: "alice", player2: null, winner: "alice", corpsClass: "worldClass" }],
    });

    assert.equal(entries.filter((e) => e.type === "matchup_result").length, 0);
    // She played (had a matchup row), so a rank drop still notifies her.
    const drop = entries.find((e) => e.type === "standings_change");
    assert.ok(drop);
    assert.equal(drop.uid, "alice");
    assert.equal(drop.metadata.previousRank, 1);
    assert.equal(drop.metadata.newRank, 2);
  });

  test("dedupe keys are per-class so multi-class weeks don't collapse", () => {
    const entries = buildMatchupEntries(names, {
      ...baseArgs,
      pairs: [
        { player1: "alice", player2: "bob", player1Score: 90, player2Score: 80, winner: "alice", corpsClass: "worldClass" },
        { player1: "alice", player2: "bob", player1Score: 70, player2Score: 75, winner: "bob", corpsClass: "openClass" },
      ],
    });
    const aliceKeys = entries
      .filter((e) => e.type === "matchup_result" && e.uid === "alice")
      .map((e) => e.dedupeKey);
    assert.equal(new Set(aliceKeys).size, 2, "each class matchup gets its own dedupe key");
  });

  test("falls back to a generic name when a uid is unresolved", () => {
    const entries = buildMatchupEntries(new Map(), {
      ...baseArgs,
      pairs: [
        { player1: "ghost1", player2: "ghost2", player1Score: 90, player2Score: 80, winner: "ghost1", corpsClass: "aClass" },
      ],
    });
    assert.match(entries[0].message, /a director/);
  });
});

describe("cross-class matchup copy", () => {
  test("names the class-percentile finishes instead of the raw score line", () => {
    const entries = buildMatchupEntries(names, {
      ...baseArgs,
      pairs: [
        {
          player1: "alice",
          player2: "bob",
          player1Score: 85, // more raw points…
          player2Score: 62,
          player1Normalized: 33, // …but a worse week against her own class
          player2Normalized: 100,
          player1Class: "worldClass",
          player2Class: "soundSport",
          winner: "bob",
          corpsClass: "worldClass",
        },
      ],
    });

    const alice = entries.find((e) => e.uid === "alice");
    const bob = entries.find((e) => e.uid === "bob");
    assert.match(bob.message, /cross-class/);
    assert.match(bob.message, /100th percentile/);
    assert.match(alice.message, /33rd .*of theirs|33rd of theirs/);
    // The raw score line would contradict the verdict — it must not appear.
    assert.doesNotMatch(bob.message, /85\.000/);
    assert.doesNotMatch(alice.message, /62\.000/);
  });

  test("same-class pairs keep the score line even when class fields are present", () => {
    const entries = buildMatchupEntries(names, {
      ...baseArgs,
      pairs: [
        {
          player1: "alice",
          player2: "bob",
          player1Score: 90,
          player2Score: 80,
          player1Class: "worldClass",
          player2Class: "worldClass",
          winner: "alice",
          corpsClass: "worldClass",
        },
      ],
    });
    const alice = entries.find((e) => e.uid === "alice");
    assert.match(alice.message, /90\.000 – 80\.000/);
    assert.doesNotMatch(alice.message, /cross-class/);
  });
});
