// Tests for the Phase 1.2 nightly Podium stage: flag gating, day context
// (including spring training, which the fantasy path skips), and the
// self-contained season reads. Fake Firestore, no emulator.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const { runPodiumStage, runDiscordStage } = require("./nightlyStages");
const { resetFeatureCache } = require("../helpers/features");

/**
 * Fake Firestore covering everything the stage + processor touch: doc reads
 * from a path->data map, doc writes (recorded), empty collections (roster),
 * and the run-guard's lease transaction.
 */
function fakeDb(docs) {
  const writes = {};
  const makeDocRef = (path) => ({
    path,
    get: async () => ({
      exists: Object.prototype.hasOwnProperty.call(docs, path),
      data: () => docs[path],
    }),
    set: async (data) => {
      writes[path] = data;
    },
  });
  const db = {
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
        },
      }),
  };
  return db;
}

/** Season start `daysAgo` full days before now, at UTC midnight, as a fake Timestamp. */
function startDaysAgo(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(0, 0, 0, 0);
  return { toDate: () => d };
}

describe("nightly Podium stage", () => {
  beforeEach(() => resetFeatureCache());

  test("disabled when the features doc is missing", async () => {
    const db = fakeDb({});
    assert.deepEqual(await runPodiumStage(db), { status: "disabled" });
  });

  test("disabled when the flag is explicitly false", async () => {
    const db = fakeDb({ "game-settings/features": { podiumClass: false } });
    assert.deepEqual(await runPodiumStage(db), { status: "disabled" });
  });

  test("enabled + off-season: processor runs (empty roster) with competition day = calendar day", async () => {
    const db = fakeDb({
      "game-settings/features": { podiumClass: true },
      "game-settings/season": {
        status: "off-season",
        seasonUid: "test_season",
        schedule: { startDate: startDaysAgo(10) },
      },
    });
    const result = await runPodiumStage(db);
    assert.equal(result.status, "completed");
    assert.equal(result.corps, 0);
    assert.equal(result.calendarDay, result.competitionDay);
    assert.ok(result.calendarDay >= 9 && result.calendarDay <= 11);
    // The lease was claimed and completed under the podium-specific key.
    const leasePath = `scoring_runs/test_season_podium_day${result.calendarDay}`;
    assert.ok(db.writes[leasePath], "podium lease doc must be written");
  });

  test("enabled + live-season spring training: processor RUNS with competitionDay < 1", async () => {
    const db = fakeDb({
      "game-settings/features": { podiumClass: true },
      "game-settings/season": {
        status: "live-season",
        seasonUid: "test_live",
        schedule: { startDate: startDaysAgo(5), springTrainingDays: 21 },
      },
    });
    const result = await runPodiumStage(db);
    // The fantasy path exits during spring training; the Podium stage must not.
    assert.equal(result.status, "completed");
    assert.ok(result.competitionDay < 1, `competitionDay ${result.competitionDay} should be < 1`);
  });

  test("season over: skipped past competition day 49", async () => {
    const db = fakeDb({
      "game-settings/features": { podiumClass: true },
      "game-settings/season": {
        status: "off-season",
        schedule: { startDate: startDaysAgo(60) },
      },
    });
    assert.equal((await runPodiumStage(db)).status, "season-over");
  });

  test("no season doc: skipped safely", async () => {
    const db = fakeDb({ "game-settings/features": { podiumClass: true } });
    assert.equal((await runPodiumStage(db)).status, "no-season");
  });
});

describe("nightly Discord score-drop stage", () => {
  const okFetch = async () => ({ ok: true, status: 204, text: async () => "" });

  test("disabled when no webhook URL is configured", async () => {
    const db = fakeDb({});
    assert.deepEqual(await runDiscordStage(db, ""), { status: "disabled" });
    assert.deepEqual(await runDiscordStage(db, undefined), { status: "disabled" });
  });

  test("no season doc: skipped safely", async () => {
    const db = fakeDb({});
    assert.equal((await runDiscordStage(db, "https://d.test/h", okFetch)).status, "no-season");
  });

  test("live-season spring training: out of season, nothing posted", async () => {
    const db = fakeDb({
      "game-settings/season": {
        status: "live-season",
        seasonUid: "live",
        schedule: { startDate: startDaysAgo(5), springTrainingDays: 21 },
      },
    });
    const result = await runDiscordStage(db, "https://d.test/h", okFetch);
    assert.equal(result.status, "out-of-season");
    assert.ok(result.scoredDay < 1);
  });

  test("scored off-season day: posts the recap and completes the discord lease", async () => {
    let posted = null;
    const fetchImpl = async (url, options) => {
      posted = { url, body: JSON.parse(options.body) };
      return { ok: true, status: 204, text: async () => "" };
    };
    const recap = {
      shows: [
        {
          eventName: "Test Show",
          results: [
            { uid: "u1", displayName: "d", corpsClass: "worldClass", corpsName: "X", totalScore: 80 },
          ],
        },
      ],
    };
    const docs = {
      "game-settings/season": {
        status: "off-season",
        seasonUid: "test_season",
        name: "Offseason IX",
        schedule: { startDate: startDaysAgo(10) },
      },
    };
    // The derived completed day is 9-11 depending on the wall clock; seed
    // every plausible recap path so the stage finds one either way.
    for (const day of [9, 10, 11]) docs[`fantasy_recaps/test_season/days/${day}`] = recap;
    const db = fakeDb(docs);

    const result = await runDiscordStage(db, "https://d.test/h", fetchImpl);
    assert.equal(result.status, "posted");
    assert.ok(posted.body.embeds[0].title.includes(`Day ${result.scoredDay}`));
    assert.match(posted.body.embeds[0].description, /Offseason IX/);
    const leasePath = `scoring_runs/test_season_discord_day${result.scoredDay}`;
    assert.equal(db.writes[leasePath].status, "completed");
  });
});

describe("gameDay active-day helpers (Phase 1.3)", () => {
  const { getActiveCalendarDay, getCompletedCalendarDay, toCompetitionDay } =
    require("../helpers/gameDay");

  test("active day is always completed + 1", () => {
    const start = new Date(Date.UTC(2026, 5, 1));
    const now = new Date(Date.UTC(2026, 5, 20, 15, 0, 0));
    assert.equal(
      getActiveCalendarDay(start, now),
      getCompletedCalendarDay(start, now) + 1
    );
  });

  test("toCompetitionDay subtracts spring training for live seasons only", () => {
    const live = { status: "live-season", schedule: { springTrainingDays: 21 } };
    const off = { status: "off-season", schedule: {} };
    assert.equal(toCompetitionDay(25, live), 4);
    assert.equal(toCompetitionDay(25, off), 25);
    assert.equal(toCompetitionDay(5, live), -16);
  });
});
