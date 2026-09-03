process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { applyUnsubscribe, renderUnsubscribePage } = require("./unsubscribe");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;

function makeFakeDb(docs = new Map()) {
  const writes = [];
  return {
    writes,
    doc: (path) => ({
      path,
      async get() {
        return { exists: docs.has(path), data: () => docs.get(path) };
      },
      async set(data, options) {
        writes.push({ path, data, options });
      },
    }),
  };
}

describe("applyUnsubscribe", () => {
  test("flips allEmails off with a merge, leaving other preferences alone", async () => {
    const db = makeFakeDb(new Map([[profilePath("alice"), { settings: { emailPreferences: { weeklyDigest: true } } }]]));
    assert.equal(await applyUnsubscribe(db, "alice"), true);
    assert.equal(db.writes.length, 1);
    assert.equal(db.writes[0].path, profilePath("alice"));
    assert.deepEqual(db.writes[0].options, { merge: true });
    const prefs = db.writes[0].data.settings.emailPreferences;
    assert.equal(prefs.allEmails, false);
    assert.equal(prefs.unsubscribedVia, "one_click");
    assert.equal("weeklyDigest" in prefs, false, "merge, not replace");
  });

  test("a missing profile writes nothing and reports false", async () => {
    const db = makeFakeDb();
    assert.equal(await applyUnsubscribe(db, "ghost"), false);
    assert.equal(db.writes.length, 0);
  });
});

describe("renderUnsubscribePage", () => {
  test("both states are noindex pages that link to the signed-in preferences", () => {
    for (const state of ["done", "invalid"]) {
      const html = renderUnsubscribePage(state);
      assert.match(html, /noindex/);
      assert.match(html, /profile\?settings=emails/);
    }
    assert.match(renderUnsubscribePage("done"), /You're unsubscribed/);
    assert.match(renderUnsubscribePage("invalid"), /didn't work/);
  });
});
