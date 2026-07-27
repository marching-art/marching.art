// Tests for the season-scoped league participation test.
//
// The regression these pin down: season rollover PRESERVES
// corps.{class}.corpsName (helpers/season.js) so directors keep their corps
// identity between seasons. Every league consumer used to read that field as
// "is playing" — so a director who last played two seasons ago still padded
// their leagues' member counts and still got paired into weekly matchups,
// where they scored 0 and handed their opponent a free win. The season-scoped
// marker is activeSeasonId, which rollover deliberately does NOT advance.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  isActiveThisSeason,
  isClassActiveThisSeason,
  isCorpsActiveThisSeason,
  computeSeasonActivity,
  emptySeasonActivity,
  refreshLeagueActivity,
} = require("./leagueActivity");

const NS = process.env.DATA_NAMESPACE;
const SEASON = "season-2";

/** A profile snapshot shaped like db.getAll() returns. */
const snap = (data) => ({ exists: data !== undefined, data: () => data });

/** A director who registered a corps for the CURRENT season. */
const registered = (overrides = {}) => ({
  activeSeasonId: SEASON,
  corps: { worldClass: { corpsName: "Blue Devils", lineup: null } },
  ...overrides,
});

/**
 * A director who played LAST season and hasn't been back. This is exactly what
 * archiveAndResetProfiles leaves behind: corpsName preserved, season data
 * zeroed, activeSeasonId still pointing at the finished season.
 */
const lapsed = () => ({
  activeSeasonId: "season-1",
  corps: {
    worldClass: {
      corpsName: "Blue Devils",
      lineup: null,
      selectedShows: {},
      weeklyScores: {},
      totalSeasonScore: 0,
    },
  },
});

describe("isActiveThisSeason", () => {
  test("a director registered for the live season is active", () => {
    assert.equal(isActiveThisSeason(registered(), SEASON), true);
  });

  test("a lapsed director is NOT active even though corpsName survived rollover", () => {
    const profile = lapsed();
    // The field the old league code trusted is still there...
    assert.equal(profile.corps.worldClass.corpsName, "Blue Devils");
    // ...but they have not come back since the season reset.
    assert.equal(isActiveThisSeason(profile, SEASON), false);
  });

  test("acknowledging the season without fielding a corps is not participation", () => {
    // The setup wizard advances activeSeasonId even when a director retires
    // everything, so the corps check is what separates "clicked through" from
    // "actually playing".
    assert.equal(isActiveThisSeason({ activeSeasonId: SEASON, corps: {} }, SEASON), false);
    assert.equal(
      isActiveThisSeason({ activeSeasonId: SEASON, corps: { aClass: { corpsName: null } } }, SEASON),
      false
    );
  });

  test("missing profile or missing season resolves to inactive", () => {
    assert.equal(isActiveThisSeason(undefined, SEASON), false);
    assert.equal(isActiveThisSeason(registered(), null), false);
  });

  // The bug this pins down: participation used to require the profile-wide
  // activeSeasonId marker, which registerCorps deliberately withholds from a
  // director who still owes corps decisions. Directors who registered that way
  // competed all season while their leagues reported zero members playing and
  // dropped out of public discovery entirely.
  test("the corps' own season stamp is enough, whatever the profile marker says", () => {
    const stampedButUnacknowledged = {
      activeSeasonId: "season-1",
      corps: {
        worldClass: { corpsName: "Holdover", lineup: null },
        openClass: { corpsName: "Registered Mid-Season", seasonUid: SEASON, lineup: null },
      },
    };
    assert.equal(isActiveThisSeason(stampedButUnacknowledged, SEASON), true);
    assert.equal(isClassActiveThisSeason(stampedButUnacknowledged, "openClass", SEASON), true);
  });

  test("a stale stamp keeps a corps out even if the profile escaped rollover", () => {
    const escapedRollover = {
      activeSeasonId: "season-1",
      corps: { worldClass: { corpsName: "Blue Devils", seasonUid: "season-1" } },
    };
    assert.equal(isActiveThisSeason(escapedRollover, SEASON), false);
  });

  test("season data that rollover clears proves a legacy corps is playing", () => {
    // No stamp (registered before the stamp existed) and a stale profile
    // marker, but this corps has plainly been played since the reset.
    const playing = (corps) => ({ activeSeasonId: "season-1", corps: { worldClass: corps } });
    const base = { corpsName: "Blue Devils" };

    assert.equal(isActiveThisSeason(playing({ ...base, lineupKey: "abc" }), SEASON), true);
    assert.equal(isActiveThisSeason(playing({ ...base, lineup: { GE1: "x" } }), SEASON), true);
    assert.equal(
      isActiveThisSeason(playing({ ...base, selectedShows: { week1: [] } }), SEASON),
      true
    );
    assert.equal(isActiveThisSeason(playing({ ...base, weeklyScores: { week1: 70 } }), SEASON), true);
    assert.equal(isActiveThisSeason(playing({ ...base, totalSeasonScore: 71.2 }), SEASON), true);
    assert.equal(
      isActiveThisSeason(playing({ ...base, weeklyTrades: { seasonUid: SEASON, used: 1 } }), SEASON),
      true
    );
    // ...and the reset shapes rollover actually writes prove nothing.
    assert.equal(
      isActiveThisSeason(
        playing({ ...base, lineup: null, selectedShows: {}, weeklyScores: {}, totalSeasonScore: 0 }),
        SEASON
      ),
      false
    );
    assert.equal(
      isActiveThisSeason(playing({ ...base, weeklyTrades: { seasonUid: "season-1", used: 3 } }), SEASON),
      false
    );
  });
});

