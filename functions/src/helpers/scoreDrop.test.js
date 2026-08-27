// Tests for the score-drop announcements: recap aggregation, the Discord
// embed and push-message builders (including the SoundSport never-reveal
// rule), webhook posting, and the lease-guarded once-per-day runner.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  ordinal,
  aggregateNightlyStandings,
  buildScoreDropEmbed,
  buildScoreDropPushes,
  buildChampionsPayload,
  postToDiscordWebhook,
  runDiscordScoreDrop,
} = require("./scoreDrop");

/** A recap doc shaped like commitDailyScoring writes (scoring.js). */
function sampleRecap() {
  return {
    offSeasonDay: 12,
    shows: [
      {
        eventName: "Midwest Classic",
        location: "Toledo, OH",
        results: [
          { uid: "u1", displayName: "chris", corpsClass: "worldClass", corpsName: "Aurora Vanguard",
            totalScore: 84.35 },
          { uid: "u2", displayName: "alex", corpsClass: "worldClass", corpsName: "Iron Cadence", totalScore: 86.1 },
          { uid: "u3", displayName: "sam", corpsClass: "aClass", corpsName: "Riverhawks", totalScore: 55.2 },
          { uid: "u4", displayName: "jo", corpsClass: "soundSport", corpsName: "Groove Unit", totalScore: 71.0 },
        ],
      },
      {
        eventName: "Lakeside Invitational",
        results: [
          { uid: "u5", displayName: "kai", corpsClass: "worldClass", corpsName: "Northern Lights", totalScore: 85.0 },
          { uid: "u1", displayName: "chris", corpsClass: "openClass", corpsName: "Aurora Cadets", totalScore: 61.9 },
        ],
      },
    ],
  };
}

describe("ordinal", () => {
  test("formats English ordinals including the teens", () => {
    assert.equal(ordinal(1), "1st");
    assert.equal(ordinal(2), "2nd");
    assert.equal(ordinal(3), "3rd");
    assert.equal(ordinal(4), "4th");
    assert.equal(ordinal(11), "11th");
    assert.equal(ordinal(12), "12th");
    assert.equal(ordinal(13), "13th");
    assert.equal(ordinal(22), "22nd");
    assert.equal(ordinal(101), "101st");
  });
});

describe("aggregateNightlyStandings", () => {
  test("ranks per class by score and excludes SoundSport from rankings", () => {
    const { byClass, soundSport, showCount } = aggregateNightlyStandings(sampleRecap());

    assert.equal(showCount, 2);
    const world = byClass.get("worldClass");
    assert.deepEqual(
      world.map((e) => [e.corpsName, e.rank, e.of]),
      [["Iron Cadence", 1, 3], ["Northern Lights", 2, 3], ["Aurora Vanguard", 3, 3]]
    );
    assert.equal(byClass.get("aClass").length, 1);
    assert.equal(byClass.has("soundSport"), false);
    assert.deepEqual(soundSport, [{ uid: "u4", corpsName: "Groove Unit" }]);
  });

  test("sums a corps' scores across multiple shows in one night", () => {
    const recap = {
      shows: [
        { eventName: "A", results: [{ uid: "u1", corpsClass: "worldClass", corpsName: "X", totalScore: 40 }] },
        { eventName: "B", results: [{ uid: "u1", corpsClass: "worldClass", corpsName: "X", totalScore: 41.5 }] },
      ],
    };
    const { byClass } = aggregateNightlyStandings(recap);
    assert.equal(byClass.get("worldClass")[0].score, 81.5);
  });

  test("tolerates missing/malformed rows and empty recaps", () => {
    const { byClass, soundSport } = aggregateNightlyStandings({
      shows: [{ eventName: "A", results: [null, {}, { uid: "u1", corpsClass: "notAClass", totalScore: 5 }] }],
    });
    assert.equal(byClass.size, 0);
    assert.equal(soundSport.length, 0);

    const empty = aggregateNightlyStandings({});
    assert.equal(empty.byClass.size, 0);
    assert.equal(empty.showCount, 0);
  });
});

