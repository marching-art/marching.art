// The Podium Class score drop → Discord: what a night's post says, how a
// many-show tour night is kept readable, the championship-week cut embed that
// rides finals week, and the per-day lease that makes a nightly stage post
// exactly once.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const scoreDropDiscord = require("./scoreDropDiscord");

const SEASON = "season42";
const SEASON_NAME = "Scherzo 2026";
const WEBHOOK = "https://discord.test/webhook";

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
    collection: (path) => ({
      doc: (id) => makeDocRef(`${path}/${id}`),
      get: async () => ({ empty: true, docs: [] }),
    }),
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

/** One corps' recap row, as the Podium processor writes it. */
const row = (uid, corpsName, totalScore, division = "worldClass", displayName = null) => ({
  uid,
  corpsName,
  corpsClass: "podiumClass",
  division,
  totalScore,
  displayName,
  geScore: 30,
  visualScore: 30,
  musicScore: 30,
});

/** A show with `count` corps, ranked from `top` down. */
const show = (eventName, count, top, { location = null, division = "worldClass" } = {}) => ({
  eventName,
  location,
  results: Array.from({ length: count }, (_, i) =>
    row(`${eventName}-${i + 1}`, `${eventName} Corps ${i + 1}`, top - i * 0.5, division)
  ),
});

const embedText = (payload) => JSON.stringify(payload.embeds);

describe("buildPodiumScoreDropPayload", () => {
  test("reads the night out show by show, podium first", () => {
    const payload = scoreDropDiscord.buildPodiumScoreDropPayload({
      recap: {
        shows: [
          {
            eventName: "Marion Regional",
            location: "Marion, IN",
            results: [
              row("a", "Crimson Cadence", 82.15, "worldClass", "DirectorDan"),
              row("b", "Golden Empire", 80.9, "openClass"),
              row("c", "Steel City Sound", 78.2, "aClass"),
              row("d", "Bayou Brigade", 71.05, "aClass"),
            ],
          },
        ],
      },
      seasonName: SEASON_NAME,
      competitionDay: 20,
    });

    const [embed] = payload.embeds;
    assert.equal(embed.title, "🏟️ Day 20 Podium Class Scores");
    assert.match(embed.description, /4 corps performed at 1 show tonight, high score 82\.150/);
    assert.equal(embed.fields.length, 1);
    assert.match(embed.fields[0].name, /Marion Regional · Marion, IN \(4\)/);
    // The podium, with divisions named per row and the director credited.
    assert.match(embed.fields[0].value, /🥇 \*\*Crimson Cadence\*\* — 82\.150 · World · DirectorDan/);
    assert.match(embed.fields[0].value, /🥈 \*\*Golden Empire\*\* — 80\.900 · Open/);
    assert.match(embed.fields[0].value, /🥉 \*\*Steel City Sound\*\* — 78\.200 · A/);
    // Only the podium is read out — 4th is on the sheet, not in the post.
    assert.ok(!embed.fields[0].value.includes("Bayou Brigade"));
  });

  test("never composes a cross-show ranking", () => {
    // Two shows on one night: the lower-scoring show still gets its own gold.
    const payload = scoreDropDiscord.buildPodiumScoreDropPayload({
      recap: {
        shows: [show("Big Show", 5, 90), show("Small Show", 3, 70)],
      },
      seasonName: SEASON_NAME,
      competitionDay: 12,
    });
    const [embed] = payload.embeds;
    assert.equal(embed.fields.length, 2);
    assert.match(embed.fields[0].value, /🥇 \*\*Big Show Corps 1\*\* — 90\.000/);
    assert.match(embed.fields[1].value, /🥇 \*\*Small Show Corps 1\*\* — 70\.000/);
    // The high score is the night's best number, not a placement.
    assert.match(embed.description, /high score 90\.000/);
  });

  test("keeps a many-show tour night readable: biggest fields lead, rest counted", () => {
    const shows = Array.from({ length: 10 }, (_, i) =>
      show(`Stop ${i + 1}`, 12 - i, 85) // descending field sizes
    );
    // Shuffle so the ordering is the builder's doing, not the input's.
    const payload = scoreDropDiscord.buildPodiumScoreDropPayload({
      recap: { shows: [...shows].reverse() },
      seasonName: SEASON_NAME,
      competitionDay: 8,
    });
    const [embed] = payload.embeds;
    assert.equal(embed.fields.length, scoreDropDiscord.MAX_SHOWS);
    assert.match(embed.fields[0].name, /Stop 1 \(12\)/); // biggest field first
    assert.match(embed.footer.text, /Plus 4 more shows on the sheet/);
  });

  test("a night with nothing scored is not a post", () => {
    for (const recap of [null, {}, { shows: [] }, { shows: [{ eventName: "X", results: [] }] }]) {
      assert.equal(
        scoreDropDiscord.buildPodiumScoreDropPayload({
          recap,
          seasonName: SEASON_NAME,
          competitionDay: 5,
        }),
        null
      );
    }
    // A joint-rehearsal-only recap is a real document with no scores in it.
    assert.equal(
      scoreDropDiscord.buildPodiumScoreDropPayload({
        recap: { jointRehearsals: [{ corpsA: "A", corpsB: "B" }] },
        seasonName: SEASON_NAME,
        competitionDay: 5,
      }),
      null
    );
  });

  test("never pings, whatever a corps is named", () => {
    const payload = scoreDropDiscord.buildPodiumScoreDropPayload({
      recap: { shows: [{ eventName: "Show", results: [row("a", "@everyone", 80)] }] },
      seasonName: SEASON_NAME,
      competitionDay: 3,
    });
    assert.deepEqual(payload.allowed_mentions, { parse: [] });
  });
});

