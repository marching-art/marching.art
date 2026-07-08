// Tests for the learned-schedule generator: event filtering (all-age /
// placeholder / too-small) and buildLearnedScheduleEvent, which turns a
// historical_scores event into a synthesized running order with absolute times.
//
// Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  isAllAgeEvent,
  isPlaceholderEvent,
  buildLearnedScheduleEvent,
  MIN_FIELD,
} = require("./learnedSchedules");

const scoreEvent = (overrides = {}) => ({
  eventName: "DCI Capital Classic",
  date: "2015-07-01T00:00:00.000Z",
  location: "Sacramento, CA",
  offSeasonDay: 12,
  scores: [
    { corps: "Blue Devils", score: 92.0 },
    { corps: "Bluecoats", score: 90.5 },
    { corps: "Carolina Crown", score: 88.0 },
    { corps: "The Cavaliers", score: 85.0 },
    { corps: "Phantom Regiment", score: 80.0 },
  ],
  ...overrides,
});

describe("event filters", () => {
  test("isAllAgeEvent matches All-Age / DCA, not DCI", () => {
    assert.equal(isAllAgeEvent("DCI All-Age World Championship Finals"), true);
    assert.equal(isAllAgeEvent("All Age Prelims"), true);
    assert.equal(isAllAgeEvent("DCA Championships"), true);
    assert.equal(isAllAgeEvent("DCI World Championship Finals"), false);
    assert.equal(isAllAgeEvent("DCI Capital Classic"), false);
  });

  test("isPlaceholderEvent matches the pressbox placeholder prefix", () => {
    assert.equal(isPlaceholderEvent("DCI Competition - Somewhere, OH"), true);
    assert.equal(isPlaceholderEvent("DCI Capital Classic"), false);
  });
});

describe("buildLearnedScheduleEvent", () => {
  test("synthesizes an ordered running order with absolute times", () => {
    const rec = buildLearnedScheduleEvent(scoreEvent());
    assert.ok(rec);
    assert.equal(rec.source, "learned");
    assert.equal(rec.timezone, "America/Los_Angeles");
    assert.equal(rec.offSeasonDay, 12);
    assert.ok(rec.modelVersion);

    // Worst-to-best: lowest score performs first, highest last.
    assert.equal(rec.lineup[0].corps, "Phantom Regiment");
    assert.equal(rec.lineup[rec.lineup.length - 1].corps, "Blue Devils");
    assert.deepEqual(rec.lineup.map((e) => e.order), [1, 2, 3, 4, 5]);

    // Every entry has a local clock string and a valid, increasing instant.
    let prev = 0;
    rec.lineup.forEach((e) => {
      assert.match(e.performanceTime, /\d{1,2}:\d{2}\s[AP]M/);
      const t = new Date(e.performsAt).getTime();
      assert.ok(!isNaN(t) && t > prev, "performsAt should parse and increase");
      prev = t;
    });

    // Gates precede the first performer; scores follow the last.
    assert.ok(new Date(rec.gatesAt).getTime() < new Date(rec.startsAt).getTime());
    assert.ok(
      new Date(rec.scoresAt).getTime() >
      new Date(rec.lineup[rec.lineup.length - 1].performsAt).getTime()
    );
  });

  test("returns null for all-age, placeholder, undated, dayless, or tiny fields", () => {
    assert.equal(buildLearnedScheduleEvent(scoreEvent({ eventName: "All-Age Finals" })), null);
    assert.equal(buildLearnedScheduleEvent(scoreEvent({ eventName: "DCI Competition - X, OH" })), null);
    assert.equal(buildLearnedScheduleEvent(scoreEvent({ date: null })), null);
    assert.equal(buildLearnedScheduleEvent(scoreEvent({ offSeasonDay: null })), null);
    assert.equal(
      buildLearnedScheduleEvent(scoreEvent({ scores: scoreEvent().scores.slice(0, MIN_FIELD - 1) })),
      null
    );
  });

  test("ignores corps without a numeric score", () => {
    const rec = buildLearnedScheduleEvent(scoreEvent({
      scores: [
        { corps: "Blue Devils", score: 92.0 },
        { corps: "Bluecoats", score: 90.5 },
        { corps: "Ghost", score: null },
        { corps: "Carolina Crown", score: 88.0 },
        { corps: "The Cavaliers", score: 85.0 },
        { corps: "Phantom Regiment", score: 80.0 },
      ],
    }));
    assert.ok(rec);
    assert.equal(rec.lineup.length, 5);
    assert.ok(!rec.lineup.some((e) => e.corps === "Ghost"));
  });
});