describe("buildScoreDropEmbed", () => {
  test("builds one field per ranked class with medal top-3 lines", () => {
    const payload = buildScoreDropEmbed({ dailyRecap: sampleRecap(), seasonName: "Summer 2026", scoredDay: 12 });

    assert.equal(payload.embeds.length, 1);
    const embed = payload.embeds[0];
    assert.equal(embed.title, "🎺 Day 12 Scores Are In");
    assert.match(embed.description, /Summer 2026 — 2 shows scored tonight/);

    const world = embed.fields.find((f) => f.name.startsWith("World Class"));
    assert.match(world.name, /3 corps/);
    assert.match(world.value, /🥇 \*\*Iron Cadence\*\* — 86\.100 · alex/);
    assert.match(world.value, /🥉 \*\*Aurora Vanguard\*\* — 84\.350/);

    // SoundSport: counted in the footer, never RANKED alongside the scored
    // classes — but its blue ribbon is named, because Best in Show is an
    // award, not a rating. The score behind it never appears.
    assert.equal(embed.fields.some((f) => f.name.startsWith("SoundSport (")), false);
    const ribbons = embed.fields.find((f) => f.name.includes("Best in Show"));
    assert.match(ribbons.value, /\*\*Groove Unit\*\* — Midwest Classic/);
    assert.match(embed.footer.text, /1 SoundSport performance/);
    assert.equal(JSON.stringify(payload).includes("71"), false);
  });

  test("no blue-ribbon field on a night with no SoundSport performances", () => {
    const recap = sampleRecap();
    recap.shows[0].results = recap.shows[0].results.filter((r) => r.corpsClass !== "soundSport");
    const payload = buildScoreDropEmbed({ dailyRecap: recap, seasonName: "s", scoredDay: 12 });
    assert.equal(payload.embeds[0].fields.some((f) => f.name.includes("Best in Show")), false);
    assert.equal(payload.embeds[0].footer, undefined);
  });

  test("returns null when there is nothing to announce", () => {
    assert.equal(buildScoreDropEmbed({ dailyRecap: { shows: [] }, seasonName: "s", scoredDay: 3 }), null);
    assert.equal(buildScoreDropEmbed({ dailyRecap: {}, seasonName: "s", scoredDay: 3 }), null);
  });
});

