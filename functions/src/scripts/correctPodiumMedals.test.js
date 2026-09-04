// The pure half of the medal correction: re-ranking a stored recap within
// division, tallying the corrected medals, and patching an archived season's
// count on a career doc. Firestore traversal is exercised by running the
// script itself (--dry-run).
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  rerankRecap,
  tallyMedals,
  medalsEqual,
  reconcileCareerMedals,
} = require("./correctPodiumMedals");

const cfg = { minFieldSize: 4 };

// A show ranked the OLD way: mixed-field place, medals to the mixed top three.
function mixedFieldShow() {
  return {
    eventName: "Drums on the Ohio",
    location: "Evansville, IN",
    results: [
      { uid: "w1", division: "worldClass", totalScore: 90, place: 1, medal: "gold" },
      { uid: "w2", division: "worldClass", totalScore: 89, place: 2, medal: "silver" },
      { uid: "a1", division: "aClass", totalScore: 88, place: 3, medal: "bronze" },
      { uid: "w3", division: "worldClass", totalScore: 87, place: 4 },
      { uid: "w4", division: "worldClass", totalScore: 86, place: 5 },
      { uid: "a2", division: "aClass", totalScore: 85, place: 6 },
      { uid: "a3", division: "aClass", totalScore: 84, place: 7 },
    ],
  };
}

describe("rerankRecap", () => {
  test("re-stamps place, fieldSize and medal from the division field", () => {
    const recap = { shows: [mixedFieldShow()] };
    const result = rerankRecap(recap, cfg);
    assert.equal(result.changed, true);
    const byUid = Object.fromEntries(recap.shows[0].results.map((r) => [r.uid, r]));
    // The A Class corps that was "3rd with a bronze" is 1/3 — its division's
    // gold, at a seven-corps show.
    assert.deepEqual([byUid.a1.place, byUid.a1.fieldSize, byUid.a1.medal], [1, 3, "gold"]);
    assert.deepEqual([byUid.a3.place, byUid.a3.fieldSize, byUid.a3.medal], [3, 3, "bronze"]);
    // World's third took no medal before; it does in a four-corps division.
    assert.deepEqual([byUid.w3.place, byUid.w3.fieldSize, byUid.w3.medal], [3, 4, "bronze"]);
    assert.deepEqual([byUid.w4.place, byUid.w4.medal], [4, null]);
    // Untouched fields survive.
    assert.equal(recap.shows[0].eventName, "Drums on the Ohio");
    assert.equal(byUid.w1.totalScore, 90);
  });

  test("a legacy flat-results recap is ranked as one show", () => {
    const recap = { results: mixedFieldShow().results };
    const result = rerankRecap(recap, cfg);
    assert.equal(result.changed, true);
    assert.equal(recap.results.find((r) => r.uid === "a1").place, 1);
  });

  test("a recap already ranked per division is left alone", () => {
    const recap = { shows: [mixedFieldShow()] };
    rerankRecap(recap, cfg);
    const after = JSON.stringify(recap);
    const second = rerankRecap(recap, cfg);
    assert.equal(second.changed, false);
    assert.equal(second.rowsChanged, 0);
    assert.equal(JSON.stringify(recap), after);
  });

  test("a show under the minimum field is ranked but never medalled", () => {
    const recap = {
      shows: [
        {
          results: [
            { uid: "o1", division: "openClass", totalScore: 80, place: 1, medal: "gold" },
            { uid: "a1", division: "aClass", totalScore: 70, place: 2, medal: "silver" },
          ],
        },
      ],
    };
    rerankRecap(recap, cfg);
    assert.deepEqual(
      recap.shows[0].results.map((r) => [r.uid, r.place, r.fieldSize, r.medal]),
      [
        ["o1", 1, 1, null],
        ["a1", 1, 1, null],
      ]
    );
  });

  test("an empty or joint-rehearsal-only recap is a no-op", () => {
    assert.equal(rerankRecap({ jointFeed: [] }, cfg).changed, false);
    assert.equal(rerankRecap({ shows: [{ results: [] }] }, cfg).changed, false);
    assert.equal(rerankRecap(null, cfg).changed, false);
  });
});

describe("tallyMedals / medalsEqual", () => {
  test("counts a season's medals per corps and omits the medal-less", () => {
    const rows = [
      { uid: "x", medal: "gold" },
      { uid: "x", medal: "gold" },
      { uid: "x", medal: "bronze" },
      { uid: "y", medal: "silver" },
      { uid: "z", medal: null },
      { uid: "z" },
      { medal: "gold" }, // no uid — never counted
    ];
    assert.deepEqual(tallyMedals(rows), {
      x: { gold: 2, silver: 0, bronze: 1 },
      y: { gold: 0, silver: 1, bronze: 0 },
    });
  });

  test("zero and missing are the same count", () => {
    assert.equal(medalsEqual(undefined, { gold: 0, silver: 0, bronze: 0 }), true);
    assert.equal(medalsEqual({ gold: 1 }, { gold: 1, silver: 0, bronze: 0 }), true);
    assert.equal(medalsEqual({ gold: 1 }, { gold: 0 }), false);
  });
});

describe("reconcileCareerMedals", () => {
  const medals = { gold: 1, silver: 0, bronze: 2 };

  test("patches the matching entry in the career's own history", () => {
    const career = {
      history: [
        { seasonUid: "s1", medals: { gold: 3 } },
        { seasonUid: "s2", medals: { gold: 0 } },
      ],
    };
    const patch = reconcileCareerMedals(career, "s2", medals);
    assert.deepEqual(patch, {
      history: [
        { seasonUid: "s1", medals: { gold: 3 } },
        { seasonUid: "s2", medals },
      ],
    });
    // The input is not mutated.
    assert.deepEqual(career.history[1].medals, { gold: 0 });
  });

  test("patches a retired lineage when the season lives there", () => {
    const career = {
      history: [{ seasonUid: "s3", medals: {} }],
      retiredCareers: [{ name: "old", history: [{ seasonUid: "s1", medals: { silver: 4 } }] }],
    };
    const patch = reconcileCareerMedals(career, "s1", medals);
    assert.deepEqual(patch, {
      retiredCareers: [{ name: "old", history: [{ seasonUid: "s1", medals }] }],
    });
  });

  test("returns null when the count already agrees or the season is not archived", () => {
    const career = { history: [{ seasonUid: "s1", medals: { gold: 1, bronze: 2 } }] };
    assert.equal(reconcileCareerMedals(career, "s1", medals), null);
    assert.equal(reconcileCareerMedals(career, "s9", medals), null);
    assert.equal(reconcileCareerMedals(null, "s1", medals), null);
  });
});
