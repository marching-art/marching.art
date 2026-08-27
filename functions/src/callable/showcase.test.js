// Behavior tests for the Showcase callables. Pins the money paths (entry
// token once per month, vote tokens capped), the phase gates, and the
// anonymity + served-pair contract: a dealt pair carries no names, and a
// vote counts only against the exact pair the server dealt.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const {
  submitShowcaseEntry,
  getShowcasePair,
  castShowcaseVote,
} = require("./showcase");
const {
  SHOWCASE_ENTRY_REWARD,
  SHOWCASE_VOTE_REWARD,
  SHOWCASE_PAID_VOTES,
  setShowcaseNowForTesting,
} = require("../helpers/showcase");

const NS = process.env.DATA_NAMESPACE;
// Pin the cycle clock per suite (setShowcaseNowForTesting) so both phases
// always run, whatever the real date is.
const MONTH = "2026-09";
const SUBMISSION_TIME = new Date("2026-09-05T12:00:00Z");
const VOTING_TIME = new Date("2026-09-25T12:00:00Z");
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
const wardrobePath = (uid, id) => `artifacts/${NS}/users/${uid}/wardrobe/${id}`;
const entryPath = (uid) => `artifacts/${NS}/showcases/${MONTH}/entries/${uid}`;
const votePath = (uid) => `artifacts/${NS}/showcases/${MONTH}/votes/${uid}`;

const DESIGN = {
  schema: 2,
  name: "Showcase Look",
  colorway: { primary: "#6d1a26", secondary: "#d9a41c", accent: "#ece2cc", metal: "gold" },
  figure: { skin: "#c9a074", jacket: "#6d1a26" },
  aiHints: { additionalNotes: "private" },
};

function makeFakeDb(docs = new Map()) {
  const writes = [];
  let autoId = 0;
  const childIds = (prefix) =>
    [...docs.keys()]
      .filter((k) => k.startsWith(`${prefix}/`) && !k.slice(prefix.length + 1).includes("/"))
      .map((k) => k.slice(prefix.length + 1));
  const makeDocRef = (path) => ({
    path,
    id: path.split("/").pop(),
    async get() {
      return { exists: docs.has(path), data: () => docs.get(path), id: path.split("/").pop(), ref: makeDocRef(path) };
    },
    async set(data, options) {
      writes.push({ type: "set", path, data, options });
      docs.set(path, options?.merge ? { ...(docs.get(path) || {}), ...data } : data);
    },
    collection(name) {
      return makeCollection(`${path}/${name}`);
    },
  });
  const makeCollection = (path) => ({
    doc(id) {
      return makeDocRef(`${path}/${id ?? `auto-${++autoId}`}`);
    },
    async listDocuments() {
      return childIds(path).map((id) => makeDocRef(`${path}/${id}`));
    },
    count() {
      return { get: async () => ({ data: () => ({ count: childIds(path).length }) }) };
    },
  });
  const db = {
    doc: (path) => makeDocRef(path),
    collection: (path) => makeCollection(path),
    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          return { exists: docs.has(ref.path), data: () => docs.get(ref.path), ref };
        },
        set(ref, data, options) {
          writes.push({ type: "txnSet", path: ref.path, data, options });
          docs.set(ref.path, options?.merge ? { ...(docs.get(ref.path) || {}), ...data } : data);
        },
        update(ref, data) {
          writes.push({ type: "txnUpdate", path: ref.path, data });
          docs.set(ref.path, { ...(docs.get(ref.path) || {}), ...data });
        },
      };
      return fn(tx);
    },
  };
  return { db, writes, docs };
}

const authedRequest = (uid, data = {}) => ({ data, auth: { uid, token: {} } });

after(() => {
  setDbForTesting(null);
  setShowcaseNowForTesting(null);
});

