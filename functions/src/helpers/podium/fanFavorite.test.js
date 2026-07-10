// Fan Favorite windows + tallies (decision 30).
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const fanFavorite = require("./fanFavorite");

const cfg = { fanFavorite: { voteWindowDays: 3, finalistsPerMajor: 3, finalsFromDay: 45 } };

describe("Fan Favorite ballot windows (decision 30)", () => {
  test("each major opens a prelims window; the Eastern window covers both nights", () => {
    assert.equal(fanFavorite.openPrelimsMajor(27, cfg), null);
    assert.equal(fanFavorite.openPrelimsMajor(28, cfg), 28);
    assert.equal(fanFavorite.openPrelimsMajor(30, cfg), 28);
    assert.equal(fanFavorite.openPrelimsMajor(31, cfg), null);
    assert.equal(fanFavorite.openPrelimsMajor(35, cfg), 35);
    assert.equal(fanFavorite.openPrelimsMajor(41, cfg), 41);
    assert.equal(fanFavorite.openPrelimsMajor(42, cfg), 41);
    assert.equal(fanFavorite.openPrelimsMajor(44, cfg), 41);
    assert.equal(fanFavorite.openPrelimsMajor(45, cfg), null);
  });

  test("the finals ballot runs championship week only", () => {
    assert.equal(fanFavorite.finalsOpen(44, cfg), false);
    assert.equal(fanFavorite.finalsOpen(45, cfg), true);
    assert.equal(fanFavorite.finalsOpen(49, cfg), true);
    assert.equal(fanFavorite.finalsOpen(50, cfg), false);
  });
});
