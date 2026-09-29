// Behavior tests for the admin Reports queue (callable/reportsModeration.js):
// listReports normalizes both report collections into one queue, and
// resolveReport triages, dismisses, or removes the reported content (resolving
// sibling reports). Exercises the real onCall handlers via `.run()` with an
// in-memory Firestore injected through config.setDbForTesting.
// node:test; run with `npm test` inside functions/.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const {
  listReports,
  resolveReport,
  resolveReportsForContent,
  countNewReports,
} = require("./reportsModeration");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
const commentPath = (uid, id) => `artifacts/${NS}/users/${uid}/comments/${id}`;
const chatPath = (leagueId, id) => `artifacts/${NS}/leagues/${leagueId}/chat/${id}`;

/**
 * Minimal in-memory Firestore: flat path → data map, collection queries with
 * equality `where`, `orderBy`, `limit`, `count()`, `getAll`, `batch`.
 */
function makeFakeDb(seed = {}) {
  const docs = new Map(Object.entries(seed));

  const snapOf = (path) => {
    const data = docs.get(path);
    return {
      id: path.split("/").pop(),
      exists: data !== undefined,
      data: () => (data === undefined ? undefined : { ...data }),
      ref: refOf(path),
    };
  };

  function refOf(path) {
    return {
      path,
      id: path.split("/").pop(),
      async get() {
        return snapOf(path);
      },
      async update(patch) {
        if (!docs.has(path)) throw new Error(`no doc ${path}`);
        docs.set(path, { ...docs.get(path), ...patch });
      },
      async set(data) {
        docs.set(path, { ...data });
      },
      async delete() {
        docs.delete(path);
      },
    };
  }

  function query(collectionPath, filters = [], order = null, max = Infinity) {
    const run = () => {
      let rows = [...docs.keys()]
        .filter((p) => p.startsWith(`${collectionPath}/`) && !p.slice(collectionPath.length + 1).includes("/"))
        .map(snapOf)
        .filter((s) => filters.every(([f, v]) => s.data()[f] === v));
      if (order) {
        rows.sort((a, b) => {
          const av = a.data()[order.field];
          const bv = b.data()[order.field];
          const cmp = (av?.getTime?.() ?? av ?? 0) - (bv?.getTime?.() ?? bv ?? 0);
          return order.dir === "desc" ? -cmp : cmp;
        });
      }
      return rows.slice(0, max);
    };
    return {
      where: (field, op, value) => {
        assert.equal(op, "==");
        return query(collectionPath, [...filters, [field, value]], order, max);
      },
      orderBy: (field, dir = "asc") => query(collectionPath, filters, { field, dir }, max),
      limit: (n) => query(collectionPath, filters, order, n),
      async get() {
        const rows = run();
        return { docs: rows, empty: rows.length === 0, size: rows.length };
      },
      count: () => ({
        async get() {
          return { data: () => ({ count: run().length }) };
        },
      }),
      doc: (id) => refOf(`${collectionPath}/${id ?? `auto${docs.size + 1}`}`),
    };
  }

  const db = {
    _docs: docs,
    doc: (path) => refOf(path),
    collection: (path) => query(path),
    async getAll(...refs) {
      return refs.map((r) => snapOf(r.path));
    },
    batch() {
      const ops = [];
      return {
        update(ref, patch) {
          ops.push(() => ref.update(patch));
        },
        async commit() {
          for (const op of ops) await op();
        },
      };
    },
  };
  return db;
}

const adminReq = (data) => ({ data, auth: { uid: "admin1", token: { admin: true } } });
const userReq = (data) => ({ data, auth: { uid: "u1", token: {} } });

const t = (iso) => new Date(iso);

