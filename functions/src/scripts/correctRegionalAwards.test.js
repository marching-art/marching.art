// The pure reconciliation rules for correcting regional trophies: only the
// three branded majors crown regional champions, so wrong entries on pool shows
// are stripped and missing correct ones are added, idempotently. Uses the same
// branded-name matcher (regionalTierForEventName) as the live scorer.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  isBrandedMajor,
  mergeMajorShows,
  fantasyMajorAwards,
  podiumMajorChampion,
  reconcileProfileTrophies,
} = require("./correctRegionalAwards");

const SW = "marching.art Southwestern Championship";
const EASTERN = "marching.art Eastern Classic";
const res = (uid, corpsClass, totalScore) => ({ uid, corpsClass, totalScore });

describe("isBrandedMajor", () => {
  test("matches the three majors, rejects pool shows", () => {
    assert.ok(isBrandedMajor(SW));
    assert.ok(isBrandedMajor("marching.art Southeastern Championship"));
    assert.ok(isBrandedMajor(EASTERN));
    assert.ok(!isBrandedMajor("The Buccaneer Classic"));
    assert.ok(!isBrandedMajor("Midwestern Championship"));
    assert.ok(!isBrandedMajor("marching.art Pittsburgh"));
    assert.ok(!isBrandedMajor(undefined));
  });
});

describe("mergeMajorShows (Eastern two-night combine)", () => {
  test("keeps only majors and merges same-named shows across days", () => {
    const day41 = { shows: [{ eventName: EASTERN, results: [res("friday", "worldClass", 95)] }] };
    const day42 = {
      shows: [
        { eventName: "Music on the Mountain", results: [res("pool", "worldClass", 99)] },
        { eventName: EASTERN, results: [res("saturday", "worldClass", 90)] },
      ],
    };
    const merged = mergeMajorShows([day42, day41]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].eventName, EASTERN);
    assert.deepEqual(
      merged[0].results.map((r) => r.uid).sort(),
      ["friday", "saturday"]
    );
  });

  test("tolerates null recap days", () => {
    assert.deepEqual(mergeMajorShows([null, undefined]), []);
  });
});

describe("fantasyMajorAwards", () => {
  test("one champion per competitive class + SoundSport Best in Show", () => {
    const show = {
      eventName: SW,
      results: [
        res("w2", "worldClass", 85),
        res("w1", "worldClass", 92),
        res("o1", "openClass", 78),
        res("s1", "soundSport", 71),
        res("s2", "soundSport", 60),
        // no aClass corps → no aClass trophy
      ],
    };
    const { regionals, soundSport } = fantasyMajorAwards(show, "S1");
    assert.deepEqual(
      regionals.map((r) => `${r.uid}:${r.trophy.corpsClass}`).sort(),
      ["o1:openClass", "w1:worldClass"]
    );
    assert.equal(regionals.find((r) => r.uid === "w1").trophy.score, 92);
    assert.equal(soundSport.length, 1);
    assert.equal(soundSport[0].uid, "s1");
    assert.equal(soundSport[0].award.type, "regional_best_in_show");
  });
});

describe("podiumMajorChampion", () => {
  test("single overall top podiumClass corps", () => {
    const show = {
      eventName: SW,
      results: [res("a", "podiumClass", 80), res("b", "podiumClass", 91), res("c", "podiumClass", 88)],
    };
    const champ = podiumMajorChampion(show, "S1");
    assert.equal(champ.uid, "b");
    assert.deepEqual(champ.trophy, {
      type: "regional",
      corpsClass: "podiumClass",
      seasonName: "S1",
      eventName: SW,
      score: 91,
      rank: 1,
    });
  });

  test("empty field crowns nobody", () => {
    assert.equal(podiumMajorChampion({ eventName: SW, results: [] }, "S1"), null);
  });
});

describe("reconcileProfileTrophies", () => {
  const correctTrophy = {
    type: "regional",
    corpsClass: "worldClass",
    seasonName: "S1",
    eventName: EASTERN,
    score: 95,
    rank: 1,
  };

  test("removes trophies on non-major shows", () => {
    const stored = {
      regionals: [
        { type: "regional", corpsClass: "worldClass", seasonName: "S1", eventName: "The Buccaneer Classic", score: 90, rank: 1 },
        { type: "regional", corpsClass: "openClass", seasonName: "S1", eventName: "Midwestern Championship", score: 88, rank: 1 },
      ],
    };
    const out = reconcileProfileTrophies(stored, { regionals: [], soundSportAwards: [] });
    assert.ok(out.changed);
    assert.equal(out.regionals.length, 0);
    assert.equal(out.stats.removedRegionals, 2);
  });

  test("adds a missing correct major (e.g. Eastern Classic)", () => {
    const out = reconcileProfileTrophies(
      { regionals: [] },
      { regionals: [correctTrophy], soundSportAwards: [] }
    );
    assert.ok(out.changed);
    assert.deepEqual(out.regionals, [correctTrophy]);
    assert.equal(out.stats.addedRegionals, 1);
  });

  test("keeps a legitimately-won major and does not duplicate it (idempotent)", () => {
    const stored = { regionals: [correctTrophy] };
    const out = reconcileProfileTrophies(stored, { regionals: [correctTrophy], soundSportAwards: [] });
    assert.ok(!out.changed);
    assert.deepEqual(out.regionals, [correctTrophy]);
  });

  test("strips wrong AND adds missing in one pass", () => {
    const stored = {
      regionals: [
        { type: "regional", corpsClass: "worldClass", seasonName: "S1", eventName: "Music on the Mountain", score: 99, rank: 1 },
      ],
    };
    const out = reconcileProfileTrophies(stored, { regionals: [correctTrophy], soundSportAwards: [] });
    assert.ok(out.changed);
    assert.deepEqual(out.regionals, [correctTrophy]);
    assert.equal(out.stats.removedRegionals, 1);
    assert.equal(out.stats.addedRegionals, 1);
  });

  test("prunes only non-major regional Best in Show; leaves festival awards alone", () => {
    const stored = {
      soundSportAwards: [
        { type: "regional_best_in_show", seasonName: "S1", eventName: "The Buccaneer Classic", score: 70 },
        { type: "regional_best_in_show", seasonName: "S1", eventName: SW, score: 72 },
        { type: "international_festival", seasonName: "S1", eventName: "SoundSport Festival", score: 80 },
      ],
    };
    const out = reconcileProfileTrophies(stored, { regionals: [], soundSportAwards: [] });
    assert.ok(out.changed);
    assert.equal(out.stats.removedSoundSport, 1);
    assert.deepEqual(
      out.soundSportAwards.map((t) => t.eventName).sort(),
      [SW, "SoundSport Festival"].sort()
    );
  });

  test("empty profile with no correct awards is a no-op", () => {
    const out = reconcileProfileTrophies({}, { regionals: [], soundSportAwards: [] });
    assert.ok(!out.changed);
    assert.deepEqual(out.regionals, []);
    assert.deepEqual(out.soundSportAwards, []);
  });
});
