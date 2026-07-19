// Tests for the rivals bucketing — specifically that Podium Class corps get
// rivals (the dashboard RivalsPanel reads profile.rivals.podiumClass) and that
// Podium is never mixed into the fantasy competitive bucket (PODIUM.md §5.5).
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  bucketFor,
  indexCorpsByBucket,
  pickRivalsForEntry,
} = require("./rivalsComputation");

function profileDoc(data) {
  return { exists: true, data: () => data };
}

describe("bucketFor", () => {
  test("routes podiumClass to its own bucket", () => {
    assert.equal(bucketFor("podiumClass"), "podium");
  });

  test("keeps the historical fantasy buckets", () => {
    assert.equal(bucketFor("soundSport"), "soundSport");
    assert.equal(bucketFor("worldClass"), "competitive");
    assert.equal(bucketFor("openClass"), "competitive");
    assert.equal(bucketFor("aClass"), "competitive");
  });
});

describe("indexCorpsByBucket", () => {
  test("indexes podium corps with their division, separate from competitive", () => {
    const docs = [
      profileDoc({
        username: "alice",
        corps: {
          worldClass: { corpsName: "Alice World", totalSeasonScore: 85 },
          podiumClass: { corpsName: "Alice Podium", totalSeasonScore: 72, division: "openClass" },
        },
      }),
      profileDoc({
        username: "bob",
        corps: {
          podiumClass: { corpsName: "Bob Podium", totalSeasonScore: 74.5 },
        },
      }),
    ];
    const byBucket = indexCorpsByBucket(docs, ["uid-alice", "uid-bob"]);

    assert.equal(byBucket.competitive.length, 1);
    assert.equal(byBucket.podium.length, 2);
    // Sorted by score descending.
    assert.deepEqual(
      byBucket.podium.map((e) => e.uid),
      ["uid-bob", "uid-alice"],
    );
    assert.equal(byBucket.podium[1].division, "openClass");
    // Division defaults to aClass when the display copy predates the field.
    assert.equal(byBucket.podium[0].division, "aClass");
    // Fantasy entries carry no division.
    assert.equal(byBucket.competitive[0].division, null);
  });
});

describe("pickRivalsForEntry (podium bucket)", () => {
  const entry = {
    uid: "me",
    username: "me",
    corpsClass: "podiumClass",
    corpsName: "My Corps",
    score: 80,
    division: "openClass",
  };
  const podiumEntry = (uid, score, division) => ({
    uid,
    username: uid,
    corpsClass: "podiumClass",
    corpsName: `${uid} corps`,
    score,
    avatarUrl: null,
    division,
  });

  test("returns score-shaped rivals with divisions for podium corps", () => {
    const bucket = [podiumEntry("p1", 82, "openClass"), entry, podiumEntry("p2", 79, "openClass")];
    bucket.sort((a, b) => b.score - a.score);

    const rivals = pickRivalsForEntry(entry, bucket);
    assert.equal(rivals.length, 2);
    for (const rival of rivals) {
      assert.equal(rival.corpsClass, "podiumClass");
      assert.equal(typeof rival.score, "number");
      assert.equal(typeof rival.scoreDelta, "number");
      assert.equal(rival.division, "openClass");
      // Podium never uses the SoundSport medal shape.
      assert.equal(rival.medal, undefined);
    }
  });

  test("prefers same-division rivals before crossing divisions", () => {
    const bucket = [
      podiumEntry("world-close", 80.1, "worldClass"), // closest score, wrong division
      podiumEntry("open-far", 60, "openClass"),
      podiumEntry("open-near", 76, "openClass"),
      entry,
    ];
    bucket.sort((a, b) => b.score - a.score);

    const rivals = pickRivalsForEntry(entry, bucket);
    assert.deepEqual(
      rivals.map((r) => r.uid),
      ["open-near", "open-far", "world-close"],
    );
  });

  test("competitive bucket still prefers same-class (unchanged behavior)", () => {
    const worldEntry = {
      uid: "me",
      username: "me",
      corpsClass: "worldClass",
      corpsName: "My World",
      score: 80,
      division: null,
    };
    const fantasy = (uid, corpsClass, score) => ({
      uid,
      username: uid,
      corpsClass,
      corpsName: `${uid} corps`,
      score,
      avatarUrl: null,
      division: null,
    });
    const bucket = [
      fantasy("open-close", "openClass", 80.05),
      fantasy("world-far", "worldClass", 70),
      worldEntry,
    ];
    bucket.sort((a, b) => b.score - a.score);

    const rivals = pickRivalsForEntry(worldEntry, bucket);
    assert.deepEqual(
      rivals.map((r) => r.uid),
      ["world-far", "open-close"],
    );
  });
});