function seed() {
  return {
    [profilePath("author")]: { username: "loudhorn" },
    [profilePath("reporter")]: { displayName: "Quiet Snare" },
    [profilePath("owner")]: { username: "profileowner" },
    [commentPath("owner", "c1")]: { text: "rude" },
    [chatPath("L1", "m1")]: { message: "spam", userId: "author" },
    "article_comments/ac1": { content: "off-topic", userId: "author", status: "approved" },
    "reports/r1": {
      type: "comment",
      commentId: "c1",
      commentText: "rude",
      commentAuthorUid: "author",
      reportedOnProfileUid: "owner",
      reporterUid: "reporter",
      status: "new",
      createdAt: t("2026-09-20T10:00:00Z"),
    },
    "reports/leaguechat_m1_reporter": {
      type: "league_message",
      leagueId: "L1",
      leagueName: "Drum Line",
      messageId: "m1",
      commentText: "spam",
      commentAuthorUid: "author",
      reporterUid: "reporter",
      reason: "spam links",
      status: "new",
      createdAt: t("2026-09-22T10:00:00Z"),
    },
    "reports/leaguechat_m1_other": {
      type: "league_message",
      leagueId: "L1",
      messageId: "m1",
      commentText: "spam",
      commentAuthorUid: "author",
      reporterUid: "other",
      reason: "also spam",
      status: "new",
      createdAt: t("2026-09-22T11:00:00Z"),
    },
    "reports/old": {
      type: "comment",
      commentId: "gone",
      commentText: "old",
      commentAuthorUid: "author",
      reportedOnProfileUid: "owner",
      reporterUid: "reporter",
      status: "resolved",
      createdAt: t("2026-09-01T10:00:00Z"),
    },
    "article_comments_reports/a1": {
      commentId: "ac1",
      articleId: "day5_recap",
      commentAuthorId: "author",
      reporterId: "reporter",
      reason: "off topic",
      status: "pending",
      createdAt: t("2026-09-21T10:00:00Z"),
    },
  };
}

after(() => setDbForTesting(null));

describe("listReports", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects a non-admin", async () => {
    setDbForTesting(makeFakeDb(seed()));
    await assert.rejects(listReports.run(userReq({})), /admin/i);
  });

  test("rejects an unknown status or type", async () => {
    setDbForTesting(makeFakeDb(seed()));
    await assert.rejects(listReports.run(adminReq({ status: "open" })), /Status/);
    await assert.rejects(listReports.run(adminReq({ type: "dm" })), /Type/);
  });

  test("merges both collections newest first, with names, text and liveness", async () => {
    setDbForTesting(makeFakeDb(seed()));
    const res = await listReports.run(adminReq({ status: "new" }));
    assert.equal(res.success, true);
    assert.deepEqual(
      res.reports.map((r) => r.id),
      ["leaguechat_m1_other", "leaguechat_m1_reporter", "a1", "r1"]
    );
    const article = res.reports.find((r) => r.id === "a1");
    assert.equal(article.type, "article_comment");
    assert.equal(article.status, "new"); // "pending" is normalized
    assert.equal(article.text, "off-topic");
    assert.equal(article.contentLive, true);
    assert.equal(article.context.articleId, "day5_recap");

    const league = res.reports.find((r) => r.id === "leaguechat_m1_reporter");
    assert.equal(league.authorName, "loudhorn");
    assert.equal(league.reporterName, "Quiet Snare");
    assert.equal(league.context.leagueName, "Drum Line");
    assert.equal(league.contentLive, true);

    const profile = res.reports.find((r) => r.id === "r1");
    assert.equal(profile.context.profileName, "profileowner");
    assert.deepEqual(res.counts, { new: 4, reviewed: 0, resolved: 1 });
  });

  test("filters by type and reports removed content as not live", async () => {
    setDbForTesting(makeFakeDb(seed()));
    const res = await listReports.run(adminReq({ status: "resolved", type: "comment" }));
    assert.deepEqual(res.reports.map((r) => r.id), ["old"]);
    assert.equal(res.reports[0].contentLive, false);

    const articleOnly = await listReports.run(adminReq({ status: "new", type: "article_comment" }));
    assert.deepEqual(articleOnly.reports.map((r) => r.id), ["a1"]);
  });
});