describe("isCorpsActiveThisSeason", () => {
  test("an unnamed corps is never active, however it is stamped", () => {
    assert.equal(isCorpsActiveThisSeason({ seasonUid: SEASON }, {}, SEASON), false);
    assert.equal(isCorpsActiveThisSeason(undefined, {}, SEASON), false);
  });

  test("sitting the class out clears the stamp, so the corps stops counting", () => {
    // processCorpsDecisions' "skip" branch: identity kept, seasonUid nulled,
    // season data wiped.
    const skipped = {
      corpsName: "Blue Devils",
      seasonUid: null,
      lineup: null,
      selectedShows: {},
      weeklyScores: {},
      totalSeasonScore: 0,
    };
    assert.equal(isCorpsActiveThisSeason(skipped, { activeSeasonId: "season-1" }, SEASON), false);
  });
});

describe("isClassActiveThisSeason", () => {
  test("matches only the class the director actually fields", () => {
    const profile = registered();
    assert.equal(isClassActiveThisSeason(profile, "worldClass", SEASON), true);
    assert.equal(isClassActiveThisSeason(profile, "openClass", SEASON), false);
  });

  test("a lapsed director is pairable in no class at all", () => {
    assert.equal(isClassActiveThisSeason(lapsed(), "worldClass", SEASON), false);
  });
});

describe("computeSeasonActivity", () => {
  test("counts only members registered for the live season", () => {
    const members = ["active1", "lapsed1", "active2", "ghost"];
    const profiles = [snap(registered()), snap(lapsed()), snap(registered()), snap(undefined)];

    const activity = computeSeasonActivity(members, profiles, SEASON);

    assert.deepEqual(activity.activeMembers, ["active1", "active2"]);
    assert.equal(activity.activeMemberCount, 2);
    // The roster total is reported alongside so the UI can show "2 of 4"
    // rather than silently shrinking the league.
    assert.equal(activity.totalMemberCount, 4);
    assert.equal(activity.seasonUid, SEASON);
  });

  test("a league of entirely lapsed directors reads as empty", () => {
    const activity = computeSeasonActivity(["a", "b"], [snap(lapsed()), snap(lapsed())], SEASON);
    assert.equal(activity.activeMemberCount, 0);
    assert.deepEqual(activity.activeMembers, []);
  });

  test("an empty roster is handled without profile reads", () => {
    const activity = computeSeasonActivity([], [], SEASON);
    assert.equal(activity.activeMemberCount, 0);
    assert.equal(activity.totalMemberCount, 0);
  });
});

describe("emptySeasonActivity", () => {
  test("zeroes participation while keeping the roster size", () => {
    const activity = emptySeasonActivity(SEASON, 12);
    assert.equal(activity.seasonUid, SEASON);
    assert.equal(activity.activeMemberCount, 0);
    assert.deepEqual(activity.activeMembers, []);
    assert.equal(activity.totalMemberCount, 12);
  });
});

describe("refreshLeagueActivity", () => {
  function makeFakeDb(docs) {
    const updates = [];
    const makeRef = (path) => ({
      path,
      async get() {
        return { exists: docs.has(path), data: () => docs.get(path) };
      },
      async update(data) {
        docs.set(path, { ...docs.get(path), ...data });
        updates.push({ path, data });
      },
    });
    return {
      updates,
      db: {
        doc: makeRef,
        async getAll(...refs) {
          return refs.map((ref) => snap(docs.get(ref.path)));
        },
      },
    };
  }

  test("writes the recomputed block onto the league document", async () => {
    const docs = new Map([
      ["game-settings/season", { seasonUid: SEASON }],
      [`artifacts/${NS}/leagues/L1`, { members: ["a", "b", "c"] }],
      [`artifacts/${NS}/users/a/profile/data`, registered()],
      [`artifacts/${NS}/users/b/profile/data`, lapsed()],
      [`artifacts/${NS}/users/c/profile/data`, registered()],
    ]);
    const { db, updates } = makeFakeDb(docs);

    const activity = await refreshLeagueActivity(db, "L1");

    assert.equal(activity.activeMemberCount, 2);
    assert.deepEqual(activity.activeMembers, ["a", "c"]);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].path, `artifacts/${NS}/leagues/L1`);
    assert.equal(updates[0].data.seasonActivity.activeMemberCount, 2);
  });

  test("is a no-op for a league that no longer exists", async () => {
    const docs = new Map([["game-settings/season", { seasonUid: SEASON }]]);
    const { db, updates } = makeFakeDb(docs);

    assert.equal(await refreshLeagueActivity(db, "gone"), null);
    assert.equal(updates.length, 0);
  });

  test("is a no-op when there is no live season", async () => {
    const docs = new Map([[`artifacts/${NS}/leagues/L1`, { members: ["a"] }]]);
    const { db, updates } = makeFakeDb(docs);

    assert.equal(await refreshLeagueActivity(db, "L1"), null);
    assert.equal(updates.length, 0);
  });
});
