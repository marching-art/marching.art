// Unit tests for the pure scoring math in scoring.js.
// Uses Node's built-in test runner (node:test) so no extra dependency is
// needed in the functions codebase. Run with `npm test` inside functions/.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  simpleLinearRegression,
  logarithmicRegression,
  getScoreForDay,
  getRealisticCaptionScore,
} = require("./scoring");

describe("simpleLinearRegression", () => {
  test("fits a perfect line (slope 2, intercept 0)", () => {
    const { m, c } = simpleLinearRegression([
      [0, 0],
      [1, 2],
      [2, 4],
    ]);
    assert.equal(m, 2);
    assert.equal(c, 0);
  });

  test("fits a line with a non-zero intercept", () => {
    const { m, c } = simpleLinearRegression([
      [0, 3],
      [1, 5],
      [2, 7],
    ]);
    assert.equal(m, 2);
    assert.equal(c, 3);
  });

  test("returns a flat line for a horizontal series", () => {
    const { m, c } = simpleLinearRegression([
      [0, 5],
      [1, 5],
      [2, 5],
    ]);
    assert.equal(m, 0);
    assert.equal(c, 5);
  });

  test("falls back to the single point's y with <2 points", () => {
    assert.deepEqual(simpleLinearRegression([[5, 7]]), { m: 0, c: 7 });
  });

  test("returns zeros for empty input", () => {
    assert.deepEqual(simpleLinearRegression([]), { m: 0, c: 0 });
  });
});

describe("logarithmicRegression", () => {
  test("recovers an exponential curve via log-linear fit", () => {
    const data = [
      [1, Math.E],
      [2, Math.E ** 2],
      [3, Math.E ** 3],
    ];
    const reg = logarithmicRegression(data);
    assert.equal(typeof reg.predict, "function");
    // slope 1, intercept 0 in log-space => predict(x) ~= e^x
    assert.ok(Math.abs(reg.predict(1) - Math.E) < 1e-6);
    assert.ok(Math.abs(reg.predict(4) - Math.E ** 4) < 1e-6);
  });
});

describe("getScoreForDay", () => {
  const historicalData = {
    2019: [
      {
        offSeasonDay: 5,
        scores: [
          { corps: "Blue Devils", captions: { GE1: 19.5, GE2: 19.0 } },
          { corps: "Bluecoats", captions: { GE1: 19.2 } },
        ],
      },
      {
        offSeasonDay: 6,
        scores: [{ corps: "Blue Devils", captions: { GE1: 19.7 } }],
      },
    ],
  };

  test("returns the caption score for the matching day and corps", () => {
    assert.equal(getScoreForDay(5, "Blue Devils", 2019, "GE1", historicalData), 19.5);
    assert.equal(getScoreForDay(5, "Blue Devils", 2019, "GE2", historicalData), 19.0);
    assert.equal(getScoreForDay(6, "Blue Devils", 2019, "GE1", historicalData), 19.7);
  });

  test("returns null when the day has no events", () => {
    assert.equal(getScoreForDay(99, "Blue Devils", 2019, "GE1", historicalData), null);
  });

  test("returns null when the corps did not compete", () => {
    assert.equal(getScoreForDay(5, "Phantom Regiment", 2019, "GE1", historicalData), null);
  });

  test("returns null when the year is absent", () => {
    assert.equal(getScoreForDay(5, "Blue Devils", 1999, "GE1", historicalData), null);
  });

  test("treats a zero caption score as missing (returns null)", () => {
    const withZero = {
      2019: [{ offSeasonDay: 1, scores: [{ corps: "X", captions: { GE1: 0 } }] }],
    };
    assert.equal(getScoreForDay(1, "X", 2019, "GE1", withZero), null);
  });
});

describe("getRealisticCaptionScore", () => {
  test("returns the real score verbatim when one exists (deterministic path)", () => {
    const historicalData = {
      2019: [
        { offSeasonDay: 5, scores: [{ corps: "Blue Devils", captions: { GE1: 19.5 } }] },
      ],
    };
    assert.equal(
      getRealisticCaptionScore("Blue Devils", 2019, "GE1", 5, historicalData),
      19.5
    );
  });
});