describe("buildScoreDropPushes", () => {
  test("sends one push per director, preferring the highest class", () => {
    const pushes = buildScoreDropPushes({ dailyRecap: sampleRecap(), scoredDay: 12 });
    const byUid = new Map(pushes.map((p) => [p.uid, p]));

    assert.equal(pushes.length, 5);
    // u1 has World and Open corps -> exactly one push, for the World corps.
    assert.match(byUid.get("u1").body, /Aurora Vanguard scored 84\.350 tonight — 3rd of 3 in World Class/);
    assert.equal(byUid.get("u1").data.corpsClass, "worldClass");
    assert.match(byUid.get("u2").body, /1st of 3 in World Class/);
    assert.match(byUid.get("u3").body, /1st of 1 in A Class/);
    assert.equal(byUid.get("u1").title, "Day 12 scores are in 🎺");
    // The deep link carries `src=push` so an arrival from the morning push is
    // distinguishable from an organic visit in analytics (useScoreDropReturn
    // reads it). Without attribution there is no way to tell whether this
    // channel returns anyone.
    assert.equal(byUid.get("u1").url, "/scores?src=push");
  });

  test("SoundSport pushes never reveal a score", () => {
    const pushes = buildScoreDropPushes({ dailyRecap: sampleRecap(), scoredDay: 12 });
    const soundSportPush = pushes.find((p) => p.uid === "u4");
    assert.match(soundSportPush.body, /Groove Unit's SoundSport performance is in the books/);
    assert.equal(soundSportPush.body.includes("71"), false);
    assert.equal(soundSportPush.data.corpsClass, "soundSport");
  });
});

// The champions payload is the single biggest post of the year, built once on
// finals night from the season_champions doc. runDiscordScoreDrop's tests cover
// that it fires once under its own lease; these pin the embed the crowning
// actually renders — the per-class podium, medal order, score formatting, and
// the World Class headline.
describe("buildChampionsPayload", () => {
  const champions = (over = {}) => ({
    seasonId: "s26",
    seasonName: "Summer 2026",
    classes: {
      worldClass: [
        { rank: 1, uid: "u1", username: "chris", corpsName: "Iron Cadence", score: 98.125 },
        { rank: 2, uid: "u2", username: "alex", corpsName: "Aurora Vanguard", score: 97.4 },
        { rank: 3, uid: "u3", username: "sam", corpsName: "Northern Lights", score: 96.05 },
      ],
      openClass: [{ rank: 1, uid: "u4", username: "kai", corpsName: "Riverhawks", score: 88.2 }],
      aClass: [{ rank: 1, uid: "u5", username: "jo", corpsName: "Groove Unit", score: 77.7 }],
    },
    ...over,
  });

  test("titles and links the post, and headlines the World Class champion", () => {
    const payload = buildChampionsPayload({
      champions: champions(),
      seasonName: "Summer 2026",
    });
    const embed = payload.embeds[0];
    assert.match(embed.title, /Summer 2026 Champions/);
    assert.match(embed.url, /\/hall-of-champions/);
    // The World Class titlist is named in the description.
    assert.match(embed.description, /Iron Cadence/);
    assert.match(embed.description, /World Class title/);
  });

  test("renders one field per ranked class, in registry tier order", () => {
    const embed = buildChampionsPayload({ champions: champions() }).embeds[0];
    assert.deepEqual(
      embed.fields.map((f) => f.name),
      ["World Class", "Open Class", "A Class"]
    );
  });

  test("shows the podium with medals, corps name, score, and director", () => {
    const embed = buildChampionsPayload({ champions: champions() }).embeds[0];
    const worldField = embed.fields[0].value;
    // 🥇🥈🥉 in order, three-decimal score, and the director handle.
    assert.match(worldField, /🥇 \*\*Iron Cadence\*\* — 98\.125 · chris/);
    assert.match(worldField, /🥈 \*\*Aurora Vanguard\*\* — 97\.400 · alex/);
    assert.match(worldField, /🥉 \*\*Northern Lights\*\* — 96\.050 · sam/);
  });

  test("omits classes that crowned no one, and non-ranked classes entirely", () => {
    // SoundSport is non-competitive and never appears; an empty class is skipped.
    const payload = buildChampionsPayload({
      champions: champions({
        classes: {
          worldClass: [{ rank: 1, corpsName: "Iron Cadence", score: 98.1, username: "chris" }],
          openClass: [],
          soundSport: [{ rank: 1, corpsName: "Groove Unit", score: 80 }],
        },
      }),
    });
    assert.deepEqual(
      payload.embeds[0].fields.map((f) => f.name),
      ["World Class"]
    );
  });

  test("returns null when no class was crowned (nothing to post)", () => {
    assert.equal(buildChampionsPayload({ champions: { classes: {} }, seasonName: "X" }), null);
    assert.equal(buildChampionsPayload({ champions: {}, seasonName: "X" }), null);
    assert.equal(buildChampionsPayload({ champions: null, seasonName: "X" }), null);
  });

  test("tolerates a champion with no score or director", () => {
    const embed = buildChampionsPayload({
      champions: { classes: { worldClass: [{ rank: 1, corpsName: "Mystery Corps" }] } },
      seasonName: "X",
    }).embeds[0];
    assert.match(embed.fields[0].value, /🥇 \*\*Mystery Corps\*\*/);
    // No score suffix, no director suffix — just the medal and the name.
    assert.doesNotMatch(embed.fields[0].value, / · /);
    assert.doesNotMatch(embed.fields[0].value, /—/);
  });
});

describe("postToDiscordWebhook", () => {
  test("posts JSON and resolves on 2xx", async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 204, text: async () => "" };
    };
    await postToDiscordWebhook("https://discord.test/hook", { a: 1 }, fetchImpl);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://discord.test/hook");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.headers["Content-Type"], "application/json");
    // Every post is silenced by default: corps and event names are
    // user-authored, so nobody can ping the server from inside the game.
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      allowed_mentions: { parse: [] },
      a: 1,
    });
  });

  test("a payload's own allowed_mentions wins (deliberate role pings)", async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push(JSON.parse(options.body));
      return { ok: true, status: 204, text: async () => "" };
    };
    await postToDiscordWebhook(
      "https://discord.test/hook",
      { content: "hi", allowed_mentions: { parse: ["roles"] } },
      fetchImpl
    );
    assert.deepEqual(calls[0].allowed_mentions, { parse: ["roles"] });
  });

  test("throws with status detail on non-2xx", async () => {
    const fetchImpl = async () => ({ ok: false, status: 429, text: async () => "rate limited" });
    await assert.rejects(
      () => postToDiscordWebhook("https://discord.test/hook", {}, fetchImpl),
      /Discord webhook responded 429: rate limited/
    );
  });
});

