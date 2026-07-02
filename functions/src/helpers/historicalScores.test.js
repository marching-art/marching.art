// Tests for mergeEventIntoHistoricalScores — the additive, idempotent merge
// shared by the DCI and live-score recap pubsub handlers. A fake Firestore
// transaction records set/update calls so the merge rules can be asserted
// without an emulator.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { mergeEventIntoHistoricalScores } = require("./historicalScores");

// Fake Firestore where historical_scores/{year} maps to `stored` (or absent).
function makeDb(stored) {
  const writes = [];
  const db = {
    collection(name) {
      assert.equal(name, "historical_scores");
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

const event = (overrides = {}) => ({
  eventName: "Regional Championship",
  date: "2024-07-15",
  location: "Anywhere",
  scores: [{ corps: "Blue Devils", captions: { GE1: 18, B: 17 } }],
  headerMap: {},
  offSeasonDay: 20,
  ...overrides,
});

describe("mergeEventIntoHistoricalScores", () => {
  test("creates the year document when it does not exist", async () => {
    const { db, writes } = makeDb(undefined);
    await mergeEventIntoHistoricalScores(db, 2024, event());

    assert.equal(writes.length, 1);
    assert.equal(writes[0].type, "set");
    assert.deepEqual(writes[0].data.data, [event()]);
  });

  test("appends a new event to an existing year document", async () => {
    const existing = event({ eventName: "Earlier Show", date: "2024-07-01" });
    const { db, writes } = makeDb({ data: [existing] });
    await mergeEventIntoHistoricalScores(db, 2024, event());

    assert.equal(writes[0].type, "update");
    assert.equal(writes[0].data.data.length, 2);
    assert.equal(writes[0].data.data[1].eventName, "Regional Championship");
  });

  test("adds a missing corps to an already-present event", async () => {
    const existing = event(); // has only Blue Devils
    const incoming = event({
      scores: [
        { corps: "Blue Devils", captions: { GE1: 18, B: 17 } },
        { corps: "Bluecoats", captions: { GE1: 17, B: 16 } },
      ],
    });
    const { db, writes } = makeDb({ data: [existing] });
    await mergeEventIntoHistoricalScores(db, 2024, incoming);

    assert.equal(writes[0].type, "update");
    const corpsNames = writes[0].data.data[0].scores.map((s) => s.corps);
    assert.deepEqual(corpsNames, ["Blue Devils", "Bluecoats"]);
  });

  test("fills only blank/zero captions, never overwriting existing values", async () => {
    const existing = event({
      scores: [{ corps: "Blue Devils", captions: { GE1: 18, B: 0, VP: undefined } }],
    });
    const incoming = event({
      scores: [{ corps: "Blue Devils", captions: { GE1: 99, B: 17, VP: 15 } }],
    });
    const { db, writes } = makeDb({ data: [existing] });
    await mergeEventIntoHistoricalScores(db, 2024, incoming);

    const captions = writes[0].data.data[0].scores[0].captions;
    assert.equal(captions.GE1, 18); // existing non-zero preserved
    assert.equal(captions.B, 17);   // zero filled
    assert.equal(captions.VP, 15);  // blank filled
  });

  test("skips the write when there is nothing new to merge", async () => {
    const existing = event();
    const { db, writes } = makeDb({ data: [existing] });
    await mergeEventIntoHistoricalScores(db, 2024, event()); // identical

    assert.equal(writes.length, 0);
  });

  test("matches events by name AND date (same name, different date appends)", async () => {
    const existing = event({ date: "2024-07-15" });
    const incoming = event({ date: "2024-07-16" }); // same name, next day
    const { db, writes } = makeDb({ data: [existing] });
    await mergeEventIntoHistoricalScores(db, 2024, incoming);

    assert.equal(writes[0].type, "update");
    assert.equal(writes[0].data.data.length, 2);
  });
});