describe("buildPodiumCutEmbed", () => {
  const prelims = {
    shows: [
      {
        eventName: "marching.art World Championship Prelims",
        results: Array.from({ length: 30 }, (_, i) =>
          row(`u${i + 1}`, `Corps ${i + 1}`, 95 - i * 0.5)
        ),
      },
    ],
  };
  const cut = {
    toDay: 48,
    eventName: "marching.art World Championship Semifinals",
    roundName: "Semifinals",
    rule: "Top 25 advance to Semifinals",
    perDivision: false,
    uids: Array.from({ length: 25 }, (_, i) => `u${i + 1}`),
    advancingCount: 25,
    fieldCount: 30,
    missedCount: 5,
    cutLine: 83,
  };

  test("names the advancing corps the processor published", () => {
    const embed = scoreDropDiscord.buildPodiumCutEmbed(
      { ...prelims, championshipCut: cut },
      { seasonName: SEASON_NAME }
    );
    assert.match(embed.title, /The Podium field is set/);
    assert.match(embed.description, /Day 48\. Top 25 advance to Semifinals\. 25 advance\./);
    assert.match(embed.description, /5 corps miss the cut, at 83\.000/);
    assert.match(embed.fields[0].name, /Advancing \(25\)/);
    assert.match(embed.fields[0].value, /1\. \*\*Corps 1\*\* — 95\.000 · World/);
    // 26th on the night is not in the list.
    assert.ok(!embed.fields[0].value.includes("Corps 26"));
  });

  test("is silent on a night that decided nothing", () => {
    assert.equal(scoreDropDiscord.buildPodiumCutEmbed(prelims, { seasonName: SEASON_NAME }), null);
    assert.equal(scoreDropDiscord.buildPodiumCutEmbed(null, { seasonName: SEASON_NAME }), null);
    assert.equal(
      scoreDropDiscord.buildPodiumCutEmbed(
        { ...prelims, championshipCut: { ...cut, uids: [] } },
        { seasonName: SEASON_NAME }
      ),
      null
    );
  });

  test("does not invent names for uids the night has no row for", () => {
    const embed = scoreDropDiscord.buildPodiumCutEmbed(
      {
        shows: [{ eventName: "Prelims", results: [row("u1", "Crimson Cadence", 90)] }],
        championshipCut: { ...cut, uids: ["u1", "ghost"], advancingCount: 2 },
      },
      { seasonName: SEASON_NAME }
    );
    assert.match(embed.fields[0].value, /Crimson Cadence/);
    assert.ok(!embed.fields[0].value.includes("ghost"));
    assert.match(embed.fields[0].name, /Advancing \(1\)/);
  });
});

