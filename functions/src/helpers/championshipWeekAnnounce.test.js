// Championship Week caption-change guide → #announcements: that it posts on
// day 43 and only day 43, that it posts once, and — the point of the whole
// module — that every claim in the copy matches what getCaptionChangeWindow
// actually enforces, class by class and day by day.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const championshipWeekAnnounce = require("./championshipWeekAnnounce");
const {
  getCaptionChangeWindow,
  CHAMPIONSHIP_TRADE_LIMIT,
  CHAMPIONSHIP_CLASS_DAYS,
  SEASON_FINAL_DAY,
} = require("./captionWindows");

const DAY_MS = 24 * 60 * 60 * 1000;
// A Sunday at midnight UTC — the shape the admin tool writes, and the shape
// that puts day boundaries at 8 PM ET.
const START = new Date("2026-06-14T00:00:00Z");
const SEASON = {
  seasonUid: "s12",
  name: "Season 12",
  schedule: { startDate: START, springTrainingDays: 0 },
};

/** Mid-afternoon ET on a competition day — when the daily job runs. */
function onDay(day) {
  return new Date(START.getTime() + (day - 1) * DAY_MS + 20 * 60 * 60 * 1000);
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

describe("the schedule the post describes", () => {
  test("covers every remaining day of the season, in order", () => {
    const rows = championshipWeekAnnounce.championshipWeekSchedule(SEASON);
    assert.deepEqual(
      rows.map((r) => r.day),
      [43, 44, 45, 46, 47, 48, 49]
    );
  });

  test("every day/class claim matches what saveLineup enforces", () => {
    // The whole reason the post is generated rather than written: a director
    // acting on it must not be told "yes" by Discord and "no" by the game.
    const rows = championshipWeekAnnounce.championshipWeekSchedule(SEASON);
    for (const { day, classes } of rows) {
      for (const corpsClass of championshipWeekAnnounce.CLASS_ORDER) {
        const window = getCaptionChangeWindow(SEASON, onDay(day), corpsClass);
        const announcedOpen = classes.includes(corpsClass);
        assert.equal(
          window.status === "open",
          announcedOpen,
          `Day ${day} ${corpsClass}: post says ${announcedOpen ? "open" : "closed"}, ` +
            `enforcement says ${window.status}`
        );
        if (announcedOpen) {
          assert.equal(window.tradeLimit, CHAMPIONSHIP_TRADE_LIMIT, `Day ${day} ${corpsClass}`);
        }
      }
    }
  });

  test("the two blackout days are closed to everyone", () => {
    const closed = championshipWeekAnnounce
      .championshipWeekSchedule(SEASON)
      .filter((r) => r.classes.length === 0)
      .map((r) => r.day);
    assert.deepEqual(closed, [43, 44]);
  });

  test("weekday labels come from the season's own calendar", () => {
    // Day 49 is finals Saturday; day 43 is the Sunday the post goes out.
    const rows = championshipWeekAnnounce.championshipWeekSchedule(SEASON);
    assert.match(rows[0].dateLabel, /^Sun,/);
    assert.match(rows[rows.length - 1].dateLabel, /^Sat,/);
  });

  test("a season with no start date still lists the days, without dates", () => {
    const rows = championshipWeekAnnounce.championshipWeekSchedule({ seasonUid: "s12" });
    assert.equal(rows.length, 7);
    assert.equal(rows[0].dateLabel, null);
  });

  test("spring training shifts the dates, never the day numbers", () => {
    const live = {
      ...SEASON,
      schedule: { startDate: START, springTrainingDays: 21 },
    };
    const rows = championshipWeekAnnounce.championshipWeekSchedule(live);
    assert.deepEqual(
      rows.map((r) => r.day),
      [43, 44, 45, 46, 47, 48, 49]
    );
    // Three weeks later, same weekdays.
    assert.match(rows[0].dateLabel, /^Sun,/);
    assert.match(rows[rows.length - 1].dateLabel, /^Sat,/);
  });
});

describe("the per-class view", () => {
  test("inverts the bracket without contradicting it", () => {
    for (const { corpsClass, days } of championshipWeekAnnounce.daysByClass()) {
      for (let day = 45; day <= SEASON_FINAL_DAY; day++) {
        assert.equal(
          days.includes(day),
          (CHAMPIONSHIP_CLASS_DAYS[day] || []).includes(corpsClass),
          `${corpsClass} on day ${day}`
        );
      }
    }
  });

  test("every class gets the same number of change days", () => {
    const byClass = championshipWeekAnnounce.daysByClass();
    assert.deepEqual(
      byClass.map((c) => c.corpsClass),
      ["worldClass", "openClass", "aClass", "soundSport"]
    );
    // The symmetry the footer claims — 3 days, 6 changes, for everyone.
    for (const { corpsClass, days } of byClass) {
      assert.equal(days.length, 3, corpsClass);
    }
  });
});

describe("the guide embed", () => {
  const embed = championshipWeekAnnounce.buildChampionshipWeekPayload({
    seasonName: "Season 12",
    seasonData: SEASON,
  }).embeds[0];

  test("names the closed days up front", () => {
    assert.match(embed.description, /Season 12/);
    assert.match(embed.description, /closed to every class\*\* for 2 days \(Days 43 and 44\)/);
    assert.match(embed.description, /2 changes per day/);
  });

  test("lists every day with its classes and its allotment", () => {
    const dayByDay = embed.fields[0].value;
    assert.match(dayByDay, /`Day 43 · Sun, [A-Z][a-z]{2} \d+` — 🔒 \*\*Closed to every class\*\*/);
    assert.match(dayByDay, /`Day 44 .*` — 🔒/);
    assert.match(dayByDay, /`Day 45 .*` — ✅ Open Class, A Class · 2 changes each/);
    assert.match(dayByDay, /`Day 47 .*` — ✅ World Class, Open Class, A Class, SoundSport/);
    assert.match(dayByDay, /`Day 49 · Sat, .*` — ✅ World Class, SoundSport · 2 changes each/);
    // No truncation: all seven days survive Discord's field limit.
    assert.equal(dayByDay.split("\n").length, 7);
    assert.ok(dayByDay.length <= 1024);
  });

  test("answers 'which days can MY class change?' directly", () => {
    const byClass = embed.fields[1].value;
    assert.match(byClass, /\*\*World Class\*\* — Days 47, 48, 49 \(6 changes total\)/);
    assert.match(byClass, /\*\*Open Class\*\* — Days 45, 46, 47 \(6 changes total\)/);
    assert.match(byClass, /\*\*A Class\*\* — Days 45, 46, 47 \(6 changes total\)/);
    assert.match(byClass, /\*\*SoundSport\*\* — Days 47, 48, 49 \(6 changes total\)/);
  });

  test("states the daily reset, the close time, and the lockout", () => {
    const rules = embed.fields[2].value;
    // 8 PM ET is the day boundary this season actually uses, not a guess.
    assert.match(rules, /close at 8:00 PM ET/);
    assert.match(rules, /reopen once that night's scores post/);
    assert.match(rules, /never carry over/);
    // The line that stops "my corps advanced, why can't I edit?".
    assert.match(rules, /even if your corps advanced/);
  });

  test("the footer explains why the days are split the way they are", () => {
    assert.match(embed.footer.text, /same 3 change days and the same 6 total changes/);
  });

  test("pings nobody", () => {
    const payload = championshipWeekAnnounce.buildChampionshipWeekPayload({
      seasonName: "Season 12",
      seasonData: SEASON,
    });
    assert.deepEqual(payload.allowed_mentions, { parse: [] });
  });

  test("renders without a start date", () => {
    const noDates = championshipWeekAnnounce.buildChampionshipWeekPayload({
      seasonName: "Season 12",
    }).embeds[0];
    assert.match(noDates.fields[0].value, /`Day 43` — 🔒/);
    assert.match(noDates.fields[2].value, /close at 8:00 PM ET/);
  });
});

describe("posting the guide", () => {
  const args = (overrides) => ({
    seasonUid: "s12",
    seasonName: "Season 12",
    seasonData: SEASON,
    webhookUrl: "https://discord.test/hook",
    ...overrides,
  });

  test("posts on day 43, once, however often the daily job runs", async () => {
    const db = fakeDb();
    const posts = [];
    const first = await championshipWeekAnnounce.announceChampionshipWeek(
      db,
      args({ fetchImpl: recordingFetch(posts), now: onDay(43) })
    );
    assert.equal(first.status, "posted");
    assert.equal(posts.length, 1);
    assert.match(posts[0].payload.embeds[0].title, /Championship Week/);

    // A retry later the same day finds the lease taken.
    const again = await championshipWeekAnnounce.announceChampionshipWeek(
      db,
      args({
        fetchImpl: recordingFetch(posts),
        now: new Date(onDay(43).getTime() + 60 * 60 * 1000),
      })
    );
    assert.equal(again.status, "skipped");
    assert.equal(posts.length, 1);
  });

  test("silent on every other day of the season, with no writes", async () => {
    for (const day of [1, 14, 42, 44, 45, 47, 49, 50]) {
      const db = fakeDb();
      const posts = [];
      const result = await championshipWeekAnnounce.announceChampionshipWeek(
        db,
        args({ fetchImpl: recordingFetch(posts), now: onDay(day) })
      );
      assert.equal(result.status, "not-today", `day ${day}`);
      assert.equal(posts.length, 0);
      assert.deepEqual(db.writes, {});
    }
  });

  test("a season with no start date is silent, not crashy", async () => {
    const result = await championshipWeekAnnounce.announceChampionshipWeek(
      fakeDb(),
      args({ seasonData: { seasonUid: "s12", schedule: {} }, now: onDay(43) })
    );
    assert.equal(result.status, "no-season");
  });

  test("disabled without a webhook", async () => {
    const result = await championshipWeekAnnounce.announceChampionshipWeek(
      fakeDb(),
      args({ webhookUrl: "", now: onDay(43) })
    );
    assert.equal(result.status, "disabled");
  });
});
