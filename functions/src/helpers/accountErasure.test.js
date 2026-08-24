// Unit tests for the pure anonymizer transforms behind account deletion. These
// pin the exact fields nulled on each results surface, because the frontend's
// "show the director credit only when displayName is truthy, link only when uid
// is truthy" contract is what makes a nulled field disappear from the page.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  anonymizeResultEntries,
  anonymizeRecapDay,
  anonymizeStandingsDoc,
  anonymizeFantasyStandingsDoc,
  anonymizeChampionsDoc,
} = require("./accountErasure");

describe("anonymizeRecapDay", () => {
  test("nulls displayName for the target uid, keeps uid, corpsName, scores", () => {
    const data = {
      shows: [
        {
          eventName: "DCI Anytown",
          results: [
            { uid: "u1", displayName: "gone", corpsName: "Blue Notes", totalScore: 80 },
            { uid: "u2", displayName: "stays", corpsName: "Green Machine", totalScore: 79 },
          ],
        },
      ],
    };
    const changed = anonymizeRecapDay(data, "u1");
    assert.equal(changed, true);

    const [a, b] = data.shows[0].results;
    // Target row: name stripped, but the row and its scores remain, and uid is
    // kept so the results-page builder still includes it.
    assert.equal(a.displayName, null);
    assert.equal(a.uid, "u1");
    assert.equal(a.corpsName, "Blue Notes");
    assert.equal(a.totalScore, 80);
    // Untouched row.
    assert.equal(b.displayName, "stays");
  });

  test("returns false when the uid has no rows (idempotent second pass)", () => {
    const data = {
      shows: [{ results: [{ uid: "u2", displayName: "stays" }] }],
    };
    assert.equal(anonymizeRecapDay(data, "u1"), false);
    // A row already anonymized (displayName already null) reports no change.
    const already = { shows: [{ results: [{ uid: "u1", displayName: null }] }] };
    assert.equal(anonymizeRecapDay(already, "u1"), false);
  });

  test("tolerates malformed docs", () => {
    assert.equal(anonymizeRecapDay(null, "u1"), false);
    assert.equal(anonymizeRecapDay({}, "u1"), false);
    assert.equal(anonymizeRecapDay({ shows: [null, {}, { results: null }] }, "u1"), false);
  });
});

describe("anonymizeStandingsDoc", () => {
  test("nulls displayName on matching standings rows only", () => {
    const data = {
      standings: [
        { uid: "u1", displayName: "gone", lastTotal: 90 },
        { uid: "u2", displayName: "stays", lastTotal: 88 },
      ],
    };
    assert.equal(anonymizeStandingsDoc(data, "u1"), true);
    assert.equal(data.standings[0].displayName, null);
    assert.equal(data.standings[0].uid, "u1");
    assert.equal(data.standings[1].displayName, "stays");
  });
});

describe("anonymizeFantasyStandingsDoc", () => {
  test("nulls displayName on matching entries only, keeps uid/corps/scores", () => {
    const data = {
      classKey: "worldClass",
      entries: [
        { uid: "u1", displayName: "gone", corpsName: "Blue Notes", score: 90, scores: [{ score: 90 }] },
        { uid: "u2", displayName: "stays", corpsName: "Rivals", score: 88 },
      ],
    };
    assert.equal(anonymizeFantasyStandingsDoc(data, "u1"), true);
    const [a, b] = data.entries;
    assert.equal(a.displayName, null);
    assert.equal(a.uid, "u1");
    assert.equal(a.corpsName, "Blue Notes");
    assert.equal(a.score, 90);
    // Nested history is untouched (it carries no identity).
    assert.deepEqual(a.scores, [{ score: 90 }]);
    assert.equal(b.displayName, "stays");
  });

  test("idempotent / tolerant of missing entries", () => {
    assert.equal(anonymizeFantasyStandingsDoc({ entries: [{ uid: "u1", displayName: null }] }, "u1"), false);
    assert.equal(anonymizeFantasyStandingsDoc({}, "u1"), false);
    assert.equal(anonymizeFantasyStandingsDoc(null, "u1"), false);
  });
});

describe("anonymizeChampionsDoc", () => {
  test("nulls BOTH uid and username on champion rows (no displayName gate)", () => {
    const data = {
      classes: {
        worldClass: [
          { uid: "u1", username: "gone", corpsName: "Blue Notes", score: 98 },
          { uid: "u2", username: "stays", corpsName: "Green Machine", score: 97 },
        ],
        openClass: [{ uid: "u1", username: "gone2", corpsName: "Side Corps" }],
      },
    };
    assert.equal(anonymizeChampionsDoc(data, "u1"), true);

    const wc = data.classes.worldClass[0];
    assert.equal(wc.uid, null);
    assert.equal(wc.username, null);
    // The record itself remains.
    assert.equal(wc.corpsName, "Blue Notes");
    assert.equal(wc.score, 98);
    // Other director untouched.
    assert.equal(data.classes.worldClass[1].uid, "u2");
    // Every class is swept.
    assert.equal(data.classes.openClass[0].uid, null);
  });

  test("returns false for docs without the target uid or classes", () => {
    assert.equal(anonymizeChampionsDoc({ classes: { worldClass: [{ uid: "u2" }] } }, "u1"), false);
    assert.equal(anonymizeChampionsDoc({}, "u1"), false);
    assert.equal(anonymizeChampionsDoc(null, "u1"), false);
  });
});

describe("anonymizeResultEntries", () => {
  test("nulls a username when a row carries one alongside displayName", () => {
    const rows = [{ uid: "u1", displayName: "d", username: "u" }];
    assert.equal(anonymizeResultEntries(rows, "u1"), true);
    assert.equal(rows[0].displayName, null);
    assert.equal(rows[0].username, null);
  });

  test("non-array input is a no-op", () => {
    assert.equal(anonymizeResultEntries(undefined, "u1"), false);
  });
});
