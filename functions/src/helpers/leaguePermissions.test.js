// Who can run a league.
//
// Every commissioner gate used to be a bare `creatorId === uid`, which made a
// league a single point of failure: one person, who cannot be away, cannot
// share the work, and whose departure used to orphan the league outright.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  isLeagueOwner,
  isLeagueCommissioner,
  listCommissioners,
  pickSuccessor,
} = require("./leaguePermissions");

const league = (over = {}) => ({
  creatorId: "owner",
  commissioners: ["deputy"],
  members: ["owner", "deputy", "rank", "file"],
  ...over,
});

describe("isLeagueOwner", () => {
  test("is exactly one director", () => {
    assert.equal(isLeagueOwner(league(), "owner"), true);
    assert.equal(isLeagueOwner(league(), "deputy"), false);
    assert.equal(isLeagueOwner(league(), "rank"), false);
  });

  test("is false for a missing uid or a system-owned league", () => {
    assert.equal(isLeagueOwner(league(), undefined), false);
    // Rookie circuits deliberately carry no creatorId, so no one owns them.
    assert.equal(isLeagueOwner({ members: ["a"] }, "a"), false);
  });
});

describe("isLeagueCommissioner", () => {
  test("covers the owner and every co-commissioner", () => {
    assert.equal(isLeagueCommissioner(league(), "owner"), true);
    assert.equal(isLeagueCommissioner(league(), "deputy"), true);
    assert.equal(isLeagueCommissioner(league(), "rank"), false);
  });

  test("a league with no commissioners array still has its owner", () => {
    const bare = { creatorId: "owner" };
    assert.equal(isLeagueCommissioner(bare, "owner"), true);
    assert.equal(isLeagueCommissioner(bare, "someone"), false);
  });

  test("is false for missing inputs rather than throwing", () => {
    assert.equal(isLeagueCommissioner(null, "owner"), false);
    assert.equal(isLeagueCommissioner(league(), undefined), false);
    assert.equal(isLeagueCommissioner({ commissioners: "nope" }, "owner"), false);
  });
});

describe("listCommissioners", () => {
  test("puts the owner first and de-duplicates", () => {
    assert.deepEqual(listCommissioners(league({ commissioners: ["deputy", "owner"] })), [
      "owner",
      "deputy",
    ]);
  });

  test("drops falsy entries from a system-owned league", () => {
    assert.deepEqual(listCommissioners({ commissioners: ["a"] }), ["a"]);
    assert.deepEqual(listCommissioners({}), []);
  });
});

describe("pickSuccessor", () => {
  // A co-commissioner already does the job and the members already know it.
  test("prefers a co-commissioner", () => {
    assert.equal(pickSuccessor(league(), "owner"), "deputy");
  });

  test("falls back to any remaining member so the league is never orphaned", () => {
    assert.equal(pickSuccessor(league({ commissioners: [] }), "owner"), "deputy");
    assert.equal(
      pickSuccessor(league({ commissioners: [], members: ["owner", "rank"] }), "owner"),
      "rank"
    );
  });

  test("never picks the departing director", () => {
    const result = pickSuccessor(league({ commissioners: ["owner"] }), "owner");
    assert.notEqual(result, "owner");
  });

  test("returns null when nobody is left", () => {
    assert.equal(pickSuccessor(league({ members: ["owner"] }), "owner"), null);
    assert.equal(pickSuccessor({}, "owner"), null);
  });
});
