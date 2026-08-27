// Behavior tests for submitDesignBrief — the weekly styling contest entry
// point. Pins the money paths (token paid exactly once per week) and the
// leaderboard contract (the entry keeps the week's BEST score and describes
// the best-scoring design, never the latest).
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { submitDesignBrief } = require("./designBrief");
const { BRIEF_REWARD, weekIdFor, briefForWeek } = require("../helpers/designBrief");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
const wardrobePath = (uid, id) => `artifacts/${NS}/users/${uid}/wardrobe/${id}`;
const WEEK = weekIdFor(new Date());
const entryPath = (uid) => `artifacts/${NS}/design_briefs/${WEEK}/entries/${uid}`;

const DESIGN = {
  schema: 2,
  name: "Brief Entry",
  colorway: { primary: "#6d1a26", secondary: "#d9a41c", accent: "#ece2cc", metal: "gold" },
  figure: { skin: "#c9a074", jacket: "#6d1a26", hatType: "shako", hat: { body: "#17171a" } },
};

function makeFakeDb(docs = new Map()) {
  const writes = [];
  let autoId = 0;
  const makeDocRef = (path) => ({
    path,
    get id() {
      return path.split("/").pop();
    },
    async get() {
      const data = docs.get(path);
      return { exists: data !== undefined, data: () => data, id: path.split("/").pop() };
    },
    async set(data) {
      writes.push({ type: "set", path, data });
      docs.set(path, data);
    },
    collection(name) {
      return db.collection(`${path}/${name}`);
    },
  });
  const db = {
    doc(path) {
      return makeDocRef(path);
    },
    collection(path) {
      return {
        doc(id) {
          return makeDocRef(`${path}/${id ?? `auto-${++autoId}`}`);
        },
      };
    },
    async runTransaction(fn) {
      const transaction = {
        async get(ref) {
          const data = docs.get(ref.path);
          return { exists: data !== undefined, data: () => data };
        },
        update(ref, data) {
          writes.push({ type: "update", path: ref.path, data });
          docs.set(ref.path, { ...(docs.get(ref.path) || {}), ...data });
        },
        set(ref, data) {
          writes.push({ type: "set", path: ref.path, data });
          docs.set(ref.path, data);
        },
      };
      return fn(transaction);
    },
  };
  return { db, writes, docs };
}

const authedRequest = (uid, data = {}) => ({ data, auth: { uid, token: {} } });

after(() => setDbForTesting(null));

describe("submitDesignBrief", () => {
  beforeEach(() => setDbForTesting(null));

  test("first submission of the week records the entry and pays the token once", async () => {
    const docs = new Map([
      [profilePath("u1"), { username: "MaestroMax", corpsCoin: 100 }],
      [wardrobePath("u1", "d1"), { ...DESIGN }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await submitDesignBrief.run(authedRequest("u1", { designId: "d1" }));
    assert.equal(result.brief.id, briefForWeek(WEEK).id);
    assert.equal(result.paid, true);
    assert.equal(result.score, result.best);
    assert.equal(result.matched.length + result.missed.length, result.brief.wants.length);

    const entry = docs.get(entryPath("u1"));
    assert.equal(entry.score, result.score);
    assert.equal(entry.username, "MaestroMax");
    assert.equal(entry.submissions, 1);
    assert.deepEqual(entry.colors, ["#6d1a26", "#d9a41c", "#ece2cc"]);
    assert.equal(docs.get(profilePath("u1")).corpsCoin, 100 + BRIEF_REWARD);
    const history = writes.find((w) => w.path.includes("corpsCoinHistory"));
    assert.equal(history.data.type, "design_brief");

    // second submission the same week: no second token
    docs.set(wardrobePath("u1", "d2"), { ...DESIGN, name: "Second Try" });
    const again = await submitDesignBrief.run(authedRequest("u1", { designId: "d2" }));
    assert.equal(again.paid, false);
    assert.equal(docs.get(profilePath("u1")).corpsCoin, 100 + BRIEF_REWARD);
    assert.equal(docs.get(entryPath("u1")).submissions, 2);
  });

  test("the entry keeps the week's best score and describes the best design", async () => {
    const docs = new Map([
      [profilePath("u1"), { username: "MaestroMax", corpsCoin: 0 }],
      [wardrobePath("u1", "weak"), { ...DESIGN, name: "Weak Look", figure: { skin: "#c9a074" } }],
      [
        entryPath("u1"),
        {
          score: 90,
          designName: "Strong Look",
          designId: "strong",
          colors: ["#101c33", "#d7dde2", "#2f6fd0"],
          username: "MaestroMax",
          submissions: 1,
          createdAt: "x",
        },
      ],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await submitDesignBrief.run(authedRequest("u1", { designId: "weak" }));
    assert.ok(result.score < 90, "the bare probe should score under the stored best");
    assert.equal(result.best, 90);

    const entry = docs.get(entryPath("u1"));
    assert.equal(entry.score, 90, "a worse run never lowers the week's best");
    assert.equal(entry.designName, "Strong Look", "the entry keeps describing the best design");
    assert.equal(entry.submissions, 2);
  });

  test("rejects a design that is not in the caller's wardrobe", async () => {
    const { db } = makeFakeDb(new Map([[profilePath("u1"), { username: "x" }]]));
    setDbForTesting(db);
    await assert.rejects(
      submitDesignBrief.run(authedRequest("u1", { designId: "ghost" })),
      /not in your wardrobe/
    );
  });
});
