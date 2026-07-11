// Tests for the Podium callable validators (Phase 2) — the pure validation
// logic that guards registration and show selection. The engine itself is
// covered by the simulation harness; transactional flows land with the
// emulator suite.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  validateChallenge,
  validateAuditions,
  validateShowDays,
  validateCommitment,
} = require("./podium");
const store = require("../helpers/podium/store");

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];
const fullChallenge = (level) => Object.fromEntries(CAPTIONS.map((c) => [c, level]));

describe("validateChallenge", () => {
  test("accepts a complete 1-8 map", () => {
    assert.deepEqual(validateChallenge(fullChallenge(5)), fullChallenge(5));
  });

  test("rejects missing captions, out-of-range and non-integer levels", () => {
    assert.throws(() => validateChallenge({ GE1: 5 }));
    assert.throws(() => validateChallenge(fullChallenge(9)));
    assert.throws(() => validateChallenge(fullChallenge(0)));
    assert.throws(() => validateChallenge({ ...fullChallenge(5), B: 5.5 }));
    assert.throws(() => validateChallenge(null));
  });
});

describe("validateAuditions", () => {
  test("null/zero allocations mean even distribution (undefined)", () => {
    assert.equal(validateAuditions(null), undefined);
    assert.equal(validateAuditions(Object.fromEntries(CAPTIONS.map((c) => [c, 0]))), undefined);
  });

  test("returns normalized shares", () => {
    const shares = validateAuditions({ B: 50, P: 50 });
    assert.equal(shares.B, 0.5);
    assert.equal(shares.P, 0.5);
    assert.equal(shares.GE1, 0);
  });

  test("rejects negatives, non-integers, and over-pool totals", () => {
    assert.throws(() => validateAuditions({ B: -1 }));
    assert.throws(() => validateAuditions({ B: 1.5 }));
    assert.throws(() => validateAuditions({ B: 101 }));
  });
});

describe("validateShowDays", () => {
  const uid = "user1";
  const seasonUid = "test_season";

  test("accepts up to 4 picks in weeks 1-3", () => {
    assert.deepEqual(validateShowDays(1, [3, 5, 6, 7], uid, seasonUid, 0), [3, 5, 6, 7]);
  });

  test("weeks with a major allow only 3 picks", () => {
    assert.throws(() => validateShowDays(4, [22, 23, 24, 25], uid, seasonUid, 0));
    assert.deepEqual(validateShowDays(4, [22, 23, 24], uid, seasonUid, 0), [22, 23, 24]);
  });

  test("championship week is auto-only", () => {
    assert.throws(() => validateShowDays(7, [43], uid, seasonUid, 0));
    assert.deepEqual(validateShowDays(7, [], uid, seasonUid, 0), []);
  });

  test("auto-attended days are not selectable", () => {
    assert.throws(() => validateShowDays(4, [28], uid, seasonUid, 0)); // Southwestern
    assert.throws(() => validateShowDays(5, [35], uid, seasonUid, 0)); // Southeastern
    const eastern = store.easternNightFor(uid, seasonUid);
    assert.throws(() => validateShowDays(6, [eastern], uid, seasonUid, 0));
  });

  test("the OTHER Eastern night is selectable is false too — both nights are one event", () => {
    // Only the assigned night is auto; but the other night is day 41/42 of
    // week 6 and must not be independently selectable either.
    const assigned = store.easternNightFor(uid, seasonUid);
    const other = assigned === 41 ? 42 : 41;
    // Current rule: the unassigned night is not in autoDays, so it would
    // validate as a pick — pin the intended behavior instead:
    let threw = false;
    try {
      validateShowDays(6, [other], uid, seasonUid, 0);
    } catch {
      threw = true;
    }
    assert.equal(threw, true, "the unassigned Eastern night must not be selectable");
  });

  test("past days and wrong-week days rejected", () => {
    assert.throws(() => validateShowDays(2, [9], uid, seasonUid, 10)); // already passed
    assert.throws(() => validateShowDays(2, [3], uid, seasonUid, 0)); // day 3 is week 1
  });

  test("the current competition day is still selectable (locks at the next score run)", () => {
    // day === currentCompetitionDay must be allowed — parity with the fantasy
    // registration deadline, which stays open through the show's own day.
    assert.deepEqual(validateShowDays(2, [10], uid, seasonUid, 10), [10]);
    // strictly-earlier days remain rejected
    assert.throws(() => validateShowDays(2, [9], uid, seasonUid, 10));
  });

  test("dedupes and sorts", () => {
    assert.deepEqual(validateShowDays(1, [6, 3, 6], uid, seasonUid, 0), [3, 6]);
  });
});

describe("validateCommitment (Corps Budget, decision 24)", () => {
  test("zero/null commitments are allowed (free floor)", () => {
    assert.equal(validateCommitment(null, 0), 0);
    assert.equal(validateCommitment(0, 0), 0);
  });

  test("accepts up to the cap, cumulatively (a 1,000-CC season is well inside it)", () => {
    assert.equal(validateCommitment(1000, 0), 1000);
    assert.equal(validateCommitment(2500, 0), 2500);
    assert.equal(validateCommitment(400, 2100), 400);
  });

  test("rejects negatives, non-integers, and over-cap totals", () => {
    assert.throws(() => validateCommitment(-1, 0));
    assert.throws(() => validateCommitment(10.5, 0));
    assert.throws(() => validateCommitment(2501, 0));
    assert.throws(() => validateCommitment(500, 2100));
  });
});
