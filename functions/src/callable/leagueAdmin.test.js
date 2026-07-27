// Commissioner settings validation.
//
// A league used to be immutable after creation — there was no updateLeague*
// callable anywhere — so these rules are all new surface. The patch builder is
// pure so the rules can be pinned without a Firestore mock.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { buildLeagueSettingsUpdate } = require("./leagueAdmin");

const league = (over = {}) => ({
  name: "Test League",
  description: "A league",
  isPublic: true,
  maxMembers: 20,
  tag: null,
  members: ["a", "b", "c"],
  settings: { entryFee: 100, prizePool: 300, finalsSize: 12 },
  ...over,
});

describe("buildLeagueSettingsUpdate", () => {
  test("returns nothing to change when the patch matches the league", () => {
    const { updates, changes } = buildLeagueSettingsUpdate(
      { name: "Test League", isPublic: true, maxMembers: 20 },
      league()
    );
    assert.deepEqual(updates, {});
    assert.deepEqual(changes, []);
  });

  test("collects only the fields that actually differ", () => {
    const { updates, changes } = buildLeagueSettingsUpdate(
      { name: "Renamed", isPublic: true },
      league()
    );
    assert.deepEqual(updates, { name: "Renamed" });
    assert.deepEqual(changes, [{ field: "name", from: "Test League", to: "Renamed" }]);
  });

  test("trims the name and rejects one that is too short", () => {
    assert.deepEqual(buildLeagueSettingsUpdate({ name: "  Padded  " }, league()).updates, {
      name: "Padded",
    });
    assert.throws(() => buildLeagueSettingsUpdate({ name: "ab" }, league()), /at least 3/);
    assert.throws(() => buildLeagueSettingsUpdate({ name: "x".repeat(51) }, league()), /50/);
  });

  test("rejects a member cap below the current roster", () => {
    // A cap under the roster would make the league permanently "full" while
    // showing an impossible count, and would strand pending invitations.
    assert.throws(
      () => buildLeagueSettingsUpdate({ maxMembers: 2 }, league()),
      /already has 3 members/
    );
    assert.deepEqual(buildLeagueSettingsUpdate({ maxMembers: 3 }, league()).updates, {
      maxMembers: 3,
    });
  });

  test("rejects out-of-range or non-integer caps", () => {
    assert.throws(() => buildLeagueSettingsUpdate({ maxMembers: 51 }, league()), /between 2 and 50/);
    assert.throws(() => buildLeagueSettingsUpdate({ maxMembers: 8.5 }, league()), /whole number/);
  });

  test("accepts only the known league tags, plus null to clear", () => {
    assert.deepEqual(buildLeagueSettingsUpdate({ tag: "dynasty" }, league()).updates, {
      tag: "dynasty",
    });
    assert.deepEqual(buildLeagueSettingsUpdate({ tag: null }, league({ tag: "casual" })).updates, {
      tag: null,
    });
    assert.throws(() => buildLeagueSettingsUpdate({ tag: "elite" }, league()), /must be one of/);
  });

  test("writes finalsSize with its dotted settings path", () => {
    const { updates } = buildLeagueSettingsUpdate({ finalsSize: 6 }, league());
    assert.deepEqual(updates, { "settings.finalsSize": 6 });
  });

  // The pool is escrow: every member paid the fee advertised when they joined,
  // and removeLeagueMember's refund is clamped to it. A commissioner must not
  // be able to change what members already paid for.
  test("ignores an entry fee or prize pool in the patch", () => {
    const { updates, changes } = buildLeagueSettingsUpdate(
      { entryFee: 0, prizePool: 999999, settings: { entryFee: 0 } },
      league()
    );
    assert.deepEqual(updates, {});
    assert.deepEqual(changes, []);
  });

  test("rejects wrong types instead of coercing them", () => {
    assert.throws(() => buildLeagueSettingsUpdate({ name: 42 }, league()), /must be text/);
    assert.throws(() => buildLeagueSettingsUpdate({ isPublic: "yes" }, league()), /true or false/);
    assert.throws(
      () => buildLeagueSettingsUpdate({ description: "x".repeat(501) }, league()),
      /500 characters/
    );
  });
});

// A pinned note sits above everything else in the league, so it is capped
// short by design and clearing it is an explicit null rather than an empty
// string sneaking through as a change.
describe("buildLeagueSettingsUpdate — announcements", () => {
  const withAnnouncement = (text) =>
    league({ announcement: text ? { text, setBy: "owner" } : undefined });

  test("pins a new announcement", () => {
    const { updates, changes } = buildLeagueSettingsUpdate(
      { announcement: "  Draft night moved to Thursday.  " },
      withAnnouncement(null)
    );
    assert.deepEqual(updates, { announcement: { text: "Draft night moved to Thursday." } });
    assert.equal(changes[0].field, "announcement");
  });

  test("clearing it with null or an empty string both unpin", () => {
    assert.deepEqual(
      buildLeagueSettingsUpdate({ announcement: null }, withAnnouncement("old")).updates,
      { announcement: null }
    );
    assert.deepEqual(
      buildLeagueSettingsUpdate({ announcement: "   " }, withAnnouncement("old")).updates,
      { announcement: null }
    );
  });

  test("re-pinning the same text is not a change", () => {
    const { changes } = buildLeagueSettingsUpdate(
      { announcement: "same" },
      withAnnouncement("same")
    );
    assert.deepEqual(changes, []);
  });

  test("rejects an over-long or non-text announcement", () => {
    assert.throws(
      () => buildLeagueSettingsUpdate({ announcement: "x".repeat(281) }, withAnnouncement(null)),
      /280 characters/
    );
    assert.throws(
      () => buildLeagueSettingsUpdate({ announcement: 42 }, withAnnouncement(null)),
      /must be text/
    );
  });
});
