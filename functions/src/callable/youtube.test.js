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
const { searchYoutubeVideo, resetYoutubeVideo } = require("./youtube");

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

/**
 * Multi-collection fake Firestore for the nope-list tests. Docs live in a
 * Map keyed "collection/docId"; deletes are recorded for assertions.
 */
function makeDb(initial = new Map()) {
  const docs = new Map(initial);
  const deletes = [];
  const db = {
    collection(name) {
      return {
        doc(key) {
          const path = `${name}/${key}`;
          return {
            async get() {
              const data = docs.get(path);
              return { exists: data !== undefined, data: () => data };
            },
            async set(data) {
              docs.set(path, data);
            },
            async delete() {
              deletes.push(path);
              docs.delete(path);
            },
          };
        },
      };
    },
  };
  return { db, docs, deletes };
}

/**
 * Stub global fetch with canned YouTube API responses. Returns a restore
 * function; call it in a finally block.
 */
function stubYoutubeApi(searchItems) {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const body = url.includes("/search")
      ? { items: searchItems }
      : {
          // Every candidate gets a valid 10-minute duration.
          items: searchItems.map((item) => ({
            id: item.id.videoId,
            contentDetails: { duration: "PT10M0S" },
          })),
        };
    return { ok: true, json: async () => body };
  };
  return () => { global.fetch = originalFetch; };
}

function searchItem(videoId, title) {
  return {
    id: { videoId },
    snippet: {
      title,
      channelTitle: "Test Channel",
      thumbnails: { high: { url: `https://img/${videoId}.jpg` } },
    },
  };
}

const ADMIN_AUTH = { uid: "admin-1", token: { admin: true } };

describe("resetYoutubeVideo admin gating", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects unauthenticated callers", async () => {
    await assert.rejects(
      resetYoutubeVideo.run({
        data: { query: "2018 Corps", videoId: "abc12345678" },
        auth: null,
      }),
      /logged in/
    );
  });

  test("rejects signed-in callers without the admin claim", async () => {
    await assert.rejects(
      resetYoutubeVideo.run({
        data: { query: "2018 Corps", videoId: "abc12345678" },
        auth: { uid: "u1", token: {} },
      }),
      /admin/
    );
  });

  test("rejects a malformed video ID before touching Firestore", async () => {
    const { db, docs } = makeDb();
    setDbForTesting(db);

    await assert.rejects(
      resetYoutubeVideo.run({
        data: { query: "2018 Corps", videoId: "not a valid id!" },
        auth: ADMIN_AUTH,
      }),
      /valid video ID/
    );
    assert.equal(docs.size, 0, "must not write anything");
  });
});

describe("resetYoutubeVideo nope list", () => {
  beforeEach(() => setDbForTesting(null));

  test("nopes the video, clears the cache, and returns a fresh pick", async () => {
    const { db, docs, deletes } = makeDb(
      new Map([
        ["youtubeCache/2018_corps", { success: true, found: true, videoId: "bad-video-01" }],
      ])
    );
    setDbForTesting(db);

    const restore = stubYoutubeApi([
      searchItem("bad-video-01", "2018 Corps Finals"),
      searchItem("good-video-02", "2018 Corps Finals Performance"),
    ]);
    try {
      const result = await resetYoutubeVideo.run({
        data: { query: "2018 Corps", videoId: "bad-video-01" },
        auth: ADMIN_AUTH,
      });

      // The rejected ID is on the nope list with an audit trail.
      const nopeDoc = docs.get("youtubeNopeList/bad-video-01");
      assert.ok(nopeDoc, "nope-list doc must be written");
      assert.equal(nopeDoc.nopedBy, "admin-1");
      assert.equal(nopeDoc.cacheKey, "2018_corps");

      // The stale cache entry was deleted before re-searching.
      assert.ok(deletes.includes("youtubeCache/2018_corps"));

      // The fresh search skipped the noped ID and cached the replacement.
      assert.equal(result.found, true);
      assert.equal(result.videoId, "good-video-02");
      assert.equal(docs.get("youtubeCache/2018_corps")?.videoId, "good-video-02");
    } finally {
      restore();
    }
  });

  test("returns found:false when every result is noped", async () => {
    const { db } = makeDb(
      new Map([["youtubeNopeList/only-video-1", { videoId: "only-video-1" }]])
    );
    setDbForTesting(db);

    const restore = stubYoutubeApi([
      searchItem("only-video-1", "2018 Corps Finals"),
    ]);
    try {
      const result = await resetYoutubeVideo.run({
        data: { query: "2018 Corps", videoId: "only-video-1" },
        auth: ADMIN_AUTH,
      });
      assert.equal(result.success, true);
      assert.equal(result.found, false);
    } finally {
      restore();
    }
  });

  test("a user over the hourly search budget is throttled before the API call", async () => {
    const { db } = makeDb(
      new Map([
        [
          "youtubeSearchQuota/u1",
          { windowStart: Date.now(), count: 30 }, // budget spent this hour
        ],
      ])
    );
    setDbForTesting(db);

    // No fetch stub: if the handler reached the YouTube API the call would
    // reject with a fetch error instead of the throttle message.
    await assert.rejects(
      searchYoutubeVideo.run({
        data: { query: "2018 Corps", skipCache: true },
        auth: { uid: "u1", token: {} },
      }),
      /searched for a lot of videos/
    );
  });

  test("a stale budget window resets instead of throttling", async () => {
    const { db, docs } = makeDb(
      new Map([
        [
          "youtubeSearchQuota/u1",
          { windowStart: Date.now() - 2 * 60 * 60 * 1000, count: 30 }, // old window
        ],
      ])
    );
    setDbForTesting(db);

    const restore = stubYoutubeApi([searchItem("fresh-video-01", "2018 Corps Finals")]);
    try {
      const result = await searchYoutubeVideo.run({
        data: { query: "2018 Corps" },
        auth: { uid: "u1", token: {} },
      });
      assert.equal(result.videoId, "fresh-video-01");
      assert.equal(docs.get("youtubeSearchQuota/u1").count, 1, "window restarts at 1");
    } finally {
      restore();
    }
  });

  test("searchYoutubeVideo also excludes noped videos on a fresh search", async () => {
    const { db } = makeDb(
      new Map([["youtubeNopeList/bad-video-01", { videoId: "bad-video-01" }]])
    );
    setDbForTesting(db);

    const restore = stubYoutubeApi([
      searchItem("bad-video-01", "2018 Corps Finals"),
      searchItem("good-video-02", "2018 Corps Semifinals"),
    ]);
    try {
      const result = await searchYoutubeVideo.run({
        data: { query: "2018 Corps" },
        auth: { uid: "u1", token: {} },
      });
      assert.equal(result.videoId, "good-video-02");
    } finally {
      restore();
    }
  });
});
