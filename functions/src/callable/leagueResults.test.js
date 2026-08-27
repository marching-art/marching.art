// Commissioner result-correction validation.
//
// overrideMatchupResult rewrites someone's season, so its inputs are the last
// place to be loose: a malformed winner token, an unknown class, or a bye
// "result" would either corrupt the standings fold or write a value the fold
// cannot read. These pin the two validation gates — request-shape and
// matchup-shape — as pure functions (same pattern as leagueAdmin.test.js).
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { validateOverrideRequest, assertValidMatchupResult } = require("./leagueResults");

const req = (over = {}) => ({
  leagueId: "league-1",
  week: 3,
  corpsClass: "worldClass",
  matchupIndex: 0,
  winner: "u1",
  ...over,
});

describe("validateOverrideRequest", () => {
  test("accepts a well-formed request", () => {
    assert.doesNotThrow(() => validateOverrideRequest(req()));
    // matchupIndex 0 and week 0 are valid integers, not falsy-rejected.
    assert.doesNotThrow(() => validateOverrideRequest(req({ week: 0, matchupIndex: 0 })));
    // 'tie' is a valid winner token.
    assert.doesNotThrow(() => validateOverrideRequest(req({ winner: "tie" })));
  });

  test("requires a league id, integer week, class, and integer matchup index", () => {
    assert.throws(() => validateOverrideRequest(req({ leagueId: "" })), /required/);
    assert.throws(() => validateOverrideRequest(req({ week: 3.5 })), /required/);
    assert.throws(() => validateOverrideRequest(req({ week: "3" })), /required/);
    assert.throws(() => validateOverrideRequest(req({ corpsClass: "" })), /required/);
    assert.throws(() => validateOverrideRequest(req({ matchupIndex: 1.5 })), /required/);
    assert.throws(() => validateOverrideRequest(req({ matchupIndex: null })), /required/);
  });

  test("rejects a malformed league id even when present", () => {
    // The doc-id charset guard: a slash would let the id escape its collection.
    assert.throws(() => validateOverrideRequest(req({ leagueId: "a/b" })), /Invalid league ID/);
    assert.throws(
      () => validateOverrideRequest(req({ leagueId: "x".repeat(129) })),
      /Invalid league ID/
    );
  });

  test("rejects an unknown corps class", () => {
    assert.throws(() => validateOverrideRequest(req({ corpsClass: "masterClass" })), /Unknown corps class/);
  });

  test("accepts every real matchup class", () => {
    for (const corpsClass of ["worldClass", "openClass", "aClass", "soundSport", "podiumClass"]) {
      assert.doesNotThrow(() => validateOverrideRequest(req({ corpsClass })));
    }
  });

  test("rejects a missing or non-string winner", () => {
    assert.throws(() => validateOverrideRequest(req({ winner: "" })), /winner/);
    assert.throws(() => validateOverrideRequest(req({ winner: null })), /winner/);
    assert.throws(() => validateOverrideRequest(req({ winner: 42 })), /winner/);
  });
});

describe("assertValidMatchupResult", () => {
  const matchup = (over = {}) => ({ pair: ["u1", "u2"], ...over });

  test("a matchup that does not exist is not-found", () => {
    assert.throws(
      () => assertValidMatchupResult({ matchup: undefined, winner: "u1" }),
      /does not exist/
    );
  });

  test("a bye has no result to override", () => {
    assert.throws(
      () => assertValidMatchupResult({ matchup: matchup({ isBye: true }), winner: "u1" }),
      /bye has no result/
    );
    // A single-entry pair (no opponent) is a bye too.
    assert.throws(
      () => assertValidMatchupResult({ matchup: { pair: ["u1"] }, winner: "u1" }),
      /bye has no result/
    );
    assert.throws(
      () => assertValidMatchupResult({ matchup: { pair: ["u1", null] }, winner: "u1" }),
      /bye has no result/
    );
  });

  test("the winner must be one of the two directors, or 'tie'", () => {
    assert.throws(
      () => assertValidMatchupResult({ matchup: matchup(), winner: "outsider" }),
      /one of the two directors/
    );
    assert.doesNotThrow(() => assertValidMatchupResult({ matchup: matchup(), winner: "u1" }));
    assert.doesNotThrow(() => assertValidMatchupResult({ matchup: matchup(), winner: "u2" }));
    assert.doesNotThrow(() => assertValidMatchupResult({ matchup: matchup(), winner: "tie" }));
  });
});
