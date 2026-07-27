// Eastern Classic night lineups → Discord: what the embed says, and the
// window + lease that make a nightly stage post it exactly once.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const easternClassicDiscord = require("./easternClassicDiscord");

/** Fake Firestore: doc reads from a path map, recorded writes, lease txn. */
function fakeDb(docs) {
  const writes = {};
  const makeDocRef = (path) => ({
    path,
    get: async () => ({
      exists: Object.prototype.hasOwnProperty.call(docs, path),
      data: () => docs[path],
    }),
    set: async (data, options) => {
      writes[path] = options && options.merge ? { ...(writes[path] || {}), ...data } : data;
      docs[path] = { ...(docs[path] || {}), ...data };
    },
  });
  return {
    writes,
    doc: makeDocRef,
    collection: (path) => ({ doc: (id) => makeDocRef(`${path}/${id}`) }),
    runTransaction: async (fn) =>
      fn({
        get: async (ref) => ({
          exists: Object.prototype.hasOwnProperty.call(docs, ref.path),
          data: () => docs[ref.path],
        }),
        set: async (ref, data) => {
          writes[ref.path] = data;
          docs[ref.path] = data;
        },
      }),
  };
}

/** Records every webhook POST; always succeeds. */
function recordingFetch(sink) {
  return async (url, options) => {
    sink.push({ url, payload: JSON.parse(options.body) });
    return { ok: true, status: 204, text: async () => "" };
  };
}

/** Fails every POST, the way an unreachable Discord does. */
const failingFetch = async () => ({ ok: false, status: 500, text: async () => "boom" });

function entry(corpsName, corpsClass, seed, uid = corpsName.toLowerCase()) {
  return { key: `${uid}_${corpsClass}`, uid, corpsClass, corpsName, seed };
}

/** A published split doc: 4 World / 2 A across the two nights. */
function splitDoc(overrides = {}) {
  return {
    seasonUid: "s12",
    eventName: "marching.art Eastern Classic",
    nights: [41, 42],
    preview: {
      assignments: {
        41: [
          entry("Blue Devils", "worldClass", 1),
          entry("Carolina Crown", "worldClass", 4),
          entry("Raiders", "aClass", 1),
        ],
        42: [
          entry("Bluecoats", "worldClass", 2),
          entry("Boston Crusaders", "worldClass", 3),
          entry("Spartans", "aClass", 2),
        ],
      },
      counts: { 41: 3, 42: 3 },
      enrolled: 6,
      computedAfterDay: 38,
    },
    ...overrides,
  };
}

describe("Eastern Classic lineup embed", () => {
  test("splits the roster by night and class, strongest seed first", () => {
    const payload = easternClassicDiscord.buildEasternPreviewPayload({
      seasonName: "Season 12",
      data: splitDoc(),
    });
    const embed = payload.embeds[0];

    assert.match(embed.title, /Eastern Classic/);
    assert.match(embed.description, /Days 41 and 42/);
    assert.match(embed.description, /6 corps so far: 3 on Night 1 · 3 on Night 2/);
    // The split is recomputed from final enrollment on night one, so the post
    // must not read as final.
    assert.match(embed.footer.text, /re-seeded into the final split/);

    assert.equal(embed.fields.length, 2);
    assert.equal(embed.fields[0].name, "Night 1 · Day 41");
    assert.equal(embed.fields[1].name, "Night 2 · Day 42");
    // World Class before A Class, seeds ascending inside a class.
    assert.equal(
      embed.fields[0].value,
      "**World Class** (2) — Blue Devils, Carolina Crown\n**A Class** (1) — Raiders"
    );
    assert.match(embed.fields[1].value, /\*\*World Class\*\* \(2\) — Bluecoats, Boston Crusaders/);
  });

  test("no pings, even though corps names are user-authored", () => {
    const payload = easternClassicDiscord.buildEasternPreviewPayload({
      seasonName: "Season 12",
      data: splitDoc({
        preview: {
          assignments: { 41: [entry("@everyone", "worldClass", 1)], 42: [] },
          enrolled: 1,
        },
      }),
    });
    assert.deepEqual(payload.allowed_mentions, { parse: [] });
  });

  test("adds the Podium headcount when that snake is published too", () => {
    const payload = easternClassicDiscord.buildEasternPreviewPayload({
      seasonName: "Season 12",
      data: splitDoc({
        podium: { assignments: { u1: 41, u2: 41, u3: 42 }, publishedOnDay: 38 },
      }),
    });
    const embed = payload.embeds[0];
    assert.match(embed.fields[0].value, /\*\*Podium\*\* \(2\)$/);
    assert.match(embed.fields[1].value, /\*\*Podium\*\* \(1\)$/);
    // The Podium corps count toward the totals in the description.
    assert.match(embed.description, /9 corps so far: 5 on Night 1 · 4 on Night 2/);
  });

  test("a long class roster is clamped with a +N more tail", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      entry(`Corps Number ${i + 1}`, "worldClass", i + 1)
    );
    const payload = easternClassicDiscord.buildEasternPreviewPayload({
      seasonName: "Season 12",
      data: splitDoc({ preview: { assignments: { 41: many, 42: [] }, enrolled: 40 } }),
    });
    const value = payload.embeds[0].fields[0].value;
    assert.match(value, /\*\*World Class\*\* \(40\) —/);
    assert.match(value, /\+\d+ more$/);
    // Discord's hard cap on a field value.
    assert.ok(value.length <= 1024, `field value was ${value.length} chars`);
  });

  test("null when no preview has been published, or when nobody registered", () => {
    assert.equal(
      easternClassicDiscord.buildEasternPreviewPayload({ seasonName: "S", data: null }),
      null
    );
    assert.equal(
      easternClassicDiscord.buildEasternPreviewPayload({
        seasonName: "S",
        data: { nights: [41, 42] },
      }),
      null
    );
    assert.equal(
      easternClassicDiscord.buildEasternPreviewPayload({
        seasonName: "S",
        data: splitDoc({ preview: { assignments: { 41: [], 42: [] }, enrolled: 0 } }),
      }),
      null
    );
  });
});

