// League chat's social surface — replies, reactions, reports — exercised
// against the REAL onCall handlers via the v2 `.run()` hook with a fake
// Firestore (config.setDbForTesting), same pattern as leagues.test.js.
//
// Covers:
//   - a reply stores a server-taken snapshot of the quoted message (never the
//     client's text) and refuses a target that isn't there;
//   - every post stamps `lastChatAt` on the league doc (the league card's
//     unread dot reads it) without touching the members list;
//   - reactions come only from the fixed palette, toggle per member, and are
//     member-only;
//   - reports need a reason, can't target your own message, and dedupe per
//     reporter per message by doc id.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const {
  postLeagueMessage,
  toggleLeagueMessageReaction,
  reportLeagueMessage,
  LEAGUE_CHAT_REACTIONS,
} = require("./leagueChat");

const NS = process.env.DATA_NAMESPACE;
const leaguePath = (id) => `artifacts/${NS}/leagues/${id}`;

/** Fake Firestore: doc get/set/update, auto-id collections, transactions. */
function makeFakeDb(docs = new Map()) {
  const writes = [];
  let autoId = 0;

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
      writes.push({ type: "update", path, data });
    },
    collection(sub) {
      return {
        doc: (id) => makeRef(`${path}/${sub}/${id !== undefined ? id : `auto-${++autoId}`}`),
      };
    },
  });

  const db = {
    doc: (path) => makeRef(path),
    collection: (path) => ({
      doc: (id) => makeRef(`${path}/${id !== undefined ? id : `auto-${++autoId}`}`),
    }),
    async runTransaction(fn) {
      const transaction = {
        async get(ref) {
          const data = docs.get(ref.path);
          return { exists: data !== undefined, data: () => data };
        },
        update(ref, data) {
          docs.set(ref.path, { ...(docs.get(ref.path) || {}), ...data });
          writes.push({ type: "update", path: ref.path, data });
        },
        set(ref, data) {
          docs.set(ref.path, data);
          if (/^(rate_|leagueChatRate)/.test(String(ref.path))) return;
          writes.push({ type: "set", path: ref.path, data });
        },
        delete(ref) {
          docs.delete(ref.path);
          writes.push({ type: "delete", path: ref.path });
        },
      };
      return fn(transaction);
    },
  };

  return { db, writes, docs };
}

function authedRequest(uid, data = {}) {
  return { data, auth: { uid, token: {} } };
}

function chatDocs() {
  const docs = new Map([
    [leaguePath("league-1"), {
      name: "The League",
      creatorId: "owner",
      members: ["owner", "u1", "u2"],
      settings: {},
    }],
  ]);
  docs.set(`${leaguePath("league-1")}/chat/m1`, {
    userId: "owner",
    message: "Draft night is Thursday. " + "x".repeat(300),
    createdAt: new Date("2026-09-01T00:00:00Z"),
  });
  return docs;
}

after(() => setDbForTesting(null));

describe("postLeagueMessage replies and lastChatAt", () => {
  beforeEach(() => setDbForTesting(null));

  test("stores a server-taken snapshot of the quoted message, capped for the quote", async () => {
    const { db, writes, docs } = makeFakeDb(chatDocs());
    setDbForTesting(db);

    const result = await postLeagueMessage.run(
      authedRequest("u1", { leagueId: "league-1", message: "Works for me", replyTo: "m1" })
    );
    assert.equal(result.success, true);

    const chatWrite = writes.find((w) => w.type === "set" && w.path.includes("/chat/"));
    assert.ok(chatWrite);
    assert.equal(chatWrite.data.replyTo.id, "m1");
    assert.equal(chatWrite.data.replyTo.userId, "owner");
    assert.equal(chatWrite.data.replyTo.message.length, 200);
    assert.ok(chatWrite.data.replyTo.message.endsWith("…"));

    // The league doc is stamped, and its roster is intact afterwards.
    const league = docs.get(leaguePath("league-1"));
    assert.ok(league.lastChatAt);
    assert.deepEqual(league.members, ["owner", "u1", "u2"]);
  });

  test("a plain message carries no replyTo field", async () => {
    const { db, writes } = makeFakeDb(chatDocs());
    setDbForTesting(db);
    await postLeagueMessage.run(authedRequest("u1", { leagueId: "league-1", message: "hi" }));
    const chatWrite = writes.find((w) => w.type === "set" && w.path.includes("/chat/"));
    assert.equal("replyTo" in chatWrite.data, false);
  });

  test("rejects a reply to a message that isn't there, and a non-string target", async () => {
    const { db } = makeFakeDb(chatDocs());
    setDbForTesting(db);
    await assert.rejects(
      postLeagueMessage.run(
        authedRequest("u1", { leagueId: "league-1", message: "?", replyTo: "nope" })
      ),
      /gone/
    );
    await assert.rejects(
      postLeagueMessage.run(
        authedRequest("u1", { leagueId: "league-1", message: "?", replyTo: { id: "m1" } })
      ),
      /message ID/
    );
  });
});

