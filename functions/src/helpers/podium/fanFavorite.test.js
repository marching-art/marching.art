// Fan Favorite windows + tallies (decision 30).
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const fanFavorite = require("./fanFavorite");

const cfg = { fanFavorite: { voteWindowDays: 3, finalistsPerMajor: 3, finalsFromDay: 45 } };

describe("Fan Favorite ballot windows (decision 30)", () => {
  test("a prelims window opens the day after the major, when it has a field", () => {
    // The show day itself is NOT open: the day's recap — the only source of
    // candidates — is written by the run that scores that night, so a ballot
    // open on day 28 could only ever reject every vote cast in it.
    assert.equal(fanFavorite.openPrelimsMajor(28, cfg), null);
    assert.equal(fanFavorite.openPrelimsMajor(29, cfg), 28);
    assert.equal(fanFavorite.openPrelimsMajor(30, cfg), 28);
    assert.equal(fanFavorite.openPrelimsMajor(31, cfg), null);
    assert.equal(fanFavorite.openPrelimsMajor(35, cfg), null);
    assert.equal(fanFavorite.openPrelimsMajor(36, cfg), 35);
  });

  test("the Eastern window waits for BOTH nights, so neither gets a head start", () => {
    // The Eastern Classic is one major over two nights (41 and 42) and its
    // candidate list is the union of both. Opening on 41 or 42 would leave the
    // night-2 corps un-votable while the night-1 corps banked votes.
    assert.equal(fanFavorite.openPrelimsMajor(41, cfg), null);
    assert.equal(fanFavorite.openPrelimsMajor(42, cfg), null);
    assert.equal(fanFavorite.openPrelimsMajor(43, cfg), 41);
    assert.equal(fanFavorite.openPrelimsMajor(44, cfg), 41);
    assert.equal(fanFavorite.openPrelimsMajor(45, cfg), null);
  });

  test("every window opens after its major's last night", () => {
    for (const major of fanFavorite.MAJORS) {
      const opens = fanFavorite.prelimsOpensOn(major);
      assert.equal(fanFavorite.openPrelimsMajor(opens, cfg), major);
      assert.notEqual(fanFavorite.openPrelimsMajor(opens - 1, cfg), major);
    }
  });

  test("the closing day is the window's last day — the Eastern counts from night two", () => {
    assert.equal(fanFavorite.prelimsClosesOn(28, cfg), 30);
    assert.equal(fanFavorite.prelimsClosesOn(35, cfg), 37);
    assert.equal(fanFavorite.prelimsClosesOn(41, cfg), 44);
    // Whatever the window, the last open day is exactly the last day it closes.
    for (const major of fanFavorite.MAJORS) {
      const closes = fanFavorite.prelimsClosesOn(major, cfg);
      assert.equal(fanFavorite.openPrelimsMajor(closes, cfg), major);
      assert.notEqual(fanFavorite.openPrelimsMajor(closes + 1, cfg), major);
    }
  });

  test("the finals ballot runs championship week only", () => {
    assert.equal(fanFavorite.finalsOpen(44, cfg), false);
    assert.equal(fanFavorite.finalsOpen(45, cfg), true);
    assert.equal(fanFavorite.finalsOpen(49, cfg), true);
    assert.equal(fanFavorite.finalsOpen(50, cfg), false);
  });
});