describe("resolveReport", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects a non-admin and bad input", async () => {
    setDbForTesting(makeFakeDb(seed()));
    await assert.rejects(
      resolveReport.run(userReq({ reportId: "r1", source: "reports", status: "resolved" })),
      /admin/i
    );
    await assert.rejects(
      resolveReport.run(adminReq({ reportId: "r1", source: "users", status: "resolved" })),
      /source/i
    );
    await assert.rejects(
      resolveReport.run(adminReq({ reportId: "r1", source: "reports", status: "done" })),
      /Status/
    );
    await assert.rejects(
      resolveReport.run(adminReq({ reportId: "nope", source: "reports", status: "reviewed" })),
      /no longer exists/
    );
  });

  test("dismissing records no_action and leaves the content alone", async () => {
    const db = makeFakeDb(seed());
    setDbForTesting(db);
    const res = await resolveReport.run(
      adminReq({ reportId: "r1", source: "reports", status: "resolved", note: "  fine  " })
    );
    assert.equal(res.resolution, "no_action");
    const row = db._docs.get("reports/r1");
    assert.equal(row.status, "resolved");
    assert.equal(row.resolution, "no_action");
    assert.equal(row.adminNote, "fine");
    assert.equal(row.resolvedBy, "admin1");
    assert.ok(db._docs.has(commentPath("owner", "c1")));
  });

  test("marking reviewed clears the resolution; article reports keep their vocabulary", async () => {
    const db = makeFakeDb(seed());
    setDbForTesting(db);
    await resolveReport.run(
      adminReq({ reportId: "a1", source: "article_comments_reports", status: "reviewed" })
    );
    assert.equal(db._docs.get("article_comments_reports/a1").status, "reviewed");
    await resolveReport.run(
      adminReq({ reportId: "a1", source: "article_comments_reports", status: "new" })
    );
    assert.equal(db._docs.get("article_comments_reports/a1").status, "pending");
    assert.equal(db._docs.get("article_comments_reports/a1").resolution, null);
  });

  test("removing a league message deletes it, logs activity and resolves siblings", async () => {
    const db = makeFakeDb(seed());
    setDbForTesting(db);
    const res = await resolveReport.run(
      adminReq({
        reportId: "leaguechat_m1_reporter",
        source: "reports",
        status: "reviewed", // ignored: removal always resolves
        removeContent: true,
      })
    );
    assert.equal(res.status, "resolved");
    assert.equal(res.resolution, "content_removed");
    assert.equal(res.contentRemoved, true);
    assert.equal(res.siblingsResolved, 1);
    assert.equal(db._docs.has(chatPath("L1", "m1")), false);
    assert.equal(db._docs.get("reports/leaguechat_m1_other").status, "resolved");
    assert.equal(db._docs.get("reports/leaguechat_m1_other").resolution, "content_removed");
    const activity = [...db._docs.entries()].find(([p]) => p.includes("/leagues/L1/activity/"));
    assert.ok(activity, "a league activity row is written");
    assert.match(activity[1].message, /moderator/);
  });

  test("removing a profile comment deletes it", async () => {
    const db = makeFakeDb(seed());
    setDbForTesting(db);
    const res = await resolveReport.run(
      adminReq({ reportId: "r1", source: "reports", removeContent: true })
    );
    assert.equal(res.contentRemoved, true);
    assert.equal(db._docs.has(commentPath("owner", "c1")), false);
  });

  test("removing an article comment hides it instead of deleting", async () => {
    const db = makeFakeDb(seed());
    setDbForTesting(db);
    await resolveReport.run(
      adminReq({ reportId: "a1", source: "article_comments_reports", removeContent: true })
    );
    const comment = db._docs.get("article_comments/ac1");
    assert.equal(comment.status, "hidden");
    assert.equal(comment.moderatedBy, "admin1");
    assert.equal(db._docs.get("article_comments_reports/a1").status, "resolved");
  });

  test("removal of already-deleted content still resolves the report", async () => {
    const db = makeFakeDb(seed());
    db._docs.delete(commentPath("owner", "c1"));
    setDbForTesting(db);
    const res = await resolveReport.run(
      adminReq({ reportId: "r1", source: "reports", removeContent: true })
    );
    assert.equal(res.contentRemoved, false);
    assert.equal(db._docs.get("reports/r1").status, "resolved");
  });
});

describe("helpers", () => {
  test("resolveReportsForContent only touches open reports of the same type", async () => {
    const db = makeFakeDb(seed());
    const n = await resolveReportsForContent(db, {
      type: "article_comment",
      contentId: "ac1",
      adminUid: "admin1",
      resolution: "no_action",
    });
    assert.equal(n, 1);
    assert.equal(db._docs.get("article_comments_reports/a1").status, "resolved");
    assert.equal(
      await resolveReportsForContent(db, {
        type: "article_comment",
        contentId: "ac1",
        adminUid: "admin1",
        resolution: "no_action",
      }),
      0
    );
  });

  test("countNewReports sums both collections", async () => {
    assert.equal(await countNewReports(makeFakeDb(seed())), 4);
  });
});
