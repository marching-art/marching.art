const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeDirectorQuery,
  normalizeDirectorCursor,
  directoryEntryFromProfile,
} = require("./directorSearch");

describe("normalizeDirectorQuery", () => {
  test("empty / missing means browse", () => {
    assert.equal(normalizeDirectorQuery(undefined), "");
    assert.equal(normalizeDirectorQuery(null), "");
    assert.equal(normalizeDirectorQuery(""), "");
    assert.equal(normalizeDirectorQuery("   "), "");
    assert.equal(normalizeDirectorQuery("@"), "");
  });

  test("lowercases, trims, and drops a leading @", () => {
    assert.equal(normalizeDirectorQuery("  @MaestroMax "), "maestromax");
    assert.equal(normalizeDirectorQuery("Drum_Major9"), "drum_major9");
  });

  test("rejects non-strings and anything that could never prefix a username", () => {
    assert.throws(() => normalizeDirectorQuery(42), /must be a string/);
    assert.throws(() => normalizeDirectorQuery("a b"), /letters, numbers and underscores/);
    assert.throws(() => normalizeDirectorQuery("a/b"), /letters, numbers and underscores/);
    assert.throws(() => normalizeDirectorQuery("x".repeat(16)), /up to 15/);
  });
});

describe("normalizeDirectorCursor", () => {
  test("absent cursor is the first page", () => {
    assert.equal(normalizeDirectorCursor(undefined), null);
    assert.equal(normalizeDirectorCursor(""), null);
  });

  test("passes a username key through and rejects anything else", () => {
    assert.equal(normalizeDirectorCursor("maestromax"), "maestromax");
    assert.throws(() => normalizeDirectorCursor("Maestro"), /Invalid page cursor/);
    assert.throws(() => normalizeDirectorCursor({}), /Invalid page cursor/);
  });
});

describe("directoryEntryFromProfile", () => {
  test("drops missing mirrors and reservations with no username", () => {
    assert.equal(directoryEntryFromProfile("u1", null), null);
    assert.equal(directoryEntryFromProfile("u1", undefined), null);
    assert.equal(directoryEntryFromProfile("u1", { displayName: "Ghost" }), null);
  });

  test("projects identity, progression and named corps (Podium included) in display order", () => {
    const entry = directoryEntryFromProfile("u1", {
      username: "MaestroMax",
      displayName: "  Max  ",
      photoURL: "https://img/x.png",
      xpLevel: 12.7,
      userTitle: "Field Marshal",
      location: "Denver, CO ",
      stats: { seasonsPlayed: 3, championships: 1 },
      corps: {
        podiumClass: { corpsName: "Granite Line", class: "podiumClass" },
        soundSport: { corpsName: "Echo Brass" },
        worldClass: { corpsName: "Blue Horizon", lineup: { GE1: "x" } },
        aClass: { corpsName: "   " },
      },
      xp: 9001,
      engagement: { loginStreak: 4 },
    });
    assert.deepEqual(entry, {
      uid: "u1",
      username: "MaestroMax",
      displayName: "Max",
      photoURL: "https://img/x.png",
      xpLevel: 12,
      userTitle: "Field Marshal",
      location: "Denver, CO",
      seasonsPlayed: 3,
      corps: [
        { classKey: "worldClass", corpsName: "Blue Horizon" },
        { classKey: "soundSport", corpsName: "Echo Brass" },
        { classKey: "podiumClass", corpsName: "Granite Line" },
      ],
    });
  });

  test("falls back to the username as display name and level 1", () => {
    const entry = directoryEntryFromProfile("u2", { username: "newbie", xpLevel: 0 });
    assert.equal(entry.displayName, "newbie");
    assert.equal(entry.xpLevel, 1);
    assert.equal(entry.photoURL, null);
    assert.deepEqual(entry.corps, []);
    assert.equal(entry.seasonsPlayed, 0);
  });
});
