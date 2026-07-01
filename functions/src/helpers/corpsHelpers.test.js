// Tests for the pure corps helpers: name normalization, duplicate-winner
// resolution, and persistent-identity / retired-record builders.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  CLASS_PRIORITY,
  VALID_CLASSES,
  normalizeCorpsName,
  isProfaneCorpsName,
  pickDuplicateWinner,
  PERSISTENT_IDENTITY_FIELDS,
  pickPersistentIdentity,
  buildRetiredRecord,
} = require("./corpsHelpers");

describe("normalizeCorpsName", () => {
  test("lowercases and trims", () => {
    assert.equal(normalizeCorpsName("  Blue Devils  "), "blue devils");
  });
  test("handles null/undefined", () => {
    assert.equal(normalizeCorpsName(null), "");
    assert.equal(normalizeCorpsName(undefined), "");
  });
});

describe("isProfaneCorpsName", () => {
  test("flags profanity case-insensitively", () => {
    assert.equal(isProfaneCorpsName("The DAMN Corps"), true);
  });
  test("passes clean names and empty input", () => {
    assert.equal(isProfaneCorpsName("Blue Devils"), false);
    assert.equal(isProfaneCorpsName(""), false);
    assert.equal(isProfaneCorpsName(null), false);
  });
});

describe("pickDuplicateWinner", () => {
  const ts = (ms) => ({ toMillis: () => ms });

  test("higher class tier wins regardless of age", () => {
    const winner = pickDuplicateWinner([
      { corpsClass: "aClass", createdAt: ts(1) },
      { corpsClass: "worldClass", createdAt: ts(999) },
    ]);
    assert.equal(winner.corpsClass, "worldClass");
  });

  test("same tier: oldest createdAt wins", () => {
    const winner = pickDuplicateWinner([
      { corpsClass: "openClass", createdAt: ts(200), id: "newer" },
      { corpsClass: "openClass", createdAt: ts(100), id: "older" },
    ]);
    assert.equal(winner.id, "older");
  });

  test("same tier and age: reservation holder wins", () => {
    const winner = pickDuplicateWinner([
      { corpsClass: "soundSport", createdAt: ts(100), hasReservation: false, id: "a" },
      { corpsClass: "soundSport", createdAt: ts(100), hasReservation: true, id: "b" },
    ]);
    assert.equal(winner.id, "b");
  });

  test("does not mutate the input group", () => {
    const group = [
      { corpsClass: "aClass", createdAt: ts(1) },
      { corpsClass: "worldClass", createdAt: ts(2) },
    ];
    const copy = [...group];
    pickDuplicateWinner(group);
    assert.deepEqual(group, copy);
  });

  test("CLASS_PRIORITY orders all valid classes", () => {
    for (const cls of VALID_CLASSES) {
      assert.ok(Number.isInteger(CLASS_PRIORITY[cls]), cls);
    }
    assert.ok(CLASS_PRIORITY.worldClass < CLASS_PRIORITY.soundSport);
  });
});

describe("pickPersistentIdentity", () => {
  test("copies only persistent identity fields, omitting undefined", () => {
    const corps = {
      corpsName: "X", // season data — must NOT copy
      uniformDesign: { hat: "shako" },
      avatarUrl: "http://a",
      showConcept: "Space",
      biography: undefined, // undefined — must omit
    };
    const out = pickPersistentIdentity(corps);
    assert.deepEqual(out, {
      uniformDesign: { hat: "shako" },
      avatarUrl: "http://a",
      showConcept: "Space",
    });
    for (const k of Object.keys(out)) assert.ok(PERSISTENT_IDENTITY_FIELDS.includes(k));
  });

  test("returns {} for null input", () => {
    assert.deepEqual(pickPersistentIdentity(null), {});
  });
});

describe("buildRetiredRecord", () => {
  test("computes career aggregates and preserves identity", () => {
    const corps = {
      corpsName: "Blue Stars",
      location: "La Crosse, WI",
      seasonHistory: [
        { totalSeasonScore: 500, showsAttended: 5 },
        { totalSeasonScore: 700, showsAttended: 7 },
      ],
      uniformDesign: { hat: "aussie" },
    };
    const rec = buildRetiredRecord("openClass", corps);
    assert.equal(rec.corpsClass, "openClass");
    assert.equal(rec.corpsName, "Blue Stars");
    assert.equal(rec.totalSeasons, 2);
    assert.equal(rec.bestSeasonScore, 700);
    assert.equal(rec.totalShows, 12);
    assert.deepEqual(rec.uniformDesign, { hat: "aussie" });
    assert.ok(rec.retiredAt); // serverTimestamp sentinel
  });

  test("handles a corps with no season history", () => {
    const rec = buildRetiredRecord("aClass", { corpsName: "New", location: "TBD" });
    assert.equal(rec.totalSeasons, 0);
    assert.equal(rec.bestSeasonScore, 0);
    assert.equal(rec.totalShows, 0);
    assert.deepEqual(rec.seasonHistory, []);
  });
});
