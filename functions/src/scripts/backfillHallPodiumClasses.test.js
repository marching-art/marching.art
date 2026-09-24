// The rebuild rule for adding the Podium Division's Open/A Class podiums to
// archived Hall of Champions docs. The World podium (`podiumClass`), every
// fantasy class and every banner must survive untouched, and a season already
// carrying the right podiums must be a no-op.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { rebuildPodiumDivisionClasses } = require("./backfillHallPodiumClasses");

const RECORD = [
  { uid: "w1", corpsName: "Crimson", lastTotal: 95.1, division: "worldClass", place: 1 },
  { uid: "o1", corpsName: "Onyx", lastTotal: 94.2, division: "openClass", place: 2 },
  { uid: "w2", corpsName: "Cobalt", lastTotal: 93.9, division: "worldClass", place: 3 },
  { uid: "a1", corpsName: "Amber", lastTotal: 88.4, division: "aClass", place: 4 },
  { uid: "o2", corpsName: "Opal", lastTotal: 87.0, division: "openClass", place: 5 },
];
const profiles = (map) => (uid) => map[uid] || null;
const PROFILES = profiles({
  o1: { username: "onyx_dir", corps: { podiumClass: { avatarUrl: "https://cdn/o1.png" } } },
  a1: { displayName: "Amber Director" },
});

describe("rebuildPodiumDivisionClasses", () => {
  test("adds the Open/A podiums from the record and leaves every other key alone", () => {
    const classes = {
      worldClass: [{ rank: 1, uid: "f1", corpsName: "Fantasy Champ", score: 97 }],
      podiumClass: [{ rank: 1, uid: "w1", corpsName: "Crimson", score: 95.1, banner: { message: "hi" } }],
    };
    const { classes: next, changed } = rebuildPodiumDivisionClasses(classes, RECORD, PROFILES);
    assert.equal(changed, true);
    assert.deepEqual(next.worldClass, classes.worldClass);
    assert.deepEqual(next.podiumClass, classes.podiumClass);
    assert.deepEqual(
      next.podiumOpenClass.map((e) => [e.rank, e.uid, e.username, e.avatarUrl, e.corpsClass]),
      [
        [1, "o1", "onyx_dir", "https://cdn/o1.png", "openClass"],
        [2, "o2", "Unknown", null, "openClass"],
      ]
    );
    assert.deepEqual(
      next.podiumAClass.map((e) => [e.rank, e.uid, e.username, e.score]),
      [[1, "a1", "Amber Director", 88.4]]
    );
  });

  test("a season already carrying the right podiums is a no-op", () => {
    const first = rebuildPodiumDivisionClasses({}, RECORD, PROFILES);
    const second = rebuildPodiumDivisionClasses(first.classes, RECORD, PROFILES);
    assert.equal(second.changed, false);
    assert.deepEqual(second.classes, first.classes);
  });

  test("a banner already hung on a division champion's entry is carried through", () => {
    const stored = rebuildPodiumDivisionClasses({}, RECORD, PROFILES).classes;
    stored.podiumAClass[0].banner = { message: "A Class forever", purchasedAt: "2026-01-01" };
    // A username change re-resolves, but the banner stays.
    const renamed = profiles({ a1: { username: "amber_renamed" } });
    const { classes: next, changed } = rebuildPodiumDivisionClasses(stored, RECORD, renamed);
    assert.equal(changed, true);
    assert.equal(next.podiumAClass[0].username, "amber_renamed");
    assert.deepEqual(next.podiumAClass[0].banner, { message: "A Class forever", purchasedAt: "2026-01-01" });
  });

  test("a division nobody competed in gets no key", () => {
    const { classes: next } = rebuildPodiumDivisionClasses(
      {},
      RECORD.filter((e) => e.division !== "aClass"),
      PROFILES
    );
    assert.ok(!("podiumAClass" in next));
    assert.equal(next.podiumOpenClass.length, 2);
  });
});
