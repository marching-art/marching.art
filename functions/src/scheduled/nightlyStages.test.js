// Tests for the Phase 1.2 nightly Podium stage: flag gating, day context
// (including spring training, which the fantasy path skips), and the
// self-contained season reads. Fake Firestore, no emulator.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const { runPodiumStage } = require("./nightlyStages");
const { resetFeatureCache } = require("../helpers/features");

/** Minimal fake Firestore: doc(path).get() from a path->data map. */
function fakeDb(docs) {
  return {
    doc: (path) => ({
      get: async () => ({
        exists: Object.prototype.hasOwnProperty.call(docs, path),
        data: () => docs[path],
      }),
    }),
  };
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

  test("enabled + off-season: competition day equals calendar day", async () => {
    const db = fakeDb({
      "game-settings/features": { podiumClass: true },
      "game-settings/season": {
        status: "off-season",
        schedule: { startDate: startDaysAgo(10) },
      },
    });
    const result = await runPodiumStage(db);
    assert.equal(result.status, "noop");
    assert.equal(result.calendarDay, result.competitionDay);
    assert.ok(result.calendarDay >= 9 && result.calendarDay <= 11);
  });

  test("enabled + live-season spring training: stage RUNS with competitionDay < 1", async () => {
    const db = fakeDb({
      "game-settings/features": { podiumClass: true },
      "game-settings/season": {
        status: "live-season",
        schedule: { startDate: startDaysAgo(5), springTrainingDays: 21 },
      },
    });
    const result = await runPodiumStage(db);
    // The fantasy path exits during spring training; the Podium stage must not.
    assert.equal(result.status, "noop");
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
