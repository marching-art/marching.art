const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_DIRECTORY_SIZE,
  MIRROR_BATCH_SIZE,
  directoryEntryFromProfile,
  sortDirectoryEntries,
  loadDirectory,
  loadDirectoryCached,
  resetDirectoryCacheForTesting,
} = require("./directorSearch");

const PATHS = {
  users: () => "artifacts/test-ns/users",
  userProfilePublic: (uid) => `artifacts/test-ns/users/${uid}/profile/public`,
};

/**
 * Fake Firestore: a users collection whose listDocuments() returns every
 * location (mirroring the Admin SDK, which includes parent-less docs), and a
 * getAll over profile/public mirrors that counts calls.
 * @param {string[]} uids
 * @param {Map<string, object>} mirrors
 */
function makeFakeDb(uids, mirrors) {
  const calls = { listDocuments: 0, getAll: [] };
  return {
    calls,
    collection(path) {
      assert.equal(path, PATHS.users());
      return {
        async listDocuments() {
          calls.listDocuments += 1;
          return uids.map((id) => ({ id, path: `${path}/${id}` }));
        },
      };
    },
    doc(path) {
      return { path };
    },
    async getAll(...refs) {
      calls.getAll.push(refs.length);
      return refs.map((ref) => {
        const uid = ref.path.split("/users/")[1].split("/")[0];
        const data = mirrors.get(uid);
        return { exists: data !== undefined, data: () => data };
      });
    },
  };
}

describe("directoryEntryFromProfile", () => {
  test("drops missing mirrors and profiles with no username", () => {
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

describe("sortDirectoryEntries", () => {
  test("orders case-insensitively by username, uid as tiebreak, without mutating", () => {
    const input = [
      { username: "bob", uid: "2" },
      { username: "Alice", uid: "9" },
      { username: "alice", uid: "1" },
      { username: "Zed", uid: "0" },
    ];
    const sorted = sortDirectoryEntries(input);
    assert.deepEqual(
      sorted.map((e) => `${e.username}:${e.uid}`),
      ["alice:1", "Alice:9", "bob:2", "Zed:0"]
    );
    assert.equal(input[0].username, "bob");
  });
});

describe("loadDirectory", () => {
  test("enumerates every user location, skips missing mirrors, sorts, and batches getAll", async () => {
    const uids = ["u-zed", "u-alice", "u-ghost", "u-bob"];
    const mirrors = new Map([
      ["u-zed", { username: "Zed" }],
      ["u-alice", { username: "alice", corps: { worldClass: { corpsName: "Blue Horizon", lineup: {} } } }],
      ["u-bob", { username: "Bob" }],
    ]);
    const db = makeFakeDb(uids, mirrors);
    const result = await loadDirectory(db, PATHS);
    assert.deepEqual(
      result.directors.map((d) => d.username),
      ["alice", "Bob", "Zed"]
    );
    assert.equal(result.total, 3);
    assert.equal(result.truncated, false);
    assert.equal("lineup" in result.directors[0].corps[0], false);
    assert.deepEqual(db.calls.getAll, [4]);
  });

  test("splits large directories into getAll batches and flags truncation past the ceiling", async () => {
    const count = MAX_DIRECTORY_SIZE + 5;
    const uids = Array.from({ length: count }, (_, i) => `u${String(i).padStart(5, "0")}`);
    const mirrors = new Map(uids.map((uid) => [uid, { username: uid }]));
    const db = makeFakeDb(uids, mirrors);
    const result = await loadDirectory(db, PATHS);
    assert.equal(result.truncated, true);
    assert.equal(result.total, MAX_DIRECTORY_SIZE);
    assert.equal(db.calls.getAll.length, Math.ceil(MAX_DIRECTORY_SIZE / MIRROR_BATCH_SIZE));
    assert.ok(db.calls.getAll.every((n) => n <= MIRROR_BATCH_SIZE));
  });
});

describe("loadDirectoryCached", () => {
  beforeEach(() => resetDirectoryCacheForTesting());

  test("serves a warm cache without reads and rebuilds after the TTL", async () => {
    const db = makeFakeDb(["u1"], new Map([["u1", { username: "one" }]]));
    let clock = 1000;
    const now = () => clock;

    const first = await loadDirectoryCached(db, PATHS, { now, ttlMs: 500 });
    assert.equal(first.total, 1);
    clock += 100;
    const second = await loadDirectoryCached(db, PATHS, { now, ttlMs: 500 });
    assert.equal(second, first);
    assert.equal(db.calls.listDocuments, 1);

    clock += 1000;
    const third = await loadDirectoryCached(db, PATHS, { now, ttlMs: 500 });
    assert.notEqual(third, first);
    assert.equal(db.calls.listDocuments, 2);
  });

  test("does not cache a failed load", async () => {
    const failing = {
      collection() {
        return {
          async listDocuments() {
            throw new Error("boom");
          },
        };
      },
    };
    await assert.rejects(loadDirectoryCached(failing, PATHS), /boom/);
    const db = makeFakeDb(["u1"], new Map([["u1", { username: "one" }]]));
    const result = await loadDirectoryCached(db, PATHS);
    assert.equal(result.total, 1);
  });
});
