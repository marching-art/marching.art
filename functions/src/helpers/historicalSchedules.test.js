// Tests for mergeEventIntoHistoricalSchedules — the additive, idempotent merge
// that archives running orders + performance times into historical_schedules/{year}.
// A fake Firestore transaction records set/update calls so the merge rules can be
// asserted without an emulator. Mirrors historicalScores.test.js.
//
// Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { mergeEventIntoHistoricalSchedules, buildScheduleEventData } = require("./historicalSchedules");

// Fake Firestore where historical_schedules/{year} maps to `stored` (or absent).
function makeDb(stored) {
  const writes = [];
  const db = {
    collection(name) {
      assert.equal(name, "historical_schedules");
      return { doc: (id) => ({ id, _name: name }) };
    },
    async runTransaction(fn) {
      const transaction = {
        async get() {
          return { exists: stored !== undefined, data: () => stored };
        },
        set(ref, data) {
          writes.push({ type: "set", data });
        },
        update(ref, data) {
          writes.push({ type: "update", data });
        },
      };
      return fn(transaction);
    },
  };
  return { db, writes };
}

const lineupEntry = (overrides = {}) => ({
  order: 1,
  corps: "Blue Devils",
  hometown: "Concord, CA",
  performanceTime: "9:40 PM",
  performsAt: "2024-07-15T01:40:00.000Z",
  ...overrides,
});

const event = (overrides = {}) => ({
  eventName: "DCI Capital Classic",
  date: "2024-07-15",
  location: "Sacramento, CA",
  venue: "Sacramento High",
  timezone: "America/Los_Angeles",
  gatesAt: null,
  startsAt: "2024-07-15T01:00:00.000Z",
  scoresAt: null,
  offSeasonDay: 10,
  lineup: [lineupEntry()],
  ...overrides,
});

describe("mergeEventIntoHistoricalSchedules", () => {
  test("creates the year document when it does not exist", async () => {
    const { db, writes } = makeDb(undefined);
    await mergeEventIntoHistoricalSchedules(db, 2024, event());

    assert.equal(writes.length, 1);
    assert.equal(writes[0].type, "set");
    assert.deepEqual(writes[0].data.data, [event()]);
  });

  test("appends a new event to an existing year document", async () => {
    const existing = event({ eventName: "DCI Southwestern", date: "2024-07-20" });
    const { db, writes } = makeDb({ data: [existing] });
    await mergeEventIntoHistoricalSchedules(db, 2024, event());

    assert.equal(writes[0].type, "update");
    assert.equal(writes[0].data.data.length, 2);
    assert.equal(writes[0].data.data[1].eventName, "DCI Capital Classic");
  });

  test("adds a missing lineup corps to an already-present event", async () => {
    const existing = event(); // has only Blue Devils
    const incoming = event({
      lineup: [
        lineupEntry(),
        lineupEntry({ order: 2, corps: "Bluecoats", hometown: "Canton, OH" }),
      ],
    });
    const { db, writes } = makeDb({ data: [existing] });
    await mergeEventIntoHistoricalSchedules(db, 2024, incoming);

    assert.equal(writes[0].type, "update");
    const corps = writes[0].data.data[0].lineup.map((l) => l.corps);
    assert.deepEqual(corps, ["Blue Devils", "Bluecoats"]);
  });

  test("fills only blank per-corps fields, never overwriting existing values", async () => {
    const existing = event({
      lineup: [lineupEntry({ hometown: null, performsAt: null })],
    });
    const incoming = event({
      lineup: [lineupEntry({ hometown: "Somewhere, CA", performsAt: "2024-07-15T02:00:00.000Z" })],
    });
    const { db, writes } = makeDb({ data: [existing] });
    await mergeEventIntoHistoricalSchedules(db, 2024, incoming);

    const entry = writes[0].data.data[0].lineup[0];
    assert.equal(entry.hometown, "Somewhere, CA"); // blank filled
    assert.equal(entry.performsAt, "2024-07-15T02:00:00.000Z"); // blank filled
    assert.equal(entry.performanceTime, "9:40 PM"); // existing preserved
  });

  test("fills blank scalar timing fields but preserves existing ones", async () => {
    const existing = event({ gatesAt: null, venue: "Old Venue" });
    const incoming = event({ gatesAt: "2024-07-15T00:30:00.000Z", venue: "New Venue" });
    const { db, writes } = makeDb({ data: [existing] });
    await mergeEventIntoHistoricalSchedules(db, 2024, incoming);

    const merged = writes[0].data.data[0];
    assert.equal(merged.gatesAt, "2024-07-15T00:30:00.000Z"); // blank filled
    assert.equal(merged.venue, "Old Venue"); // existing preserved
  });

  test("skips the write when there is nothing new to merge", async () => {
    const existing = event();
    const { db, writes } = makeDb({ data: [existing] });
    await mergeEventIntoHistoricalSchedules(db, 2024, event()); // identical

    assert.equal(writes.length, 0);
  });

  test("matches events by name AND date (same name, different date appends)", async () => {
    const existing = event({ date: "2024-07-15" });
    const incoming = event({ date: "2024-07-16" });
    const { db, writes } = makeDb({ data: [existing] });
    await mergeEventIntoHistoricalSchedules(db, 2024, incoming);

    assert.equal(writes[0].type, "update");
    assert.equal(writes[0].data.data.length, 2);
  });

  test("matches lineup corps case/space-insensitively (no duplicate rows)", async () => {
    const existing = event({ lineup: [lineupEntry({ corps: "Blue Devils" })] });
    const incoming = event({ lineup: [lineupEntry({ corps: "  blue   devils " })] });
    const { db, writes } = makeDb({ data: [existing] });
    await mergeEventIntoHistoricalSchedules(db, 2024, incoming);

    // Nothing new (same corps, all fields already present) -> no write.
    assert.equal(writes.length, 0);
  });
});

describe("buildScheduleEventData", () => {
  test("returns null when the event has no date or name", () => {
    assert.equal(buildScheduleEventData({ eventName: "X", lineup: [lineupEntry()] }), null);
    assert.equal(buildScheduleEventData({ date: "2024-07-15", lineup: [lineupEntry()] }), null);
  });

  test("returns null when there is neither a lineup nor a start time", () => {
    assert.equal(
      buildScheduleEventData({ eventName: "X", date: "2024-07-15", lineup: [], startsAt: null }),
      null
    );
  });

  test("derives year and normalizes fields for an archivable event", () => {
    const built = buildScheduleEventData({
      eventName: "DCI Capital Classic",
      date: "2024-07-15T00:00:00.000Z",
      location: "Sacramento, CA",
      startsAt: "2024-07-15T01:00:00.000Z",
      lineup: [lineupEntry()],
    });
    assert.equal(built.year, 2024);
    assert.equal(built.data.eventName, "DCI Capital Classic");
    assert.equal(built.data.lineup.length, 1);
    // offSeasonDay is computed via season.calculateOffSeasonDay (number or null).
    assert.ok(built.data.offSeasonDay === null || typeof built.data.offSeasonDay === "number");
  });
});