describe("submitShowcaseEntry (submissions phase)", () => {
  beforeEach(() => {
    setDbForTesting(null);
    setShowcaseNowForTesting(() => SUBMISSION_TIME);
  });

  test("first entry pays the token; resubmission replaces without re-paying", async () => {
    const docs = new Map([
      [profilePath("u1"), { username: "MaestroMax", corpsCoin: 0 }],
      [wardrobePath("u1", "d1"), { ...DESIGN }],
      [wardrobePath("u1", "d2"), { ...DESIGN, name: "Second Look" }],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    const first = await submitShowcaseEntry.run(authedRequest("u1", { designId: "d1" }));
    assert.equal(first.paid, true);
    assert.equal(docs.get(profilePath("u1")).corpsCoin, SHOWCASE_ENTRY_REWARD);
    const entry = docs.get(entryPath("u1"));
    assert.equal(entry.designName, "Showcase Look");
    assert.equal(entry.design.aiHints, undefined, "private hints never enter the contest");

    const second = await submitShowcaseEntry.run(authedRequest("u1", { designId: "d2" }));
    assert.equal(second.paid, false);
    assert.equal(docs.get(profilePath("u1")).corpsCoin, SHOWCASE_ENTRY_REWARD);
    assert.equal(docs.get(entryPath("u1")).designName, "Second Look");
  });
});

describe("voting (voting phase)", () => {
  beforeEach(() => {
    setDbForTesting(null);
    setShowcaseNowForTesting(() => VOTING_TIME);
  });

  const seededDocs = () =>
    new Map([
      [profilePath("voter"), { username: "Voter", corpsCoin: 0 }],
      [entryPath("alpha"), { username: "A", designName: "Alpha", design: { schema: 2, figure: { skin: "#c9a074" } }, wins: 0, losses: 0 }],
      [entryPath("beta"), { username: "B", designName: "Beta", design: { schema: 2, figure: { skin: "#c9a074" } }, wins: 0, losses: 0 }],
    ]);

  test("a dealt pair is anonymous, and the vote lands on the dealt pair", async () => {
    const docs = seededDocs();
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    const dealt = await getShowcasePair.run(authedRequest("voter"));
    assert.equal(dealt.pair.length, 2);
    for (const item of dealt.pair) {
      assert.deepEqual(Object.keys(item).sort(), ["design", "key"], "no names, no uids");
    }
    const pending = docs.get(votePath("voter")).pending;
    assert.ok(pending.a && pending.b);

    const verdict = await castShowcaseVote.run(authedRequest("voter", { pick: "a" }));
    assert.equal(verdict.paid, true);
    assert.equal(verdict.voteCount, 1);
    assert.equal(docs.get(entryPath(pending.a)).wins, 1);
    assert.equal(docs.get(entryPath(pending.b)).losses, 1);
    assert.equal(docs.get(votePath("voter")).pending, null);
    assert.equal(docs.get(profilePath("voter")).corpsCoin, SHOWCASE_VOTE_REWARD);
  });

  test("voting without a dealt pair is rejected", async () => {
    const { db } = makeFakeDb(seededDocs());
    setDbForTesting(db);
    await assert.rejects(
      castShowcaseVote.run(authedRequest("voter", { pick: "a" })),
      /deal a pair first/
    );
  });

  test("vote tokens stop at the monthly cap; votes still count", async () => {
    const docs = seededDocs();
    docs.set(votePath("voter"), {
      pending: { a: "alpha", b: "beta", servedAt: "x" },
      count: SHOWCASE_PAID_VOTES,
    });
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    const verdict = await castShowcaseVote.run(authedRequest("voter", { pick: "b" }));
    assert.equal(verdict.paid, false);
    assert.equal(verdict.voteCount, SHOWCASE_PAID_VOTES + 1);
    assert.equal(docs.get(profilePath("voter")).corpsCoin, 0);
    assert.equal(docs.get(entryPath("beta")).wins, 1);
  });

  test("the voter's own entry is never dealt", async () => {
    const docs = seededDocs();
    docs.set(entryPath("voter"), { username: "Voter", designName: "Mine", design: { schema: 2 } });
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    for (let i = 0; i < 10; i++) {
      const dealt = await getShowcasePair.run(authedRequest("voter"));
      const pending = docs.get(votePath("voter")).pending;
      assert.notEqual(pending.a, "voter");
      assert.notEqual(pending.b, "voter");
      assert.notEqual(pending.a, pending.b, "a pair is two DIFFERENT entries");
      assert.equal(dealt.pair.length, 2);
    }
  });
});
