// Unit tests for the caption mastery tier resolution (WS5.5).
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  MASTERY_CAPTIONS,
  CAPTION_MASTERY_TIERS,
  getCaptionMastery,
} = require("./captionMastery");

describe("caption mastery catalog", () => {
  test("covers all eight lineup captions", () => {
    assert.deepEqual(MASTERY_CAPTIONS, ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"]);
  });

  test("tiers ascend strictly", () => {
    for (let i = 1; i < CAPTION_MASTERY_TIERS.length; i++) {
      assert.ok(CAPTION_MASTERY_TIERS[i].min > CAPTION_MASTERY_TIERS[i - 1].min);
    }
  });
});

describe("getCaptionMastery", () => {
  test("below Bronze: no tier, progress toward Bronze", () => {
    const m = getCaptionMastery(250);
    assert.equal(m.tier, null);
    assert.equal(m.next.id, "bronze");
    assert.equal(m.progress, 0.5); // 250 / 500
  });

  test("exactly at a threshold reaches the tier", () => {
    const m = getCaptionMastery(500);
    assert.equal(m.tier.id, "bronze");
    assert.equal(m.next.id, "silver");
    assert.equal(m.progress, 0); // fresh into the band
  });

  test("mid-band progress is measured from the previous threshold", () => {
    const m = getCaptionMastery(1000); // halfway from 500 to 1500
    assert.equal(m.tier.id, "bronze");
    assert.equal(m.progress, 0.5);
  });

  test("top tier caps out with no next", () => {
    const m = getCaptionMastery(999999);
    assert.equal(m.tier.id, "platinum");
    assert.equal(m.next, null);
    assert.equal(m.progress, 1);
  });

  test("garbage input is treated as zero", () => {
    for (const bad of [undefined, null, NaN, -50, "abc"]) {
      const m = getCaptionMastery(bad);
      assert.equal(m.points, 0);
      assert.equal(m.tier, null);
      assert.equal(m.progress, 0);
    }
  });
});
