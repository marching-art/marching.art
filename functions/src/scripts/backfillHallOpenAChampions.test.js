// The rebuild rule for correcting archived Open/A Class Hall of Champions
// podiums. The old archival crowned Open/A from the Day 49 World bracket; this
// recomputes them from the Day 46 Open and A Class Finals, carrying banners to
// their buyers and reporting any that fall off the corrected podium. World
// Class / SoundSport / Podium entries must never be touched, and a season
// already matching its Day 46 recap must be a no-op.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { rebuildOpenAClasses } = require("./backfillHallOpenAChampions");

const result = (uid, corpsClass, totalScore, corpsName = `Corps ${uid}`) => ({
  uid,
  corpsClass,
  totalScore,
  corpsName,
});
const day46 = (results) => [{ eventName: "Open and A Class Finals", results }];
// Profile lookup standing in for db.getAll(userProfile) results.
const profiles = (map) => (uid) => map[uid] || null;

describe("rebuildOpenAClasses", () => {
  test("recomputes Open/A from the Day 46 field, ignoring the stored World-bracket podium", () => {
    // Stored (buggy) podium: o2 above o1 because o2 out-placed o1 at Day 49.
    const classes = {
      worldClass: [{ rank: 1, uid: "w1", corpsName: "World Champ", score: 97, avatarUrl: null }],
      openClass: [{ rank: 1, uid: "o2", corpsName: "Open Runner", score: 90, avatarUrl: null }],
    };
    const shows = day46([
      result("o1", "openClass", 82, "Open Champ Corps"),
      result("o2", "openClass", 78, "Open Runner Corps"),
      result("a1", "aClass", 70, "A Champ Corps"),
    ]);

    const { classes: next, changed, orphanedBanners } = rebuildOpenAClasses(
      classes,
      shows,
      profiles({ o1: { username: "OpenChamp" }, o2: { username: "OpenRunnerUp" }, a1: { username: "AChamp" } })
    );

    assert.equal(changed, true);
    assert.deepEqual(orphanedBanners, []);
    // World Class is left exactly as stored.
    assert.deepEqual(next.worldClass, classes.worldClass);
    // Open Class now follows the Day 46 field: o1 champion, o2 runner-up.
    assert.deepEqual(next.openClass, [
      { rank: 1, uid: "o1", username: "OpenChamp", corpsName: "Open Champ Corps", avatarUrl: null, score: 82 },
      { rank: 2, uid: "o2", username: "OpenRunnerUp", corpsName: "Open Runner Corps", avatarUrl: null, score: 78 },
    ]);
    assert.deepEqual(next.aClass, [
      { rank: 1, uid: "a1", username: "AChamp", corpsName: "A Champ Corps", avatarUrl: null, score: 70 },
    ]);
  });

  test("carries a banner to its buyer's corrected entry", () => {
    const banner = { message: "Go Blue!", purchasedAt: "2026-01-01T00:00:00.000Z" };
    const classes = {
      // o1 bought a banner while (wrongly) crowned champion; still on the podium.
      openClass: [{ rank: 1, uid: "o1", corpsName: "Open Champ", score: 90, avatarUrl: null, banner }],
    };
    const shows = day46([
      result("o2", "openClass", 85, "Real Champ Corps"),
      result("o1", "openClass", 80, "Open Champ Corps"),
    ]);

    const { classes: next, orphanedBanners } = rebuildOpenAClasses(
      classes,
      shows,
      profiles({ o1: { username: "OldChamp" }, o2: { username: "RealChamp" } })
    );

    assert.deepEqual(orphanedBanners, []);
    assert.equal(next.openClass[0].uid, "o2");
    assert.equal(next.openClass[0].banner, undefined, "the real champion gets no banner they didn't buy");
    assert.equal(next.openClass[1].uid, "o1");
    assert.deepEqual(next.openClass[1].banner, banner, "the buyer keeps their banner at its new rank");
  });

  test("reports a banner whose buyer fell off the corrected podium", () => {
    const banner = { message: "Orphan", purchasedAt: "2026-01-01T00:00:00.000Z" };
    const classes = {
      openClass: [{ rank: 1, uid: "ghost", corpsName: "Ghost", score: 99, avatarUrl: null, banner }],
    };
    // ghost is not in the Day 46 field at all.
    const shows = day46([
      result("o1", "openClass", 82, "Real Champ Corps"),
      result("o2", "openClass", 78, "Runner Corps"),
      result("o3", "openClass", 74, "Third Corps"),
      result("o4", "openClass", 70, "Fourth Corps"),
    ]);

    const { classes: next, orphanedBanners } = rebuildOpenAClasses(classes, shows, profiles({}));

    assert.equal(next.openClass.length, 3, "only the top 3 are kept");
    assert.equal(
      next.openClass.some((e) => e.banner),
      false,
      "the orphaned banner is dropped from the record"
    );
    assert.deepEqual(orphanedBanners, [{ corpsClass: "openClass", uid: "ghost", banner }]);
  });

  test("is a no-op when the stored podium already matches the Day 46 field", () => {
    const classes = {
      openClass: [
        { rank: 1, uid: "o1", username: "OpenChamp", corpsName: "Open Champ Corps", avatarUrl: null, score: 82 },
      ],
    };
    const shows = day46([result("o1", "openClass", 82, "Open Champ Corps")]);

    const { changed } = rebuildOpenAClasses(classes, shows, profiles({ o1: { username: "OpenChamp" } }));
    assert.equal(changed, false);
  });

  test("leaves a class untouched when the Day 46 recap has no results for it", () => {
    const classes = {
      openClass: [{ rank: 1, uid: "o1", corpsName: "Open", score: 80, avatarUrl: null }],
      aClass: [{ rank: 1, uid: "a1", corpsName: "A", score: 70, avatarUrl: null }],
    };
    // Day 46 has Open results but no A Class results.
    const shows = day46([result("o1", "openClass", 80, "Open")]);

    const { classes: next, changed } = rebuildOpenAClasses(
      classes,
      shows,
      profiles({ o1: { username: "OpenChamp" } })
    );

    // Open Class rebuilt (gained username), A Class preserved verbatim.
    assert.equal(changed, true);
    assert.deepEqual(next.aClass, classes.aClass);
  });

  test("falls back to the old entry's username when the profile is gone", () => {
    const classes = {
      openClass: [{ rank: 1, uid: "o1", username: "HistoricName", corpsName: "Open", score: 80, avatarUrl: null }],
    };
    const shows = day46([result("o1", "openClass", 80, "Open Champ Corps")]);

    const { classes: next } = rebuildOpenAClasses(classes, shows, profiles({})); // no profiles
    assert.equal(next.openClass[0].username, "HistoricName");
  });
});