/**
 * Fake Firestore covering what the runner touches: doc get/set from a
 * path->data map and the run-guard's lease transaction (same shape as the
 * nightlyStages.test.js fake).
 */
function fakeDb(docs) {
  const writes = {};
  const readState = (path) => (Object.prototype.hasOwnProperty.call(writes, path) ? writes[path] : docs[path]);
  const makeDocRef = (path) => ({
    path,
    id: path.split("/").pop(),
    get: async () => ({
      exists: readState(path) !== undefined,
      data: () => readState(path),
    }),
    set: async (data, options) => {
      writes[path] = options?.merge ? { ...(readState(path) || {}), ...data } : data;
    },
  });
  return {
    writes,
    doc: makeDocRef,
    collection: (path) => ({ doc: (id) => makeDocRef(`${path}/${id}`) }),
    runTransaction: async (fn) =>
      fn({
        get: async (ref) => ({
          exists: readState(ref.path) !== undefined,
          data: () => readState(ref.path),
        }),
        set: (ref, data) => {
          writes[ref.path] = data;
        },
      }),
  };
}

describe("runDiscordScoreDrop", () => {
  const seasonArgs = { seasonUid: "s26", seasonName: "Summer 2026", scoredDay: 12, webhookUrl: "https://d.test/h" };
  const leasePath = "scoring_runs/s26_discord_day12";

  test("is disabled without a webhook URL", async () => {
    const result = await runDiscordScoreDrop(fakeDb({}), { ...seasonArgs, webhookUrl: "" });
    assert.equal(result.status, "disabled");
  });

  test("no-ops when the day has no recap (dark day / scoring failed)", async () => {
    const db = fakeDb({});
    const result = await runDiscordScoreDrop(db, { ...seasonArgs, fetchImpl: async () => ({ ok: true }) });
    assert.equal(result.status, "no-recap");
    assert.equal(Object.keys(db.writes).length, 0);
  });

  test("posts once, marks the lease completed, and skips reruns", async () => {
    const db = fakeDb({ "fantasy_recaps/s26/days/12": sampleRecap() });
    let posts = 0;
    const fetchImpl = async () => {
      posts++;
      return { ok: true, status: 204, text: async () => "" };
    };

    const first = await runDiscordScoreDrop(db, { ...seasonArgs, fetchImpl });
    assert.equal(first.status, "posted");
    assert.equal(posts, 1);
    assert.equal(db.writes[leasePath].status, "completed");

    const second = await runDiscordScoreDrop(db, { ...seasonArgs, fetchImpl });
    assert.equal(second.status, "skipped");
    assert.equal(second.reason, "completed");
    assert.equal(posts, 1);
  });

  test("marks the lease failed and rethrows when the webhook errors", async () => {
    const db = fakeDb({ "fantasy_recaps/s26/days/12": sampleRecap() });
    const fetchImpl = async () => ({ ok: false, status: 500, text: async () => "boom" });

    await assert.rejects(() => runDiscordScoreDrop(db, { ...seasonArgs, fetchImpl }), /responded 500/);
    assert.equal(db.writes[leasePath].status, "failed");
    assert.match(db.writes[leasePath].lastError, /500/);
  });

  test("completes without posting on an empty recap", async () => {
    const db = fakeDb({ "fantasy_recaps/s26/days/12": { shows: [] } });
    let posts = 0;
    const result = await runDiscordScoreDrop(db, { ...seasonArgs, fetchImpl: async () => posts++ });
    assert.equal(result.status, "empty-recap");
    assert.equal(posts, 0);
    assert.equal(db.writes[leasePath], undefined);
  });

  test("an all-time record set tonight rides along as a second embed", async () => {
    const db = fakeDb({
      "fantasy_recaps/s26/days/12": sampleRecap(),
      "game-records/records": {
        classes: {
          worldClass: {
            // Set tonight — announced.
            highestScore: {
              value: 86.1,
              corpsName: "Iron Cadence",
              displayName: "alex",
              seasonName: "Summer 2026",
              day: 12,
            },
            // Set on an earlier night — never re-announced.
            highestGE: {
              value: 30.0,
              corpsName: "Old Guard",
              seasonName: "Summer 2026",
              day: 4,
            },
          },
        },
      },
    });
    let payload = null;
    const fetchImpl = async (url, options) => {
      payload = JSON.parse(options.body);
      return { ok: true, status: 204, text: async () => "" };
    };

    const result = await runDiscordScoreDrop(db, { ...seasonArgs, fetchImpl });
    assert.equal(result.status, "posted");
    assert.equal(result.recordsBroken, 1);
    assert.equal(payload.embeds.length, 2);
    assert.match(payload.embeds[1].title, /All-time record broken/);
    assert.match(payload.embeds[1].fields[0].value, /Iron Cadence.*Highest score, World Class/);
    assert.equal(payload.embeds[1].fields[0].value.includes("Old Guard"), false);
  });

  test("finals night posts the champions under their own lease", async () => {
    const db = fakeDb({
      "fantasy_recaps/s26/days/49": sampleRecap(),
      "season_champions/s26": {
        classes: {
          worldClass: [
            { rank: 1, corpsName: "Iron Cadence", username: "alex", score: 98.4 },
            { rank: 2, corpsName: "Aurora Vanguard", username: "chris", score: 97.9 },
          ],
          aClass: [{ rank: 1, corpsName: "Riverhawks", username: "sam", score: 80.1 }],
        },
      },
    });
    const posts = [];
    const fetchImpl = async (url, options) => {
      posts.push(JSON.parse(options.body));
      return { ok: true, status: 204, text: async () => "" };
    };

    const result = await runDiscordScoreDrop(db, { ...seasonArgs, scoredDay: 49, fetchImpl });
    assert.equal(result.status, "posted");
    assert.deepEqual(result.champions, { kind: "champions", status: "posted" });
    assert.equal(posts.length, 2);
    assert.match(posts[1].embeds[0].title, /Summer 2026 Champions/);
    assert.match(posts[1].embeds[0].description, /\*\*Iron Cadence\*\* takes the World Class title/);
    assert.match(posts[1].embeds[0].fields[0].value, /🥇 \*\*Iron Cadence\*\* — 98\.400 · alex/);
    assert.equal(db.writes["scoring_runs/s26_discord_champions_day49"].status, "completed");

    // A rerun of finals night re-posts neither the drop nor the champions.
    const rerun = await runDiscordScoreDrop(db, { ...seasonArgs, scoredDay: 49, fetchImpl });
    assert.equal(rerun.status, "skipped");
    assert.equal(posts.length, 2);
  });

  test("an ordinary night never reaches the champions post", async () => {
    const db = fakeDb({
      "fantasy_recaps/s26/days/12": sampleRecap(),
      "season_champions/s26": { classes: { worldClass: [{ corpsName: "X" }] } },
    });
    const posts = [];
    const result = await runDiscordScoreDrop(db, {
      ...seasonArgs,
      fetchImpl: async (url, options) => {
        posts.push(JSON.parse(options.body));
        return { ok: true, status: 204, text: async () => "" };
      },
    });
    assert.equal(result.champions, undefined);
    assert.equal(posts.length, 1);
  });
});