describe("toggleLeagueMessageReaction", () => {
  beforeEach(() => setDbForTesting(null));

  test("palette is fixed and non-members are refused", async () => {
    const { db } = makeFakeDb(chatDocs());
    setDbForTesting(db);
    assert.ok(LEAGUE_CHAT_REACTIONS.includes("🔥"));
    await assert.rejects(
      toggleLeagueMessageReaction.run(
        authedRequest("u1", { leagueId: "league-1", messageId: "m1", emoji: "🍆" })
      ),
      /isn't available/
    );
    await assert.rejects(
      toggleLeagueMessageReaction.run(
        authedRequest("stranger", { leagueId: "league-1", messageId: "m1", emoji: "🔥" })
      ),
      /league member/
    );
  });

  test("toggles per member and drops an emoji key once nobody holds it", async () => {
    const { db, docs } = makeFakeDb(chatDocs());
    setDbForTesting(db);
    const path = `${leaguePath("league-1")}/chat/m1`;
    const call = (uid, emoji) =>
      toggleLeagueMessageReaction.run(
        authedRequest(uid, { leagueId: "league-1", messageId: "m1", emoji })
      );

    assert.equal((await call("u1", "🔥")).reacted, true);
    assert.equal((await call("u2", "🔥")).reacted, true);
    assert.equal((await call("u2", "😂")).reacted, true);
    assert.deepEqual(docs.get(path).reactions, { "🔥": ["u1", "u2"], "😂": ["u2"] });

    assert.equal((await call("u1", "🔥")).reacted, false);
    assert.equal((await call("u2", "😂")).reacted, false);
    assert.deepEqual(docs.get(path).reactions, { "🔥": ["u2"] });
  });

  test("a deleted message cannot be reacted to", async () => {
    const { db } = makeFakeDb(chatDocs());
    setDbForTesting(db);
    await assert.rejects(
      toggleLeagueMessageReaction.run(
        authedRequest("u1", { leagueId: "league-1", messageId: "ghost", emoji: "🔥" })
      ),
      /no longer exists/
    );
  });
});

describe("reportLeagueMessage", () => {
  beforeEach(() => setDbForTesting(null));

  test("needs a reason and refuses your own message", async () => {
    const { db } = makeFakeDb(chatDocs());
    setDbForTesting(db);
    await assert.rejects(
      reportLeagueMessage.run(
        authedRequest("u1", { leagueId: "league-1", messageId: "m1", reason: "bad" })
      ),
      /briefly why/
    );
    await assert.rejects(
      reportLeagueMessage.run(
        authedRequest("owner", { leagueId: "league-1", messageId: "m1", reason: "I regret this" })
      ),
      /your own message/
    );
  });

  test("writes one typed report per reporter per message", async () => {
    const { db, writes } = makeFakeDb(chatDocs());
    setDbForTesting(db);
    const req = () =>
      reportLeagueMessage.run(
        authedRequest("u1", { leagueId: "league-1", messageId: "m1", reason: "Harassment in chat" })
      );

    const first = await req();
    assert.equal(first.success, true);
    const second = await req();
    assert.match(second.message, /already reported/);

    const reports = writes.filter((w) => w.path.startsWith("reports/"));
    assert.equal(reports.length, 1);
    assert.equal(reports[0].path, "reports/leaguechat_m1_u1");
    assert.equal(reports[0].data.type, "league_message");
    assert.equal(reports[0].data.leagueId, "league-1");
    assert.equal(reports[0].data.commentAuthorUid, "owner");
    assert.equal(reports[0].data.status, "new");
  });
});
