// The Rookie Circuit gate.
//
// joinRookieLeague had no gate at all: any director could call it regardless of
// level or tenure, so a veteran could drop into a league of new directors — the
// one place in the game explicitly reserved for people finding their feet.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { isRookieDirector, ROOKIE_MAX_LEVEL, ROOKIE_MAX_SEASONS } = require("./rookieLeague");

describe("isRookieDirector", () => {
  test("a brand-new profile is a rookie", () => {
    assert.equal(isRookieDirector({ xpLevel: 1, stats: { seasonsPlayed: 0 } }), true);
  });

  // The bar is deliberately an OR, and deliberately generous: bouncing a new
  // director out of the beginner league leaves them nowhere to go.
  test("a low-level director is a rookie however many seasons they have logged", () => {
    assert.equal(
      isRookieDirector({ xpLevel: ROOKIE_MAX_LEVEL, stats: { seasonsPlayed: 6 } }),
      true
    );
  });

  test("a first-season director is a rookie however high their level", () => {
    assert.equal(
      isRookieDirector({ xpLevel: 40, stats: { seasonsPlayed: ROOKIE_MAX_SEASONS } }),
      true
    );
  });

  test("a veteran past both bars is not", () => {
    assert.equal(
      isRookieDirector({ xpLevel: ROOKIE_MAX_LEVEL + 1, stats: { seasonsPlayed: 3 } }),
      false
    );
  });

  test("reads seasonsPlayed from either the stats block or the profile root", () => {
    assert.equal(isRookieDirector({ xpLevel: 25, seasonsPlayed: 4 }), false);
    assert.equal(isRookieDirector({ xpLevel: 25, stats: { seasonsPlayed: 4 } }), false);
  });

  // Fail open. A profile we cannot read must not lock a genuine new director
  // out of the only league built for them.
  test("treats a missing or unreadable profile as a rookie", () => {
    assert.equal(isRookieDirector(null), true);
    assert.equal(isRookieDirector({}), true);
    assert.equal(isRookieDirector({ xpLevel: "??" }), true);
  });
});