describe("Eastern Classic announcement window", () => {
  test("posts on the publishing night, once", async () => {
    const db = fakeDb({ "eastern-classic/s12": splitDoc() });
    const posts = [];
    const args = {
      seasonUid: "s12",
      seasonName: "Season 12",
      competitionDay: 38,
      webhookUrl: "https://discord.test/hook",
      fetchImpl: recordingFetch(posts),
    };

    const first = await easternClassicDiscord.announceEasternPreview(db, args);
    assert.equal(first.status, "posted");
    assert.equal(posts.length, 1);
    assert.match(posts[0].payload.embeds[0].title, /Eastern Classic/);

    // Every later night in the window contends for the same lease.
    const second = await easternClassicDiscord.announceEasternPreview(db, {
      ...args,
      competitionDay: 39,
    });
    assert.equal(second.status, "skipped");
    assert.equal(second.reason, "completed");
    assert.equal(posts.length, 1);
  });

  test("a failed post is retried the next night in the window", async () => {
    const docs = { "eastern-classic/s12": splitDoc() };
    const db = fakeDb(docs);
    const args = {
      seasonUid: "s12",
      seasonName: "Season 12",
      webhookUrl: "https://discord.test/hook",
    };

    const failed = await easternClassicDiscord.announceEasternPreview(db, {
      ...args,
      competitionDay: 38,
      fetchImpl: failingFetch,
    });
    assert.equal(failed.status, "failed");

    const posts = [];
    const retried = await easternClassicDiscord.announceEasternPreview(db, {
      ...args,
      competitionDay: 39,
      fetchImpl: recordingFetch(posts),
    });
    assert.equal(retried.status, "posted");
    assert.equal(posts.length, 1);
  });

  test("silent outside days 38-40, without reading the split doc", async () => {
    const db = fakeDb({ "eastern-classic/s12": splitDoc() });
    const posts = [];
    for (const competitionDay of [1, 37, 41, 42, 49]) {
      const result = await easternClassicDiscord.announceEasternPreview(db, {
        seasonUid: "s12",
        seasonName: "Season 12",
        competitionDay,
        webhookUrl: "https://discord.test/hook",
        fetchImpl: recordingFetch(posts),
      });
      assert.equal(result.status, "out-of-window", `day ${competitionDay} should be silent`);
    }
    assert.equal(posts.length, 0);
  });

  test("a season with no published preview claims no lease", async () => {
    const db = fakeDb({});
    const posts = [];
    const result = await easternClassicDiscord.announceEasternPreview(db, {
      seasonUid: "s12",
      seasonName: "Season 12",
      competitionDay: 38,
      webhookUrl: "https://discord.test/hook",
      fetchImpl: recordingFetch(posts),
    });
    assert.equal(result.status, "not-published");
    assert.equal(posts.length, 0);
    assert.deepEqual(Object.keys(db.writes), []);
  });
});
