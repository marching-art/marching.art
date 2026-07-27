// Registration deadlines → #announcements: which week each class's warning
// fires, that it fires exactly once, and that the copy matches the rule
// callable/corps.js actually enforces.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const registrationAnnounce = require("./registrationAnnounce");
const { getRegistrationLock } = require("./registrationLock");

const NOW = new Date("2026-06-01T12:00:00Z");
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** A season ending `weeks` whole weeks after NOW. */
function seasonEndingIn(weeks) {
  const end = new Date(NOW.getTime() + weeks * WEEK_MS);
  return {
    seasonUid: "s12",
    name: "Season 12",
    schedule: { endDate: { toDate: () => end } },
  };
}

/** Fake Firestore: doc reads from a path map, recorded writes, lease txn. */
function fakeDb(docs = {}) {
  const writes = {};
  const makeDocRef = (path) => ({
    path,
    get: async () => ({
      exists: Object.prototype.hasOwnProperty.call(docs, path),
      data: () => docs[path],
    }),
    set: async (data) => {
      writes[path] = data;
      docs[path] = data;
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

describe("which classes close this week", () => {
  test("each class warns in the last week it is still open", () => {
    const closing = (weeks) =>
      registrationAnnounce
        .classesClosingThisWeek(seasonEndingIn(weeks), NOW)
        .classes.map((c) => c.corpsClass);

    assert.deepEqual(closing(6), ["worldClass"]);
    assert.deepEqual(closing(5), ["openClass"]);
    assert.deepEqual(closing(4), ["aClass"]);
  });

  test("the warning week is the last week registration is actually OPEN", () => {
    // The post is only useful if you can still act on it. Pin it against the
    // rule callable/corps.js enforces, not against a copy of the numbers.
    for (const [corpsClass, weeks] of [
      ["worldClass", 6],
      ["openClass", 5],
      ["aClass", 4],
    ]) {
      const season = seasonEndingIn(weeks);
      assert.deepEqual(
        registrationAnnounce.classesClosingThisWeek(season, NOW).classes.map((c) => c.corpsClass),
        [corpsClass]
      );
      // Open on the day we post...
      assert.equal(getRegistrationLock(season, corpsClass, NOW).locked, false);
      // ...and locked a week later.
      const nextWeek = new Date(NOW.getTime() + WEEK_MS);
      assert.equal(getRegistrationLock(season, corpsClass, nextWeek).locked, true);
    }
  });

  test("quiet on every other week of the season", () => {
    for (const weeks of [12, 9, 7, 3, 2, 1]) {
      assert.deepEqual(
        registrationAnnounce.classesClosingThisWeek(seasonEndingIn(weeks), NOW).classes,
        [],
        `${weeks} weeks out should be quiet`
      );
    }
  });

  test("classes that never lock never warn", () => {
    // SoundSport and Podium carry registrationLockWeeks: 0 — open all season.
    for (const weeks of [6, 5, 4, 3, 2, 1]) {
      const named = registrationAnnounce
        .classesClosingThisWeek(seasonEndingIn(weeks), NOW)
        .classes.map((c) => c.corpsClass);
      assert.ok(!named.includes("soundSport"));
      assert.ok(!named.includes("podiumClass"));
    }
  });

  test("a season with no end date is silent, not crashy", () => {
    assert.deepEqual(
      registrationAnnounce.classesClosingThisWeek({ seasonUid: "s12", schedule: {} }, NOW),
      { weeksRemaining: null, classes: [] }
    );
    assert.deepEqual(registrationAnnounce.classesClosingThisWeek(null, NOW).classes, []);
  });
});

describe("the deadline embed", () => {
  test("names the class, the deadline, and what it does not affect", () => {
    const payload = registrationAnnounce.buildRegistrationDeadlinePayload({
      seasonName: "Season 12",
      weeksRemaining: 6,
      classes: [{ corpsClass: "worldClass", lockWeeks: 6 }],
    });
    const embed = payload.embeds[0];

    assert.match(embed.title, /Last week to start a World Class corps/);
    assert.match(embed.description, /Season 12 — World Class registration closes/);
    assert.match(embed.description, /6 weeks remain/);
    assert.equal(embed.fields.length, 1);
    assert.match(embed.fields[0].value, /Locks 6 weeks before finals/);
    // The lock blocks starting a corps, not running one.
    assert.match(embed.footer.text, /one you already have keeps competing/);
    assert.deepEqual(payload.allowed_mentions, { parse: [] });
  });

  test("reads as a list when two classes ever close together", () => {
    const payload = registrationAnnounce.buildRegistrationDeadlinePayload({
      seasonName: "Season 12",
      weeksRemaining: 4,
      classes: [
        { corpsClass: "openClass", lockWeeks: 4 },
        { corpsClass: "aClass", lockWeeks: 4 },
      ],
    });
    assert.match(payload.embeds[0].title, /Open Class and A Class corps/);
    assert.equal(payload.embeds[0].fields.length, 2);
  });

  test("singular week reads correctly", () => {
    const payload = registrationAnnounce.buildRegistrationDeadlinePayload({
      seasonName: "S",
      weeksRemaining: 1,
      classes: [{ corpsClass: "aClass", lockWeeks: 1 }],
    });
    assert.match(payload.embeds[0].description, /1 week remain/);
  });

  test("null when nothing closes", () => {
    assert.equal(
      registrationAnnounce.buildRegistrationDeadlinePayload({
        seasonName: "S",
        weeksRemaining: 9,
        classes: [],
      }),
      null
    );
  });
});

describe("posting the deadline", () => {
  test("posts once per closing week, however often the daily job runs", async () => {
    const db = fakeDb();
    const posts = [];
    const args = {
      seasonUid: "s12",
      seasonName: "Season 12",
      seasonData: seasonEndingIn(6),
      webhookUrl: "https://discord.test/hook",
      fetchImpl: recordingFetch(posts),
      now: NOW,
    };

    assert.equal((await registrationAnnounce.announceRegistrationDeadline(db, args)).status, "posted");
    assert.equal(posts.length, 1);
    assert.match(posts[0].payload.embeds[0].title, /World Class/);

    // Same week, next day's run: weeksRemaining is unchanged, lease is taken.
    const nextDay = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const again = await registrationAnnounce.announceRegistrationDeadline(db, {
      ...args,
      seasonData: seasonEndingIn(6),
      now: nextDay,
    });
    assert.equal(again.status, "skipped");
    assert.equal(posts.length, 1);
  });

  test("each class gets its own post — separate leases, separate weeks", async () => {
    const db = fakeDb();
    const posts = [];
    for (const weeks of [6, 5, 4]) {
      await registrationAnnounce.announceRegistrationDeadline(db, {
        seasonUid: "s12",
        seasonName: "Season 12",
        seasonData: seasonEndingIn(weeks),
        webhookUrl: "https://discord.test/hook",
        fetchImpl: recordingFetch(posts),
        now: NOW,
      });
    }
    assert.equal(posts.length, 3);
    assert.match(posts[0].payload.embeds[0].title, /World Class/);
    assert.match(posts[1].payload.embeds[0].title, /Open Class/);
    assert.match(posts[2].payload.embeds[0].title, /A Class/);
  });

  test("an ordinary day claims no lease and posts nothing", async () => {
    const db = fakeDb();
    const posts = [];
    const result = await registrationAnnounce.announceRegistrationDeadline(db, {
      seasonUid: "s12",
      seasonName: "Season 12",
      seasonData: seasonEndingIn(9),
      webhookUrl: "https://discord.test/hook",
      fetchImpl: recordingFetch(posts),
      now: NOW,
    });
    assert.equal(result.status, "nothing-closing");
    assert.equal(posts.length, 0);
    assert.deepEqual(db.writes, {});
  });

  test("disabled without a webhook", async () => {
    const result = await registrationAnnounce.announceRegistrationDeadline(fakeDb(), {
      seasonUid: "s12",
      seasonName: "S",
      seasonData: seasonEndingIn(6),
      webhookUrl: "",
      now: NOW,
    });
    assert.equal(result.status, "disabled");
  });
});
