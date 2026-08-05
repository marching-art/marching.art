// Fan Favorite → Discord announcements (decision 30): which post is due when,
// what the embeds say, and the per-event leases that make a nightly stage
// post each announcement exactly once.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const fanFavoriteDiscord = require("./fanFavoriteDiscord");

const cfg = { fanFavorite: { voteWindowDays: 3, finalistsPerMajor: 3, finalsFromDay: 45 } };

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

describe("Fan Favorite announcement days", () => {
  test("each major announces on the night its field is complete", () => {
    assert.equal(fanFavoriteDiscord.majorAnnouncedOn(28), 28);
    assert.equal(fanFavoriteDiscord.majorAnnouncedOn(35), 35);
    // The Eastern spans two nights: announced on 42, when both are scored.
    assert.equal(fanFavoriteDiscord.majorAnnouncedOn(41), null);
    assert.equal(fanFavoriteDiscord.majorAnnouncedOn(42), 41);
    assert.equal(fanFavoriteDiscord.majorAnnouncedOn(27), null);
    assert.equal(fanFavoriteDiscord.majorAnnouncedOn(44), null);
  });
});

describe("Fan Favorite embeds", () => {
  test("ballot-open groups candidates by division and names the closing day", () => {
    const payload = fanFavoriteDiscord.buildBallotOpenPayload({
      seasonName: "Season 12",
      major: 28,
      candidates: [
        { uid: "a", corpsName: "Blue Stars", division: "worldClass" },
        { uid: "b", corpsName: "Colts", division: "openClass" },
        { uid: "c", corpsName: "Raiders", division: "openClass" },
      ],
      closesOnDay: 30,
    });
    const embed = payload.embeds[0];
    assert.match(embed.title, /Southwestern Championship/);
    assert.match(embed.description, /Day 30/);
    assert.equal(embed.fields.length, 2);
    assert.match(embed.fields[0].name, /World Class \(1\)/);
    assert.match(embed.fields[1].name, /Open Class \(2\)/);
    assert.match(embed.fields[1].value, /Colts/);
    assert.match(embed.footer.text, /3 corps on the ballot/);
  });

  test("ballot-open is null when nobody performed at the major", () => {
    assert.equal(
      fanFavoriteDiscord.buildBallotOpenPayload({
        seasonName: "S",
        major: 35,
        candidates: [],
        closesOnDay: 37,
      }),
      null
    );
  });

  test("finals-open carries each major's prelims RESULTS, then the finalists", () => {
    const payload = fanFavoriteDiscord.buildFinalsOpenPayload({
      seasonName: "Season 12",
      finalists: [
        { uid: "a", corpsName: "Blue Stars", prelimVotes: 9 },
        { uid: "b", corpsName: "Colts", prelimVotes: 1 },
      ],
      prelimsResults: {
        28: [
          { uid: "a", corpsName: "Blue Stars", votes: 9 },
          { uid: "b", corpsName: "Colts", votes: 1 },
        ],
        35: [{ uid: "a", corpsName: "Blue Stars", votes: 4 }],
      },
    });
    const embed = payload.embeds[0];
    assert.match(embed.title, /finals/i);
    // Two majors with results + the finalists field (the Eastern drew none).
    assert.equal(embed.fields.length, 3);
    assert.match(embed.fields[0].name, /Southwestern Championship — prelims results/);
    assert.match(embed.fields[0].value, /🥇 \*\*Blue Stars\*\* — 9 votes/);
    assert.match(embed.fields[0].value, /🥈 \*\*Colts\*\* — 1 vote$/m);
    assert.match(embed.fields[2].name, /Finalists \(2\)/);
  });

  test("winner post reports the finals tally, and says so when nobody voted", () => {
    const voted = fanFavoriteDiscord.buildWinnerPayload({
      seasonName: "Season 12",
      winner: { corpsName: "Blue Stars", finalsVotes: 7 },
      finalsResults: [
        { corpsName: "Blue Stars", votes: 7 },
        { corpsName: "Colts", votes: 2 },
      ],
    });
    assert.match(voted.embeds[0].title, /Blue Stars is the Season 12 Fan Favorite/);
    assert.match(voted.embeds[0].description, /7 votes in the finals/);
    assert.match(voted.embeds[0].fields[0].value, /🥈 \*\*Colts\*\* — 2 votes/);

    const unvoted = fanFavoriteDiscord.buildWinnerPayload({
      seasonName: "Season 12",
      winner: { corpsName: "Colts", finalsVotes: 0 },
    });
    assert.match(unvoted.embeds[0].description, /finals drew no votes/);
    assert.equal(unvoted.embeds[0].fields.length, 0);
  });

  test("medals follow the row's place, so a tie doesn't print a fake podium", () => {
    const payload = fanFavoriteDiscord.buildFinalsOpenPayload({
      seasonName: "Season 12",
      finalists: [{ uid: "a", corpsName: "Blue Stars", prelimVotes: 4 }],
      prelimsResults: {
        28: [
          { uid: "a", corpsName: "Blue Stars", votes: 2, place: 1, seasonVotes: 2 },
          { uid: "b", corpsName: "Colts", votes: 2, place: 1, seasonVotes: 2 },
          // Behind a two-way tie for first, the next corps is THIRD.
          { uid: "c", corpsName: "Cavaliers", votes: 1, place: 3, seasonVotes: 3 },
        ],
      },
    });
    const value = payload.embeds[0].fields[0].value;
    assert.match(value, /🥇 \*\*Blue Stars\*\* — 2 votes/);
    assert.match(value, /🥇 \*\*Colts\*\* — 2 votes/);
    assert.ok(!value.includes("🥈"), "second place was not awarded — nobody finished second");
    // A corps ahead of its count on the season says why it outranks a tie.
    assert.match(value, /🥉 \*\*Cavaliers\*\* — 1 vote _\(3 votes across the majors\)_/);
  });

  test("a crown the ballot tied says WHICH tiebreaker decided it", () => {
    // Two corps on five votes and one trophy: the post prints the rule and the
    // two numbers it turned on, so the call can be checked against the results
    // instead of taken on faith.
    const crown = (tiebreak) =>
      fanFavoriteDiscord.buildWinnerPayload({
        seasonName: "Season 12",
        winner: {
          corpsName: "Blue Stars",
          finalsVotes: 5,
          tiedWith: ["Colts"],
          tiebreak: { rival: "Colts", ...tiebreak },
        },
        finalsResults: [
          { corpsName: "Blue Stars", votes: 5, place: 1 },
          { corpsName: "Colts", votes: 5, place: 1 },
        ],
      }).embeds[0].description;

    const season = crown({ rule: "seasonVotes", winnerValue: 9, rivalValue: 6 });
    assert.match(season, /level with \*\*Colts\*\*/);
    assert.match(season, /9 votes across the three majors to \*\*Colts\*\*'s 6 votes/);

    const breadth = crown({ rule: "majorsPolled", winnerValue: 3, rivalValue: 2 });
    assert.match(breadth, /polled widest/);
    assert.match(breadth, /support at 3 of the three majors, \*\*Colts\*\* at 2/);

    const recent = crown({ rule: "majorLead", major: 41, winnerValue: 4, rivalValue: 2 });
    assert.match(recent, /most recent room to separate them — the Eastern Classic/);
    assert.match(recent, /4 votes to \*\*Colts\*\*'s 2 votes/);

    const arrival = crown({
      rule: "firstToCount",
      winnerValue: "2026-08-02T09:00:00.000Z",
      rivalValue: "2026-08-02T11:00:00.000Z",
    });
    assert.match(arrival, /reached the winning total ahead of \*\*Colts\*\*/);

    // The one step that is a coin flip is named as a coin flip.
    const draw = crown({ rule: "draw" });
    assert.match(draw, /nothing in the ballots separated them/);
    assert.match(draw, /seeded draw — a coin flip, and it is being called one/);
    assert.match(draw, /the plaque holds one name/);
  });

  test("an outright crown claims no tiebreaker, and old crowns keep their copy", () => {
    const outright = fanFavoriteDiscord.buildWinnerPayload({
      seasonName: "Season 12",
      winner: { corpsName: "Blue Stars", finalsVotes: 7 },
    });
    assert.ok(!outright.embeds[0].description.includes("finished level"));
    assert.ok(!outright.embeds[0].description.includes("tiebreak"));

    // Seasons crowned before the cascade existed have `tiedWith` and no rule —
    // they are still announced as the dead-even ballots they were.
    const legacy = fanFavoriteDiscord.buildWinnerPayload({
      seasonName: "Season 11",
      winner: { corpsName: "Blue Stars", finalsVotes: 5, tiedWith: ["Colts"] },
    });
    assert.match(legacy.embeds[0].description, /the room split it/);
  });

  test("a huge ballot is truncated inside Discord's field limit", () => {
    const lines = Array.from({ length: 200 }, (_, i) => `• Corps Number ${i}`);
    const value = fanFavoriteDiscord.joinLines(lines);
    assert.ok(value.length <= 1024, `field value was ${value.length} chars`);
    assert.match(value, /…and \d+ more$/);
  });
});

describe("Fan Favorite announcement stage", () => {
  const season = { seasonUid: "s1", seasonName: "Season 12", cfg, webhookUrl: "https://d.test/h" };

  test("the night a major is scored, the ballot post goes out once", async () => {
    const db = fakeDb({
      "podium-recaps/s1/days/28": {
        shows: [
          {
            results: [
              { uid: "a", corpsName: "Blue Stars", division: "worldClass" },
              { uid: "b", corpsName: "Colts", division: "openClass" },
            ],
          },
        ],
      },
    });
    const posts = [];
    const args = { ...season, competitionDay: 28, fetchImpl: recordingFetch(posts) };

    const first = await fanFavoriteDiscord.announceFanFavorite(db, args);
    assert.deepEqual(first, [{ kind: "prelims-open", status: "posted" }]);
    assert.equal(posts.length, 1);
    assert.match(posts[0].payload.embeds[0].title, /Southwestern/);
    // voteWindowDays 3 from the major itself: votes close after day 30.
    assert.match(posts[0].payload.embeds[0].description, /Day 30/);
    assert.equal(db.writes["scoring_runs/s1_fanfav_prelims_day28"].status, "completed");

    // Re-running the stage (every night, and on scheduler retries) is a no-op.
    const second = await fanFavoriteDiscord.announceFanFavorite(db, args);
    assert.deepEqual(second, [{ kind: "prelims-open", status: "skipped", reason: "completed" }]);
    assert.equal(posts.length, 1);
  });

  test("a dark major announces nothing and leaves the lease unclaimed", async () => {
    const db = fakeDb({});
    const posts = [];
    const result = await fanFavoriteDiscord.announceFanFavorite(db, {
      ...season,
      competitionDay: 35,
      fetchImpl: recordingFetch(posts),
    });
    assert.deepEqual(result, [{ kind: "prelims-open", status: "no-candidates", major: 35 }]);
    assert.equal(posts.length, 0);
    assert.equal(db.writes["scoring_runs/s1_fanfav_prelims_day35"], undefined);
  });

  test("published finalists trigger the finals post; a crowned season doesn't", async () => {
    const docs = {
      "podium-fan/s1": {
        finalists: [{ uid: "a", corpsName: "Blue Stars", prelimVotes: 9 }],
        prelimsResults: { 28: [{ uid: "a", corpsName: "Blue Stars", votes: 9 }] },
      },
    };
    const db = fakeDb(docs);
    const posts = [];
    const args = { ...season, competitionDay: 44, fetchImpl: recordingFetch(posts) };

    assert.deepEqual(await fanFavoriteDiscord.announceFanFavorite(db, args), [
      { kind: "finals-open", status: "posted" },
    ]);
    assert.match(posts[0].payload.embeds[0].title, /finals/i);

    // Once the winner is crowned the finals ballot is over: no re-open post,
    // and the crown announcement takes its place.
    docs["podium-fan/s1"].winner = { uid: "a", corpsName: "Blue Stars", finalsVotes: 5 };
    docs["podium-fan/s1"].finalsResults = [{ uid: "a", corpsName: "Blue Stars", votes: 5 }];
    const crowned = await fanFavoriteDiscord.announceFanFavorite(db, { ...args, competitionDay: 49 });
    assert.deepEqual(crowned, [{ kind: "crowned", status: "posted" }]);
    assert.equal(posts.length, 2);
    assert.match(posts[1].payload.embeds[0].title, /Blue Stars is the Season 12 Fan Favorite/);
  });

  test("the winner post is skipped until a season is actually crowned", async () => {
    const db = fakeDb({ "podium-fan/s0": { finalists: [{ uid: "a", corpsName: "X" }] } });
    const posts = [];
    assert.deepEqual(
      await fanFavoriteDiscord.announceFanFavoriteWinner(db, {
        seasonUid: "s0",
        seasonName: "Season 11",
        webhookUrl: season.webhookUrl,
        fetchImpl: recordingFetch(posts),
      }),
      { kind: "crowned", status: "no-winner", seasonUid: "s0" }
    );
    assert.equal(posts.length, 0);
  });

  test("a Discord outage fails the lease so the next night re-posts", async () => {
    const db = fakeDb({
      "podium-fan/s1": { winner: { uid: "a", corpsName: "Blue Stars", finalsVotes: 3 } },
    });
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      if (attempts === 1) return { ok: false, status: 500, text: async () => "boom" };
      return { ok: true, status: 204, text: async () => "" };
    };
    const args = {
      seasonUid: "s1",
      seasonName: "Season 12",
      webhookUrl: season.webhookUrl,
      fetchImpl,
    };

    const failed = await fanFavoriteDiscord.announceFanFavoriteWinner(db, args);
    assert.equal(failed.status, "failed");
    assert.equal(db.writes["scoring_runs/s1_fanfav_winner_day0"].status, "failed");

    const retried = await fanFavoriteDiscord.announceFanFavoriteWinner(db, args);
    assert.equal(retried.status, "posted");
    assert.equal(attempts, 2);
  });
});
