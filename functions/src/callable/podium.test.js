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
  validateShowPicks,
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

describe("validateShowPicks", () => {
  const uid = "user1";
  const seasonUid = "test_season";
  // A schedule with two shows on every day 1-49.
  const scheduleShowsByDay = {};
  for (let d = 1; d <= 49; d++) {
    scheduleShowsByDay[d] = [
      { eventName: `Show ${d}A`, location: `City ${d}A` },
      { eventName: `Show ${d}B`, location: `City ${d}B` },
    ];
  }
  const opts = { scheduleShowsByDay };
  const picks = (days) => days.map((d) => ({ day: d, eventName: `Show ${d}A` }));
  const expected = (days) =>
    Object.fromEntries(days.map((d) => [d, { eventName: `Show ${d}A`, location: `City ${d}A` }]));

  test("accepts up to 4 picks in weeks 1-3", () => {
    assert.deepEqual(
      validateShowPicks(1, picks([3, 5, 6, 7]), uid, seasonUid, 0, opts),
      expected([3, 5, 6, 7])
    );
  });

  test("weeks with a major allow only 3 picks", () => {
    assert.throws(() => validateShowPicks(4, picks([22, 23, 24, 25]), uid, seasonUid, 0, opts));
    assert.deepEqual(
      validateShowPicks(4, picks([22, 23, 24]), uid, seasonUid, 0, opts),
      expected([22, 23, 24])
    );
  });

  test("championship week is auto-only", () => {
    assert.throws(() => validateShowPicks(7, picks([43]), uid, seasonUid, 0, opts));
    assert.deepEqual(validateShowPicks(7, [], uid, seasonUid, 0, opts), {});
  });

  test("auto-attended days are not selectable", () => {
    assert.throws(() => validateShowPicks(4, picks([28]), uid, seasonUid, 0, opts)); // Southwestern
    assert.throws(() => validateShowPicks(5, picks([35]), uid, seasonUid, 0, opts)); // Southeastern
    const eastern = store.easternNightFor(uid, seasonUid);
    assert.throws(() => validateShowPicks(6, picks([eastern]), uid, seasonUid, 0, opts));
  });

  test("both Eastern nights are one event — neither is independently selectable", () => {
    assert.throws(() => validateShowPicks(6, picks([41]), uid, seasonUid, 0, opts));
    assert.throws(() => validateShowPicks(6, picks([42]), uid, seasonUid, 0, opts));
  });

  test("past days and wrong-week days rejected", () => {
    assert.throws(() => validateShowPicks(2, picks([9]), uid, seasonUid, 10, opts)); // passed
    assert.throws(() => validateShowPicks(2, picks([3]), uid, seasonUid, 0, opts)); // day 3 is wk 1
  });

  test("the current competition day is still selectable (locks at the next score run)", () => {
    assert.deepEqual(validateShowPicks(2, picks([10]), uid, seasonUid, 10, opts), expected([10]));
    assert.throws(() => validateShowPicks(2, picks([9]), uid, seasonUid, 10, opts));
  });

  test("one show per day — a later pick replaces the earlier", () => {
    assert.deepEqual(
      validateShowPicks(
        1,
        [{ day: 3, eventName: "Show 3A" }, { day: 3, eventName: "Show 3B" }],
        uid, seasonUid, 0, opts
      ),
      { 3: { eventName: "Show 3B", location: "City 3B" } }
    );
  });

  test("rejects a show that is not on the schedule that day", () => {
    assert.throws(() =>
      validateShowPicks(1, [{ day: 3, eventName: "Ghost Show" }], uid, seasonUid, 0, opts)
    );
  });

  test("requires an event name for each pick", () => {
    assert.throws(() => validateShowPicks(1, [{ day: 3 }], uid, seasonUid, 0, opts));
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
