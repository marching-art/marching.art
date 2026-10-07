// League tags on director profiles — which leagues a director wears.
//
// The privacy line is the point: only leagues whose commissioner set a tag are
// ever returned, so an untagged private league never shows up on a profile.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { buildLeagueTagEntries } = require("./leagueTags");

const at = (ms) => ({ toMillis: () => ms });
const league = (id, over = {}) => ({
  id,
  data: {
    name: `League ${id}`,
    members: ["dir", "viewer"],
    creatorId: "someone",
    isPublic: true,
    createdAt: at(1),
    ...over,
  },
});

describe("buildLeagueTagEntries", () => {
  test("lists only tagged leagues the director is in", () => {
    const entries = buildLeagueTagEntries(
      [
        league("a", { abbreviation: "AAA" }),
        league("b"), // no tag: never named
        league("c", { abbreviation: "CCC", members: ["other"] }),
        league("d", { abbreviation: "bad tag" }), // stored value no longer validates
      ],
      "dir",
      "viewer"
    );
    assert.deepEqual(
      entries.map((e) => e.abbreviation),
      ["AAA"]
    );
  });

  test("carries the game mode, visibility, commissioner and viewer flags", () => {
    const [entry] = buildLeagueTagEntries(
      [
        league("a", {
          abbreviation: "DCFL",
          isPublic: false,
          settings: { gameMode: "podium" },
          commissioners: ["dir"],
          members: ["dir"],
        }),
      ],
      "dir",
      "viewer"
    );
    assert.deepEqual(entry, {
      leagueId: "a",
      name: "League a",
      abbreviation: "DCFL",
      gameMode: "podium",
      isPublic: false,
      isCommissioner: true,
      viewerIsMember: false,
    });
  });

  test("the owner is a commissioner; a signed-out viewer is never a member", () => {
    const [entry] = buildLeagueTagEntries(
      [league("a", { abbreviation: "OWN", creatorId: "dir" })],
      "dir",
      null
    );
    assert.equal(entry.isCommissioner, true);
    assert.equal(entry.viewerIsMember, false);
    assert.equal(entry.gameMode, "both");
  });

  test("orders oldest league first so chips don't reshuffle", () => {
    const entries = buildLeagueTagEntries(
      [
        league("new", { abbreviation: "NEW", createdAt: at(300) }),
        league("old", { abbreviation: "OLD", createdAt: at(100) }),
        league("mid", { abbreviation: "MID", createdAt: at(200) }),
      ],
      "dir",
      "viewer"
    );
    assert.deepEqual(
      entries.map((e) => e.abbreviation),
      ["OLD", "MID", "NEW"]
    );
  });
});
