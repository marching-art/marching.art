// Tests for the Showcase engine: the monthly clock and phases, the tally
// ladder, idempotent finalization with the champion's grant, and the
// lease-guarded Discord announcements (posted at most once per beat).
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  SHOWCASE_WINNER_ITEM,
  SHOWCASE_THEMES,
  monthIdFor,
  previousMonthId,
  themeForMonth,
  phaseFor,
  tallyShowcase,
  finalizeShowcase,
  announceShowcase,
  buildShowcaseWinnerPayload,
} = require("./showcase");

const NS = process.env.DATA_NAMESPACE;
const resultsPath = (m) => `artifacts/${NS}/showcases/${m}`;
const entryPath = (m, uid) => `artifacts/${NS}/showcases/${m}/entries/${uid}`;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;

/** Fake Firestore: doc get/set/update, collection get/count, transactions. */
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
    async get() {
      const found = childIds(path).map((id) => ({
        id,
        ref: makeDocRef(`${path}/${id}`),
        data: () => docs.get(`${path}/${id}`),
      }));
      return { empty: found.length === 0, size: found.length, docs: found };
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

describe("the monthly clock", () => {
  test("phases flip on the 21st UTC; month ids are calendar months", () => {
    assert.deepEqual(phaseFor(new Date("2026-09-01T00:00:00Z")), {
      monthId: "2026-09",
      phase: "submissions",
      votingOpensDay: 21,
    });
    assert.equal(phaseFor(new Date("2026-09-20T23:59:59Z")).phase, "submissions");
    assert.equal(phaseFor(new Date("2026-09-21T00:00:00Z")).phase, "voting");
    assert.equal(phaseFor(new Date("2026-09-30T23:59:59Z")).phase, "voting");
    assert.equal(monthIdFor(new Date("2026-01-05T12:00:00Z")), "2026-01");
    assert.equal(previousMonthId(new Date("2026-01-05T12:00:00Z")), "2025-12");
  });

  test("theme rotation is deterministic and lands in the pool", () => {
    const t = themeForMonth("2026-09");
    assert.equal(t, themeForMonth("2026-09"));
    assert.ok(SHOWCASE_THEMES.includes(t));
  });
});

describe("tallyShowcase", () => {
  test("ranks by wins, then fewer losses, then earlier entry", () => {
    const ranked = tallyShowcase([
      { uid: "late", wins: 5, losses: 2, submittedAt: "2026-09-10" },
      { uid: "clean", wins: 5, losses: 1, submittedAt: "2026-09-12" },
      { uid: "early", wins: 5, losses: 2, submittedAt: "2026-09-02" },
      { uid: "most", wins: 7, losses: 4, submittedAt: "2026-09-15" },
    ]);
    assert.deepEqual(
      ranked.map((e) => e.uid),
      ["most", "clean", "early", "late"]
    );
    assert.equal(ranked[0].rank, 1);
  });
});

describe("finalizeShowcase", () => {
  const NOW = new Date("2026-10-02T02:00:00Z"); // finalizes 2026-09

  test("tallies, publishes results, and grants the champion title once", async () => {
    const docs = new Map([
      [entryPath("2026-09", "winner"), { username: "MaestroMax", designName: "Winner", wins: 9, losses: 1, submittedAt: "a", design: { schema: 2 }, colors: ["#101c33", "#d7dde2", "#2f6fd0"] }],
      [entryPath("2026-09", "second"), { username: "RunnerUp", designName: "Second", wins: 4, losses: 3, submittedAt: "b" }],
      [profilePath("winner"), { username: "MaestroMax", corpsCoin: 500 }],
    ]);
    const { db, writes } = makeFakeDb(docs);

    const result = await finalizeShowcase(db, NOW);
    assert.equal(result.status, "finalized");
    assert.equal(result.winner, "winner");

    const results = docs.get(resultsPath("2026-09"));
    assert.equal(results.entryCount, 2);
    assert.equal(results.winners[0].username, "MaestroMax");
    assert.equal(results.winners[0].rank, 1);
    assert.ok(results.winners[0].design, "the podium carries renderable designs");

    const grant = writes.find(
      (w) => w.type === "txnUpdate" && w.path === profilePath("winner")
    );
    assert.equal(grant.data["cosmetics.owned"].constructor.name, "ArrayUnionTransform");
    const ledger = writes.find((w) => w.path.includes("users/winner/corpsCoinHistory"));
    assert.equal(ledger.data.type, "showcase_win");
    assert.equal(ledger.data.grantItem, SHOWCASE_WINNER_ITEM);

    // second run is a no-op — the results doc gates it
    const again = await finalizeShowcase(db, NOW);
    assert.equal(again.status, "already-finalized");
  });

  test("a month with no entries finalizes to nothing", async () => {
    const { db } = makeFakeDb();
    assert.equal((await finalizeShowcase(db, NOW)).status, "no-entries");
  });
});

describe("announceShowcase", () => {
  const posts = [];
  const fetchOk = async (url, opts) => {
    posts.push({ url, body: JSON.parse(opts.body) });
    return { ok: true, status: 204, text: async () => "" };
  };

  test("posts each beat at most once, via the announce leases", async () => {
    posts.length = 0;
    const { db } = makeFakeDb();
    const now = new Date("2026-09-05T02:00:00Z"); // submissions phase

    const first = await announceShowcase(db, { webhookUrl: "http://x", fetchImpl: fetchOk, now });
    assert.deepEqual(first.map((a) => [a.kind, a.status]), [["showcase-open", "posted"]]);
    assert.match(posts[0].body.embeds[0].title, /Showcase is open/);

    // same night again: the lease holds, nothing posts
    const second = await announceShowcase(db, { webhookUrl: "http://x", fetchImpl: fetchOk, now });
    assert.deepEqual(second, []);
    assert.equal(posts.length, 1);
  });

  test("voting beat carries the entry count; winner beat follows the results doc", async () => {
    posts.length = 0;
    const docs = new Map([
      [entryPath("2026-09", "a"), { username: "x" }],
      [entryPath("2026-09", "b"), { username: "y" }],
      [
        resultsPath("2026-08"),
        {
          monthId: "2026-08",
          entryCount: 5,
          winners: [
            { rank: 1, username: "MaestroMax", designName: "Winner Look", wins: 9 },
            { rank: 2, username: "RunnerUp", designName: "Second", wins: 4 },
          ],
        },
      ],
    ]);
    const { db } = makeFakeDb(docs);
    const now = new Date("2026-09-22T02:00:00Z"); // voting phase

    const beats = await announceShowcase(db, { webhookUrl: "http://x", fetchImpl: fetchOk, now });
    assert.deepEqual(
      beats.map((a) => [a.kind, a.status]),
      [
        ["showcase-voting", "posted"],
        ["showcase-winner", "posted"],
      ]
    );
    assert.match(posts[0].body.embeds[0].description, /2 designs are in/);
    assert.match(posts[1].body.embeds[0].description, /MaestroMax/);
  });

  test("winner payload medals the podium in order", () => {
    const payload = buildShowcaseWinnerPayload({
      monthId: "2026-08",
      theme: { title: "Gilded Age" },
      results: {
        entryCount: 5,
        winners: [
          { rank: 1, username: "A", designName: "One", wins: 9 },
          { rank: 2, username: "B", designName: "Two", wins: 7 },
          { rank: 3, username: "C", designName: "Three", wins: 5 },
        ],
      },
    });
    const description = payload.embeds[0].description;
    assert.ok(description.indexOf("🥇") < description.indexOf("🥈"));
    assert.ok(description.indexOf("🥈") < description.indexOf("🥉"));
    assert.match(description, /cannot be bought/);
  });
});
