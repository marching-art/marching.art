// The planning rule for repairing `usernames/{lower}` reservations: create
// what is missing, reassign stale holders, and when several accounts share a
// name the OLDEST keeps it while every newer one is moved to a temporary
// numbered handle.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  planUsernameReservations,
  temporaryUsername,
  createdAtMs,
} = require("./backfillUsernameReservations");

const day = (n) => new Date(Date.UTC(2026, 0, n)).toISOString();

describe("planUsernameReservations", () => {
  test("creates a reservation for a profile whose handle has none, keyed lowercase", () => {
    const plan = planUsernameReservations([{ uid: "u1", username: "MaestroMax" }], new Map());
    assert.deepEqual(plan.reserve, [{ key: "maestromax", uid: "u1", previousHolder: null }]);
    assert.equal(plan.held, 0);
    assert.deepEqual(plan.renames, []);
    assert.deepEqual(plan.skipped, []);
  });

  test("is idempotent: a reservation already held by the same uid is left alone", () => {
    const plan = planUsernameReservations(
      [{ uid: "u1", username: "Alice" }],
      new Map([["alice", { uid: "u1" }]])
    );
    assert.deepEqual(plan.reserve, []);
    assert.deepEqual(plan.renames, []);
    assert.equal(plan.held, 1);
  });

  test("reassigns a reservation whose holder has no profile or no longer uses the name", () => {
    const plan = planUsernameReservations(
      [
        { uid: "u2", username: "alice" },
        { uid: "u9", username: "renamed" },
      ],
      new Map([
        ["alice", { uid: "u-gone" }],
        ["bob", { uid: "u9" }],
      ])
    );
    assert.deepEqual(plan.reserve, [
      { key: "alice", uid: "u2", previousHolder: "u-gone" },
      { key: "renamed", uid: "u9", previousHolder: null },
    ]);
    assert.deepEqual(plan.renames, []);
  });

  test("the older account keeps a shared name; the newer one gets a temporary numbered handle", () => {
    const plan = planUsernameReservations(
      [
        { uid: "new", username: "Alice", createdAt: day(20) },
        { uid: "old", username: "alice", createdAt: day(1) },
      ],
      new Map([["alice", { uid: "new" }]])
    );
    assert.deepEqual(plan.reserve, [{ key: "alice", uid: "old", previousHolder: "new" }]);
    assert.deepEqual(plan.renames, [{ uid: "new", from: "Alice", to: "Alice2", key: "alice2", keptBy: "old" }]);
  });

  test("JoeSmith (older) vs joesmith (newer): case-insensitive clash, newer becomes joesmith2", () => {
    const plan = planUsernameReservations(
      [
        { uid: "joe-orig", username: "JoeSmith", createdAt: day(1) },
        { uid: "joe-new", username: "joesmith", createdAt: day(15) },
      ],
      new Map()
    );
    assert.deepEqual(plan.reserve, [{ key: "joesmith", uid: "joe-orig", previousHolder: null }]);
    assert.deepEqual(plan.renames, [
      { uid: "joe-new", from: "joesmith", to: "joesmith2", key: "joesmith2", keptBy: "joe-orig" },
    ]);
  });

  test("a missing createdAt counts as the oldest account", () => {
    const plan = planUsernameReservations(
      [
        { uid: "dated", username: "drum_major", createdAt: day(1) },
        { uid: "undated", username: "Drum_Major" },
      ],
      new Map()
    );
    assert.deepEqual(plan.reserve, [{ key: "drum_major", uid: "undated", previousHolder: null }]);
    assert.equal(plan.renames[0].uid, "dated");
  });

  test("three-way clash: every newer account gets its own free number, skipping taken ones", () => {
    const plan = planUsernameReservations(
      [
        { uid: "c", username: "alice", createdAt: day(30) },
        { uid: "a", username: "alice", createdAt: day(1) },
        { uid: "b", username: "alice", createdAt: day(10) },
        { uid: "x", username: "alice2", createdAt: day(5) }, // alice2 is genuinely someone's
      ],
      new Map([["alice3", { uid: "someone" }]])
    );
    assert.deepEqual(plan.reserve, [
      { key: "alice", uid: "a", previousHolder: null },
      { key: "alice2", uid: "x", previousHolder: null },
    ]);
    assert.deepEqual(
      plan.renames.map((r) => `${r.uid}:${r.to}`),
      ["b:alice4", "c:alice5"]
    );
  });

  test("ties on createdAt go to the current reservation holder", () => {
    const plan = planUsernameReservations(
      [
        { uid: "u1", username: "alice", createdAt: day(1) },
        { uid: "u2", username: "alice", createdAt: day(1) },
      ],
      new Map([["alice", { uid: "u2" }]])
    );
    assert.equal(plan.held, 1);
    assert.equal(plan.renames[0].uid, "u1");
  });

  test("skips profiles with no username or a malformed one, and reports why", () => {
    const plan = planUsernameReservations(
      [
        { uid: "u1", username: undefined },
        { uid: "u2", username: "   " },
        { uid: "u3", username: "has space" },
        { uid: "u4", username: "ab" },
        { uid: "u5", username: "  Trimmed  " },
      ],
      new Map()
    );
    assert.deepEqual(plan.reserve, [{ key: "trimmed", uid: "u5", previousHolder: null }]);
    assert.deepEqual(
      plan.skipped.map((s) => s.uid),
      ["u1", "u2", "u3", "u4"]
    );
    assert.match(plan.skipped[0].reason, /no username/);
    assert.match(plan.skipped[2].reason, /shape/);
  });
});

describe("temporaryUsername", () => {
  test("appends the smallest free number and trims the stem to the 15-char cap", () => {
    assert.equal(temporaryUsername("alice", () => false), "alice2");
    const taken = new Set(["alice2", "alice3"]);
    assert.equal(temporaryUsername("alice", (k) => taken.has(k)), "alice4");
    assert.equal(temporaryUsername("fifteen_chars_x", () => false), "fifteen_chars_2");
    assert.equal(temporaryUsername("fifteen_chars_x", (k) => k.length && k !== "fifteen_chars10"), "fifteen_chars10");
  });
});

describe("createdAtMs", () => {
  test("reads every shape createdAt has been stored in", () => {
    const ms = Date.UTC(2026, 0, 1);
    assert.equal(createdAtMs(new Date(ms)), ms);
    assert.equal(createdAtMs(new Date(ms).toISOString()), ms);
    assert.equal(createdAtMs(ms), ms);
    assert.equal(createdAtMs({ toMillis: () => ms }), ms);
    assert.equal(createdAtMs({ seconds: ms / 1000, nanoseconds: 0 }), ms);
    assert.equal(createdAtMs({ _seconds: ms / 1000 }), ms);
    assert.equal(createdAtMs(undefined), null);
    assert.equal(createdAtMs("not a date"), null);
  });
});
