// Week-scoped league scoring: the fix for matchups that were decided by each
// corps' MOST RECENT show score rather than by the week they were supposed to
// be about.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  weekDayRange,
  buildWeeklyScoreIndex,
  getWeekScore,
  participatingClassesByUid,
} = require("./leagueScoring");

const day = (results) => ({ exists: true, data: () => ({ shows: [{ results }] }) });
const missingDay = { exists: false, data: () => undefined };

describe("weekDayRange", () => {
  test("maps weeks onto the scorer's 7-day boundary", () => {
    assert.deepEqual(weekDayRange(1), { firstDay: 1, lastDay: 7 });
    assert.deepEqual(weekDayRange(3), { firstDay: 15, lastDay: 21 });
    // Championship week ends on Finals (day 49).
    assert.deepEqual(weekDayRange(7), { firstDay: 43, lastDay: 49 });
  });
});

describe("buildWeeklyScoreIndex", () => {
  test("sums every show a corps attended during the week", () => {
    const { index, daysFound } = buildWeeklyScoreIndex([
      day([{ uid: "alice", corpsClass: "worldClass", totalScore: 80 }]),
      day([{ uid: "alice", corpsClass: "worldClass", totalScore: 82.5 }]),
    ]);

    assert.equal(daysFound, 2);
    // Competing twice counts twice. The old "latest show" comparison threw the
    // first performance away entirely.
    assert.deepEqual(getWeekScore(index, "alice", "worldClass"), {
      uid: "alice",
      corpsClass: "worldClass",
      score: 162.5,
      shows: 2,
    });
  });

  test("keeps a director's classes separate", () => {
    const { index } = buildWeeklyScoreIndex([
      day([
        { uid: "alice", corpsClass: "worldClass", totalScore: 90 },
        { uid: "alice", corpsClass: "soundSport", totalScore: 60 },
      ]),
    ]);

    assert.equal(getWeekScore(index, "alice", "worldClass").score, 90);
    assert.equal(getWeekScore(index, "alice", "soundSport").score, 60);
  });

  test("a corps that did not compete scores zero with zero shows", () => {
    const { index } = buildWeeklyScoreIndex([
      day([{ uid: "alice", corpsClass: "worldClass", totalScore: 90 }]),
    ]);

    // This is the whole point: sitting the week out is a forfeited week, not a
    // stale score carried forward from whenever the corps last performed.
    assert.deepEqual(getWeekScore(index, "absent", "worldClass"), { score: 0, shows: 0 });
  });

  test("daysFound distinguishes an unscored week from an empty one", () => {
    assert.equal(buildWeeklyScoreIndex([missingDay, missingDay]).daysFound, 0);
    assert.equal(buildWeeklyScoreIndex([day([])]).daysFound, 1);
  });

  test("ignores malformed results instead of throwing", () => {
    const { index } = buildWeeklyScoreIndex([
      day([
        null,
        { corpsClass: "worldClass", totalScore: 90 }, // no uid
        { uid: "bob", totalScore: 90 }, // no class
        { uid: "bob", corpsClass: "worldClass" }, // no score
      ]),
    ]);

    assert.deepEqual(getWeekScore(index, "bob", "worldClass"), {
      uid: "bob",
      corpsClass: "worldClass",
      score: 0,
      shows: 1,
    });
  });
});

describe("participatingClassesByUid", () => {
  test("reports the distinct classes each director competed in", () => {
    const { index } = buildWeeklyScoreIndex([
      day([
        { uid: "alice", corpsClass: "worldClass", totalScore: 90 },
        { uid: "alice", corpsClass: "aClass", totalScore: 70 },
        { uid: "bob", corpsClass: "worldClass", totalScore: 88 },
      ]),
    ]);

    const byUid = participatingClassesByUid(index);
    assert.deepEqual([...byUid.get("alice")].sort(), ["aClass", "worldClass"]);
    assert.deepEqual([...byUid.get("bob")], ["worldClass"]);
    assert.equal(byUid.has("absent"), false);
  });
});
