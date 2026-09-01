const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  projectPublicProfile,
  publicProjectionEquals,
  CORPS_PRIVATE_KEYS,
} = require("./publicProfileMirror");

const RAW = {
  uid: "u1",
  username: "maestro",
  displayName: "Maestro",
  email: "secret@example.com",
  corpsCoin: 4200,
  xp: 900,
  xpLevel: 4,
  settings: { emailPreferences: { allEmails: false } },
  predictions: { "2026-07-01": { picks: { q1: { pick: "A" } } } },
  challenges: { "2026-07-01": [] },
  moderation: { restricted: true },
  engagement: { loginStreak: 12, lastLogin: "2026-07-01", totalLogins: 99 },
  cosmetics: { owned: ["gold_frame"], equipped: { frame: "gold_frame" } },
  supporter: { tier: "veteran", emailHash: "abc", since: null, anonymous: false, message: "go!" },
  legacy: { total: 500, count: 1, entries: [{ tierId: "t1", amount: 500 }] },
  corps: {
    worldClass: {
      corpsName: "Blue Notes",
      uniform: { name: "Finals Look" },
      showConcept: { theme: "Rebirth" },
      lineup: { GE1: "Blue Devils" },
      lineupKey: "abc",
      selectedShows: { week2: ["DCI Anytown"] },
      weeklyTrades: { used: 1 },
      seasonHistory: [{ seasonName: "2026", totalSeasonScore: 88 }],
    },
    soundSport: null,
  },
};

describe("projectPublicProfile", () => {
  test("keeps the public identity, progression, and corps presentation", () => {
    const pub = projectPublicProfile(RAW);
    assert.equal(pub.username, "maestro");
    assert.equal(pub.xp, 900);
    assert.equal(pub.corps.worldClass.corpsName, "Blue Notes");
    assert.deepEqual(pub.corps.worldClass.showConcept, { theme: "Rebirth" });
    assert.deepEqual(pub.corps.worldClass.seasonHistory, RAW.corps.worldClass.seasonHistory);
    assert.deepEqual(pub.engagement, { loginStreak: 12 });
    assert.deepEqual(pub.cosmetics, { equipped: { frame: "gold_frame" } });
    assert.equal(pub.supporter.tier, "veteran");
    assert.equal(pub.legacy.total, 500);
  });

  test("drops everything private: email, coin, settings, picks, moderation, lineup", () => {
    const pub = projectPublicProfile(RAW);
    for (const key of ["email", "corpsCoin", "settings", "predictions", "challenges", "moderation"]) {
      assert.equal(key in pub, false, `${key} leaked`);
    }
    for (const key of CORPS_PRIVATE_KEYS) {
      assert.equal(key in pub.corps.worldClass, false, `corps.${key} leaked`);
    }
    assert.equal("lastLogin" in pub.engagement, false);
    assert.equal("owned" in pub.cosmetics, false);
    assert.equal("emailHash" in pub.supporter, false);
    assert.equal("soundSport" in pub.corps, false, "null corps entries are dropped");
  });

  test("does not mutate the source and returns null for no source", () => {
    const before = JSON.stringify(RAW);
    projectPublicProfile(RAW);
    assert.equal(JSON.stringify(RAW), before);
    assert.equal(projectPublicProfile(undefined), null);
    assert.equal(projectPublicProfile(null), null);
  });

  test("equality ignores private-only changes so the trigger can skip the write", () => {
    const a = projectPublicProfile(RAW);
    const b = projectPublicProfile({ ...RAW, corpsCoin: 1, predictions: {}, corps: { ...RAW.corps, worldClass: { ...RAW.corps.worldClass, lineup: { GE1: "x" } } } });
    assert.equal(publicProjectionEquals(a, b), true);
    const c = projectPublicProfile({ ...RAW, xp: 901 });
    assert.equal(publicProjectionEquals(a, c), false);
  });
});
