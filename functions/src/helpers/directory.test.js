const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_TOKEN_LENGTH,
  MAX_TOKENS,
  words,
  searchTokensFor,
  directoryRowFromProfile,
  directoryDocPath,
} = require("./directory");

describe("words", () => {
  test("lowercases and splits on anything but letters, digits and underscores", () => {
    assert.deepEqual(words("Blue Horizon (2026)"), ["blue", "horizon", "2026"]);
    assert.deepEqual(words("  Drum_Major9 "), ["drum_major9"]);
    assert.deepEqual(words(""), []);
    assert.deepEqual(words(undefined), []);
  });
});

describe("searchTokensFor", () => {
  test("stores every prefix from 2 chars of every word, deduped", () => {
    assert.deepEqual(searchTokensFor(["Bob"]), ["bo", "bob"]);
    assert.deepEqual(searchTokensFor(["Blue Bell", "blue"]), ["bl", "blu", "blue", "be", "bel", "bell"]);
  });

  test("keeps a one-letter initial findable, truncates long words, and caps the array", () => {
    assert.deepEqual(searchTokensFor(["J Smith"]), ["j", "sm", "smi", "smit", "smith"]);
    const long = searchTokensFor(["abcdefghijklmnopqrstuvwxyz"]);
    assert.equal(long[long.length - 1].length, MAX_TOKEN_LENGTH);
    // Forty words with no shared prefix: 11 tokens each, far past the cap.
    const many = searchTokensFor(Array.from({ length: 40 }, (_, i) => `w${i}abcdefghijk`));
    assert.equal(many.length, MAX_TOKENS);
  });
});

describe("directoryRowFromProfile", () => {
  test("drops profiles with no username", () => {
    assert.equal(directoryRowFromProfile("u1", null), null);
    assert.equal(directoryRowFromProfile("u1", { displayName: "Ghost" }), null);
  });

  test("projects the row, corps in display order (Podium included), plus search keys", () => {
    const row = directoryRowFromProfile("u1", {
      username: "MaestroMax",
      displayName: "  Max Power ",
      photoURL: "https://img/x.png",
      xpLevel: 12.7,
      userTitle: "Field Marshal",
      location: "Denver, CO ",
      stats: { seasonsPlayed: 3 },
      corps: {
        podiumClass: { corpsName: "Granite Line" },
        soundSport: { corpsName: "Echo Brass" },
        worldClass: { corpsName: "Blue Horizon", lineup: { GE1: "secret" } },
        aClass: { corpsName: "   " },
      },
      xp: 9001,
      email: "never@leaks.example",
    });
    assert.deepEqual(row.corps, [
      { classKey: "worldClass", corpsName: "Blue Horizon" },
      { classKey: "soundSport", corpsName: "Echo Brass" },
      { classKey: "podiumClass", corpsName: "Granite Line" },
    ]);
    assert.equal(row.displayName, "Max Power");
    assert.equal(row.xpLevel, 12);
    assert.equal(row.location, "Denver, CO");
    assert.equal(row.seasonsPlayed, 3);
    assert.equal(row.usernameKey, "maestromax");
    assert.equal(row.displayNameKey, "max power");
    for (const expected of ["maestromax", "max", "power", "blue", "horizon", "echo", "granite", "line", "gr"]) {
      assert.ok(row.searchTokens.includes(expected), expected);
    }
    assert.equal("email" in row, false);
    assert.equal("xp" in row, false);
    assert.equal(JSON.stringify(row).includes("secret"), false);
  });

  test("falls back to the username as display name and level 1", () => {
    const row = directoryRowFromProfile("u2", { username: "newbie", xpLevel: 0 });
    assert.equal(row.displayName, "newbie");
    assert.equal(row.displayNameKey, "newbie");
    assert.equal(row.xpLevel, 1);
    assert.equal(row.photoURL, null);
    assert.deepEqual(row.corps, []);
  });
});

test("directoryDocPath", () => {
  assert.equal(directoryDocPath("abc"), "directory/abc");
});
