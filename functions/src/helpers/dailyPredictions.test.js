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