describe("announcePodiumScoreDrop", () => {
  const recapPath = (day) => `podium-recaps/${SEASON}/days/${day}`;
  const args = (day, extra = {}) => ({
    seasonUid: SEASON,
    seasonName: SEASON_NAME,
    competitionDay: day,
    webhookUrl: WEBHOOK,
    ...extra,
  });

  test("posts the night's scores once, then never again", async () => {
    const db = fakeDb({ [recapPath(20)]: { shows: [show("Marion Regional", 6, 84)] } });
    const posts = [];
    const first = await scoreDropDiscord.announcePodiumScoreDrop(
      db,
      args(20, { fetchImpl: recordingFetch(posts) })
    );
    assert.equal(first.status, "posted");
    assert.equal(posts.length, 1);
    assert.equal(posts[0].url, WEBHOOK);
    assert.match(embedText(posts[0].payload), /Day 20 Podium Class Scores/);

    // A stage re-run on the same night is stopped by the lease.
    const second = await scoreDropDiscord.announcePodiumScoreDrop(
      db,
      args(20, { fetchImpl: recordingFetch(posts) })
    );
    assert.equal(second.status, "skipped");
    assert.equal(posts.length, 1);
  });

  test("championship week: the cut rides the same message as the scores", async () => {
    const results = Array.from({ length: 30 }, (_, i) => row(`u${i + 1}`, `Corps ${i + 1}`, 95 - i));
    const db = fakeDb({
      [recapPath(47)]: {
        shows: [{ eventName: "marching.art World Championship Prelims", results }],
        championshipCut: {
          toDay: 48,
          eventName: "marching.art World Championship Semifinals",
          rule: "Top 25 advance to Semifinals",
          perDivision: false,
          uids: results.slice(0, 25).map((r) => r.uid),
          advancingCount: 25,
          fieldCount: 30,
          missedCount: 5,
          cutLine: 71,
        },
      },
    });
    const posts = [];
    const result = await scoreDropDiscord.announcePodiumScoreDrop(
      db,
      args(47, { fetchImpl: recordingFetch(posts) })
    );
    assert.equal(result.status, "posted");
    // One message, two embeds: tonight's scores and the cut they decided.
    assert.equal(posts.length, 1);
    assert.equal(posts[0].payload.embeds.length, 2);
    assert.match(posts[0].payload.embeds[1].title, /The Podium field is set/);
  });

  test("claims nothing on a night with no recap, or off-season", async () => {
    const db = fakeDb({});
    const posts = [];
    const noRecap = await scoreDropDiscord.announcePodiumScoreDrop(
      db,
      args(20, { fetchImpl: recordingFetch(posts) })
    );
    assert.equal(noRecap.status, "no-recap");

    // Spring training (day <= 0) and past finals never read a document at all.
    for (const day of [0, -5, 50]) {
      const out = await scoreDropDiscord.announcePodiumScoreDrop(
        db,
        args(day, { fetchImpl: recordingFetch(posts) })
      );
      assert.equal(out.status, "out-of-season");
    }
    assert.equal(posts.length, 0);
    assert.deepEqual(db.writes, {});
  });

  test("an unset webhook disables the drop entirely", async () => {
    const db = fakeDb({ [recapPath(20)]: { shows: [show("Show", 3, 80)] } });
    const out = await scoreDropDiscord.announcePodiumScoreDrop(db, args(20, { webhookUrl: "" }));
    assert.equal(out.status, "disabled");
    assert.deepEqual(db.writes, {});
  });

  test("a Discord outage fails the lease so the next run re-posts", async () => {
    const db = fakeDb({ [recapPath(20)]: { shows: [show("Show", 3, 80)] } });
    const failing = async () => ({ ok: false, status: 500, text: async () => "boom" });
    const first = await scoreDropDiscord.announcePodiumScoreDrop(
      db,
      args(20, { fetchImpl: failing })
    );
    assert.equal(first.status, "failed");

    const posts = [];
    const retry = await scoreDropDiscord.announcePodiumScoreDrop(
      db,
      args(20, { fetchImpl: recordingFetch(posts) })
    );
    assert.equal(retry.status, "posted");
    assert.equal(posts.length, 1);
  });
});
