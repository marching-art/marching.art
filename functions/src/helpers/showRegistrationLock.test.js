// Per-night show-registration lock: a night's shows freeze the moment its
// scores run (9 PM ET off-season / the planned live drop), not at the 2 AM ET
// rollover. Covers the lock-day derivation and the pure "locked shows can't
// change" rule that selectUserShows enforces.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { getLockedRegistrationDays } = require("./showRegistrationLock");
const { assertLockedShowsUnchanged } = require("./showSelection");

// Off-season that began Sun 2026-09-27 (Day 1), stored at UTC midnight.
const offSeason = {
  status: "off-season",
  seasonUid: "s1",
  schedule: { startDate: new Date("2026-09-27T00:00:00Z") },
};

/** @param {Set<string>} [recaps] */
function fakeDb(recaps = new Set()) {
  return {
    doc: (/** @type {string} */ path) => ({
      async get() {
        return { exists: recaps.has(path) };
      },
    }),
  };
}

describe("getLockedRegistrationDays", () => {
  test("Day 1 is open before its 9 PM ET off-season drop", async () => {
    const locked = await getLockedRegistrationDays({
      db: /** @type {any} */ (fakeDb()),
      seasonData: offSeason,
      competitions: [],
      week: 1,
      now: new Date("2026-09-27T20:59:00-04:00"),
    });
    assert.deepEqual([...locked], []);
  });

  test("Day 1 locks at the 9 PM ET drop, hours before the 2 AM rollover", async () => {
    const locked = await getLockedRegistrationDays({
      db: /** @type {any} */ (fakeDb()),
      seasonData: offSeason,
      competitions: [],
      week: 1,
      now: new Date("2026-09-27T23:52:00-04:00"),
    });
    assert.deepEqual([...locked], [1]);
  });

  test("still locked after the rollover; the new night stays open", async () => {
    const locked = await getLockedRegistrationDays({
      db: /** @type {any} */ (fakeDb()),
      seasonData: offSeason,
      competitions: [],
      week: 1,
      now: new Date("2026-09-28T10:00:00-04:00"),
    });
    assert.deepEqual([...locked], [1]);
  });

  test("a recap that already exists locks tonight ahead of the plan", async () => {
    const locked = await getLockedRegistrationDays({
      db: /** @type {any} */ (fakeDb(new Set(["fantasy_recaps/s1/days/2"]))),
      seasonData: offSeason,
      competitions: [],
      week: 1,
      now: new Date("2026-09-28T15:00:00-04:00"),
    });
    assert.deepEqual([...locked].sort(), [1, 2]);
  });

  test("only reports days inside the requested week", async () => {
    const locked = await getLockedRegistrationDays({
      db: /** @type {any} */ (fakeDb()),
      seasonData: offSeason,
      competitions: [],
      week: 2,
      now: new Date("2026-10-05T22:00:00-04:00"),
    });
    // Day 9 (Mon Oct 5) has dropped; Day 8 rolled over.
    assert.deepEqual([...locked].sort((a, b) => a - b), [8, 9]);
  });

  test("no start date: nothing is locked", async () => {
    const locked = await getLockedRegistrationDays({
      db: /** @type {any} */ (fakeDb()),
      seasonData: { status: "off-season" },
      competitions: [],
      week: 1,
    });
    assert.equal(locked.size, 0);
  });
});

describe("assertLockedShowsUnchanged", () => {
  const competitions = [
    { name: "Sunday Night Lights", day: 1 },
    { name: "Moonlight Classic", day: 1 },
    { name: "Crossroads", day: 2 },
    { name: "Eastern Classic", day: 41, multiNight: { nights: [41, 42] } },
    { name: "Eastern Classic", day: 42, multiNight: { nights: [41, 42] } },
  ];
  const locked = new Set([1]);

  test("withdrawing from a scored show is rejected", () => {
    assert.throws(
      () => assertLockedShowsUnchanged(
        1,
        [{ eventName: "Sunday Night Lights", day: 1 }],
        [],
        locked,
        competitions
      ),
      /already been processed/
    );
  });

  test("joining a scored show is rejected", () => {
    assert.throws(
      () => assertLockedShowsUnchanged(1, [], [{ eventName: "Moonlight Classic", day: 1 }], locked, competitions),
      /closed when that night's scores/
    );
  });

  test("switching between two shows on a scored night is rejected", () => {
    assert.throws(
      () => assertLockedShowsUnchanged(
        1,
        [{ eventName: "Sunday Night Lights", day: 1 }],
        [{ eventName: "Moonlight Classic", day: 1 }],
        locked,
        competitions
      ),
      /already been processed/
    );
  });

  test("keeping a scored show while editing open nights is allowed", () => {
    assert.doesNotThrow(() =>
      assertLockedShowsUnchanged(
        1,
        [{ eventName: "Sunday Night Lights", day: 1 }],
        [{ eventName: "Sunday Night Lights", day: 1 }, { eventName: "Crossroads", day: 2 }],
        locked,
        competitions
      )
    );
    assert.doesNotThrow(() =>
      assertLockedShowsUnchanged(
        1,
        [{ eventName: "Sunday Night Lights", day: 1 }, { eventName: "Crossroads", day: 2 }],
        [{ eventName: "Sunday Night Lights", day: 1 }],
        locked,
        competitions
      )
    );
  });

  test("a two-night event locks once its first night is scored", () => {
    assert.throws(
      () => assertLockedShowsUnchanged(
        6,
        [{ eventName: "Eastern Classic", day: 41 }],
        [],
        new Set([41]),
        competitions
      ),
      /already been processed/
    );
  });

  test("a stored show missing from the schedule falls back to its own day", () => {
    assert.throws(
      () => assertLockedShowsUnchanged(1, [{ eventName: "Renamed Show", day: 1 }], [], locked, competitions),
      /already been processed/
    );
  });
});
