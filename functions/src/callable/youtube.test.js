// Behavior tests for searchYoutubeVideo's quota protection.
//
// The contract under test: anonymous visitors may be served from the
// Firestore cache (public Landing/Article embeds keep working), but a cache
// miss must NOT spend billed YouTube Data API quota for them — and only
// signed-in users may bypass the cache with skipCache.
//
// Uses the v2 `.run()` hook with a fake Firestore injected via
// config.setDbForTesting. Uses Node's built-in test runner (node:test).
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";
process.env.YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "test-api-key";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { searchYoutubeVideo } = require("./youtube");

/** Fake Firestore exposing only the youtubeCache collection. */
function makeCacheDb(cache = new Map()) {
  const reads = [];
  const writes = [];
  const db = {
    collection(name) {
      return {
        doc(key) {
          return {
            async get() {
              reads.push(`${name}/${key}`);
              const data = cache.get(key);
              return { exists: data !== undefined, data: () => data };
            },
            async set(data) {
              writes.push({ path: `${name}/${key}`, data });
            },
          };
        },
      };
    },
  };
  return { db, reads, writes };
}

after(() => setDbForTesting(null));

describe("searchYoutubeVideo quota protection", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects a missing query regardless of auth", async () => {
    await assert.rejects(
      searchYoutubeVideo.run({ data: {}, auth: null }),
      /Search query is required/
    );
  });

  test("serves anonymous callers from the cache", async () => {
    const cached = { success: true, found: true, videoId: "abc123", title: "2018 Corps" };
    const { db, reads } = makeCacheDb(new Map([["2018_corps", cached]]));
    setDbForTesting(db);

    const result = await searchYoutubeVideo.run({
      data: { query: "2018 Corps" },
      auth: null,
    });

    assert.equal(result.videoId, "abc123");
    assert.deepEqual(reads, ["youtubeCache/2018_corps"]);
  });

  test("anonymous cache miss returns found:false WITHOUT calling the API", async () => {
    const { db, writes } = makeCacheDb(); // empty cache
    setDbForTesting(db);

    // If the handler tried to reach the YouTube API, fetch would fail in this
    // environment and the call would reject — resolving proves it stopped.
    const result = await searchYoutubeVideo.run({
      data: { query: "2018 Nonexistent Corps" },
      auth: null,
    });

    assert.equal(result.success, true);
    assert.equal(result.found, false);
    assert.match(result.message, /Sign in/);
    assert.equal(writes.length, 0, "must not write a cache entry");
  });

  test("anonymous callers cannot bypass the cache with skipCache", async () => {
    const cached = { success: true, found: true, videoId: "cached-id" };
    const { db, reads } = makeCacheDb(new Map([["2019_corps", cached]]));
    setDbForTesting(db);

    // skipCache is ignored for anonymous callers: still served from cache.
    const result = await searchYoutubeVideo.run({
      data: { query: "2019 Corps", skipCache: true },
      auth: null,
    });

    assert.equal(result.videoId, "cached-id");
    assert.equal(reads.length, 1, "cache must still be consulted");
  });

  test("authenticated callers are served cache hits without an API call", async () => {
    const cached = { success: true, found: true, videoId: "hit-id" };
    const { db } = makeCacheDb(new Map([["2020_corps", cached]]));
    setDbForTesting(db);

    const result = await searchYoutubeVideo.run({
      data: { query: "2020 Corps" },
      auth: { uid: "u1", token: {} },
    });

    assert.equal(result.videoId, "hit-id");
  });
});
