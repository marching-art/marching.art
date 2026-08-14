// The fill rule for backfilling corps graphics onto archived Hall of Champions
// docs. Only entries that predate the avatarUrl archival (no field at all)
// should be touched; anything already carrying the field — even null — is left
// exactly as-is so the backfill is idempotent and never overwrites a graphic.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { backfillClasses } = require("./backfillChampionAvatars");

// Resolver standing in for profile.corps[corpsClass].avatarUrl lookups.
const resolver = (map) => (uid, corpsClass) => map[`${uid}::${corpsClass}`] ?? null;

describe("backfillClasses", () => {
  test("fills a missing avatarUrl from the resolver", () => {
    const resolve = resolver({ "w1::worldClass": "https://cdn/w1.png" });
    const { classes, changed } = backfillClasses(
      { worldClass: [{ rank: 1, uid: "w1", corpsName: "Champ", score: 97 }] },
      resolve
    );
    assert.equal(changed, 1);
    assert.deepEqual(classes.worldClass[0], {
      rank: 1,
      uid: "w1",
      corpsName: "Champ",
      score: 97,
      avatarUrl: "https://cdn/w1.png",
    });
  });

  test("writes null when the champion has no graphic (or profile is gone)", () => {
    const { classes, changed } = backfillClasses(
      { openClass: [{ rank: 1, uid: "o1", corpsName: "Open", score: 70 }] },
      resolver({})
    );
    assert.equal(changed, 1);
    assert.equal(classes.openClass[0].avatarUrl, null);
  });

  test("resolves per corps class, not per uid — same director, two slots", () => {
    const resolve = resolver({
      "u1::worldClass": "https://cdn/world.png",
      "u1::aClass": "https://cdn/a.png",
    });
    const { classes } = backfillClasses(
      {
        worldClass: [{ rank: 1, uid: "u1", corpsName: "Big", score: 95 }],
        aClass: [{ rank: 1, uid: "u1", corpsName: "Small", score: 80 }],
      },
      resolve
    );
    assert.equal(classes.worldClass[0].avatarUrl, "https://cdn/world.png");
    assert.equal(classes.aClass[0].avatarUrl, "https://cdn/a.png");
  });

  test("is idempotent — an entry already carrying avatarUrl (even null) is untouched", () => {
    const resolve = resolver({ "w1::worldClass": "https://cdn/new.png" });
    const input = {
      worldClass: [
        { rank: 1, uid: "w1", avatarUrl: "https://cdn/existing.png" },
        { rank: 2, uid: "w2", avatarUrl: null },
      ],
    };
    const { classes, changed } = backfillClasses(input, resolve);
    assert.equal(changed, 0);
    assert.equal(classes.worldClass[0].avatarUrl, "https://cdn/existing.png");
    assert.equal(classes.worldClass[1].avatarUrl, null);
  });

  test("fills only the entries that are missing the field", () => {
    const resolve = resolver({ "w2::worldClass": "https://cdn/w2.png" });
    const { classes, changed } = backfillClasses(
      {
        worldClass: [
          { rank: 1, uid: "w1", avatarUrl: "https://cdn/w1.png" },
          { rank: 2, uid: "w2", corpsName: "Second", score: 90 },
        ],
      },
      resolve
    );
    assert.equal(changed, 1);
    assert.equal(classes.worldClass[0].avatarUrl, "https://cdn/w1.png");
    assert.equal(classes.worldClass[1].avatarUrl, "https://cdn/w2.png");
  });

  test("entries without a uid resolve to null without calling the resolver", () => {
    let called = false;
    const resolve = () => {
      called = true;
      return "should-not-be-used";
    };
    const { classes, changed } = backfillClasses(
      { soundSport: [{ rank: 1, corpsName: "Anon", score: 60 }] },
      resolve
    );
    assert.equal(changed, 1);
    assert.equal(classes.soundSport[0].avatarUrl, null);
    assert.equal(called, false);
  });

  test("handles an empty or malformed classes map", () => {
    assert.deepEqual(backfillClasses({}, resolver({})), { classes: {}, changed: 0 });
    // A non-array class value is passed through untouched.
    const weird = { worldClass: "oops" };
    const { classes, changed } = backfillClasses(weird, resolver({}));
    assert.equal(changed, 0);
    assert.equal(classes.worldClass, "oops");
  });
});
