// reportArticle (callable/articleReports.js) against the REAL onCall handler
// via the v2 `.run()` hook with a fake Firestore (config.setDbForTesting).
//
// Covers:
//   - only director-written feed ids (press_* / community_*) are reportable,
//     and a reason is required;
//   - you can't report your own article, or one that's been taken down;
//   - one typed `reports` row per reporter per article, carrying the
//     headline + excerpt snapshot the admin queue shows.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { reportArticle, articleExcerpt } = require("./articleReports");
const { parseDirectorArticleId } = require("../helpers/directorArticles");

const PRESS_ID = "live_2026-27_day_12_press_abc123";
const PRESS_PATH = "news_hub/live_2026-27/days/day_12/articles/press_abc123";
const COMMUNITY_ID = "live_2026-27_day_3_community_sub9";
const COMMUNITY_PATH = "news_hub/live_2026-27/days/day_3/articles/community_sub9";

/** Fake Firestore: doc get/set/update and transactions (for the rate budget). */
function makeFakeDb(docs = new Map()) {
  const writes = [];
  const makeRef = (path) => ({
    path,
    id: path.split("/").pop(),
    async get() {
      const data = docs.get(path);
      return { exists: data !== undefined, data: () => data };
    },
    async set(data) {
      docs.set(path, data);
      writes.push({ type: "set", path, data });
    },
    async update(data) {
      docs.set(path, { ...(docs.get(path) || {}), ...data });
    },
  });
  const db = {
    doc: (path) => makeRef(path),
    collection: (path) => ({ doc: (id) => makeRef(`${path}/${id}`) }),
    async runTransaction(fn) {
      return fn({
        async get(ref) {
          const data = docs.get(ref.path);
          return { exists: data !== undefined, data: () => data };
        },
        set(ref, data) {
          docs.set(ref.path, data);
        },
        update(ref, data) {
          docs.set(ref.path, { ...(docs.get(ref.path) || {}), ...data });
        },
      });
    },
  };
  return { db, writes, docs };
}

const articleDocs = () =>
  new Map([
    [
      PRESS_PATH,
      {
        headline: "Blue Horizon announces new brass arranger",
        summary: "We're thrilled to welcome a new voice to the hornline.",
        authorUid: "author",
        authorUsername: "bluehorizon",
        isPublished: true,
      },
    ],
    [
      COMMUNITY_PATH,
      {
        headline: "Week 3 power rankings",
        narrative: "Long story.",
        authorUid: "author",
        isPublished: false,
        status: "removed",
      },
    ],
  ]);

const req = (uid, data) => ({ data, auth: { uid, token: {} } });

after(() => setDbForTesting(null));

describe("parseDirectorArticleId", () => {
  test("accepts press and community feed ids, rejects generated ones", () => {
    assert.deepEqual(parseDirectorArticleId(PRESS_ID), {
      seasonId: "live_2026-27",
      dayId: "day_12",
      articleType: "press_abc123",
      kind: "press",
      articlePath: PRESS_PATH,
    });
    assert.equal(parseDirectorArticleId(COMMUNITY_ID).kind, "community");
    assert.equal(parseDirectorArticleId("live_2026-27_day_12_dci_recap"), null);
    assert.equal(parseDirectorArticleId("a/b_day_1_press_x"), null);
    assert.equal(parseDirectorArticleId(42), null);
  });
});

describe("articleExcerpt", () => {
  test("joins headline and body, capped", () => {
    assert.equal(articleExcerpt({ headline: "H", summary: "S" }), "H\n\nS");
    const long = articleExcerpt({ headline: "H", narrative: "x".repeat(5000) });
    assert.equal(long.length, 1000);
    assert.ok(long.endsWith("…"));
  });
});

describe("reportArticle", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects non-director ids and missing reasons", async () => {
    const { db } = makeFakeDb(articleDocs());
    setDbForTesting(db);
    await assert.rejects(
      reportArticle.run(req("u1", { articleId: "live_day_1_dci_recap", reason: "bad article" })),
      /director-written/
    );
    await assert.rejects(
      reportArticle.run(req("u1", { articleId: PRESS_ID, reason: "no" })),
      /briefly why/
    );
  });

  test("refuses your own article and a removed one", async () => {
    const { db } = makeFakeDb(articleDocs());
    setDbForTesting(db);
    await assert.rejects(
      reportArticle.run(req("author", { articleId: PRESS_ID, reason: "second thoughts" })),
      /your own article/
    );
    await assert.rejects(
      reportArticle.run(req("u1", { articleId: COMMUNITY_ID, reason: "this is spam" })),
      /no longer published/
    );
  });

  test("writes one typed report per reporter per article", async () => {
    const { db, writes } = makeFakeDb(articleDocs());
    setDbForTesting(db);
    const call = () =>
      reportArticle.run(req("u1", { articleId: PRESS_ID, reason: "  Impersonates another corps  " }));

    const first = await call();
    assert.equal(first.alreadyReported, false);
    assert.match(first.message, /press release/);
    const second = await call();
    assert.equal(second.alreadyReported, true);

    const reports = writes.filter((w) => w.path.startsWith("reports/"));
    assert.equal(reports.length, 1);
    assert.equal(reports[0].path, `reports/article_${PRESS_ID}_u1`);
    const row = reports[0].data;
    assert.equal(row.type, "article");
    assert.equal(row.articleId, PRESS_ID);
    assert.equal(row.articleKind, "press");
    assert.equal(row.commentAuthorUid, "author");
    assert.equal(row.reason, "Impersonates another corps");
    assert.equal(row.status, "new");
    assert.match(row.commentText, /^Blue Horizon announces/);
  });
});
