// Resolution rules for the daily prediction game, including the SoundSport
// placement-only variant. SoundSport's numeric scores are deliberately hidden
// behind medal ratings, so its questions must resolve on placement alone —
// SCORE_FREE_QUESTION_IDS is the allowlist submitPrediction enforces.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  PREDICTION_QUESTIONS,
  SCORE_FREE_QUESTION_IDS,
  resolveBucket,
  findRecentPodiumResults,
  deriveQuestionThreshold,
} = require("./dailyPredictions");

describe("SoundSport prediction variant", () => {
  test("score-free allowlist contains exactly the placement-based questions", () => {
    assert.deepEqual(SCORE_FREE_QUESTION_IDS.sort(), ["podium", "ss-improve"]);
    for (const id of SCORE_FREE_QUESTION_IDS) {
      const q = PREDICTION_QUESTIONS.find((entry) => entry.id === id);
      assert.equal(q.needs, "placement", `${id} must not need a numeric score`);
    }
  });

  test("ss-improve resolves on placement improvement against the pick-time snapshot", () => {
    const bucket = {
      snapshotEvent: "Show A",
      picks: { "ss-improve": { pick: "Yes", threshold: 4 } },
    };

    const improved = resolveBucket(bucket, {
      eventName: "Show B",
      score: null, // SoundSport results may omit the numeric score entirely
      placement: 2,
    });
    assert.equal(improved.results["ss-improve"].isCorrect, true);
    assert.equal(improved.correctCount, 1);

    const worse = resolveBucket(
      { ...bucket, picks: { "ss-improve": { pick: "Yes", threshold: 4 } } },
      { eventName: "Show B", score: null, placement: 5 }
    );
    assert.equal(worse.results["ss-improve"].isCorrect, false);
  });

  test("a placement-only result resolves podium without a score", () => {
    const bucket = {
      snapshotEvent: "Show A",
      picks: { podium: { pick: "Yes", threshold: 3 } },
    };
    const resolved = resolveBucket(bucket, {
      eventName: "Show B",
      score: null,
      placement: 3,
    });
    assert.equal(resolved.results.podium.isCorrect, true);
  });

  test("score-based picks stay unresolved when the result has no score", () => {
    const bucket = {
      snapshotEvent: "Show A",
      picks: { "beat-prev": { pick: "Yes", threshold: 70 } },
    };
    const resolved = resolveBucket(bucket, {
      eventName: "Show B",
      score: null,
      placement: 1,
    });
    assert.equal(resolved, null, "no resolvable picks → bucket stays open");
  });
});

describe("Podium Class recent results", () => {
  // Podium recaps live in podium-recaps (keyed by competitionDay), rank each
  // show on its own (result.place), and key results by uid with no corpsClass
  // tag — the fantasy reader finds nothing here, which is what stopped Podium
  // predictions from registering. findRecentPodiumResults normalizes them into
  // the {eventName, score, placement} shape the resolver expects.
  const uid = "director-1";
  const recapDocs = [
    {
      competitionDay: 3,
      shows: [
        {
          eventName: "Finals Night",
          results: [
            { uid: "other", totalScore: 90.0, place: 1 },
            { uid, totalScore: 85.5, place: 2 },
          ],
        },
      ],
    },
    {
      competitionDay: 1,
      shows: [
        {
          eventName: "Opening Show",
          results: [{ uid, totalScore: 82.1, place: 1 }],
        },
      ],
    },
  ];

  test("returns the director's podium rows newest-first, normalized", () => {
    const results = findRecentPodiumResults(recapDocs, uid, 5);
    assert.deepEqual(results, [
      { eventName: "Finals Night", score: 85.5, placement: 2 },
      { eventName: "Opening Show", score: 82.1, placement: 1 },
    ]);
  });

  test("normalized podium results derive real thresholds (not a null reject)", () => {
    const results = findRecentPodiumResults(recapDocs, uid, 5);
    // The bug: fantasy-only reads returned [] for podium, so every threshold
    // came back null and submitPrediction rejected the pick.
    assert.equal(deriveQuestionThreshold("beat-prev", results), 85.5);
    assert.equal(deriveQuestionThreshold("podium", results), 3);
    assert.equal(
      deriveQuestionThreshold("over-under", results),
      Math.round(((85.5 + 82.1) / 2) * 10) / 10
    );
  });

  test("ignores other directors and respects the limit", () => {
    assert.deepEqual(findRecentPodiumResults(recapDocs, "nobody", 5), []);
    assert.equal(findRecentPodiumResults(recapDocs, uid, 1).length, 1);
  });
});
