// Regression test for the /api/news HTTP handler's cache path. A cache HIT
// once fell through into the cache-miss branch (missing `return`), so every
// hit still ran the collectionGroup query and then threw
// ERR_HTTP_HEADERS_SENT. This pins: a HIT responds once and touches nothing
// but the cache doc. node:test; run with `npm test` inside functions/.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { getNewsFeedHttp } = require("./newsFeed");

after(() => setDbForTesting(null));

function makeRes() {
  const res = {
    headers: {},
    statusCode: 200,
    body: undefined,
    jsonCalls: 0,
    // Minimal EventEmitter/Node-response surface the onRequest cors wrapper
    // and the cors middleware touch.
    on() {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    getHeader(key) {
      return this.headers[key];
    },
    set(key, value) {
      if (this.body !== undefined) throw new Error("ERR_HTTP_HEADERS_SENT");
      this.headers[key] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonCalls += 1;
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("getNewsFeedHttp cache HIT", () => {
  test("responds once from the cache and never runs the article query", async () => {
    let collectionGroupCalls = 0;
    let cacheWrites = 0;
    const db = {
      collection(name) {
        assert.equal(name, "news_feed_cache");
        return {
          doc() {
            return {
              async get() {
                return {
                  exists: true,
                  data: () => ({
                    timestamp: Date.now() - 1000,
                    news: [{ id: "a1", headline: "Cached" }],
                    hasMore: false,
                    engagement: null,
                  }),
                };
              },
              async set() {
                cacheWrites += 1;
              },
            };
          },
        };
      },
      collectionGroup() {
        collectionGroupCalls += 1;
        throw new Error("cache HIT must not query articles");
      },
    };
    setDbForTesting(db);

    const res = makeRes();
    await getNewsFeedHttp({ query: {}, method: "GET", headers: {} }, res);

    assert.equal(res.jsonCalls, 1);
    assert.equal(res.body.fromCache, true);
    assert.deepEqual(res.body.news, [{ id: "a1", headline: "Cached" }]);
    assert.equal(res.headers["X-Cache-Status"], "HIT");
    assert.equal(collectionGroupCalls, 0);
    assert.equal(cacheWrites, 0);
  });
});
