// Tests for The Podium Report (Phase 7.3): deterministic weekly power
// rankings — movement math, note templates, and the column-size cap.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { buildPowerRankings, COLUMN_SIZE } = require("./powerRankings");

const corps = (uid, lastTotal) => ({ uid, corpsName: `Corps ${uid}`, lastTotal, repTier: 3 });

describe("buildPowerRankings", () => {
  test("week 1: everyone is new, leader takes over at #1", () => {
    const column = buildPowerRankings([corps("a", 80), corps("b", 78)], null, 1);
    assert.equal(column.week, 1);
    assert.equal(column.fieldSize, 2);
    assert.equal(column.entries[0].note, "Takes over at #1.");
    assert.equal(column.entries[0].delta, null);
    assert.equal(column.entries[1].note, "New to the rankings.");
  });

  test("movement vs last week: holds, climbs (biggest move flagged), slips, steady", () => {
    const previous = buildPowerRankings(
      [corps("a", 80), corps("b", 78), corps("c", 76), corps("d", 74)],
      null,
      1
    );
    // Week 2: d rockets from 4th to 2nd (biggest move), b slips, c steady at 3? c: was 3 -> now 4 (slips).
    const column = buildPowerRankings(
      [corps("a", 84), corps("d", 83), corps("b", 80), corps("c", 79)],
      previous,
      2
    );
    assert.equal(column.entries[0].note, "Holds the top spot.");
    assert.equal(column.entries[1].uid, "d");
    assert.equal(column.entries[1].delta, 2);
    assert.equal(column.entries[1].note, "Up 2 — the week's biggest move.");
    assert.equal(column.entries[2].delta, -1);
    assert.equal(column.entries[2].note, "Slips 1.");
    assert.equal(column.entries[3].delta, -1);
  });

  test("deterministic and capped at COLUMN_SIZE with the true field size recorded", () => {
    const field = Array.from({ length: COLUMN_SIZE + 12 }, (_, i) => corps(`u${i}`, 90 - i));
    const a = buildPowerRankings(field, null, 3);
    const b = buildPowerRankings(field, null, 3);
    assert.deepEqual(a, b);
    assert.equal(a.entries.length, COLUMN_SIZE);
    assert.equal(a.fieldSize, COLUMN_SIZE + 12);
  });

  test("carries the GE/VIS/MUS breakdown through to each entry (null when absent)", () => {
    const withCaptions = { uid: "a", corpsName: "Corps a", lastTotal: 80, lastGe: 30.1, lastVis: 25.2, lastMus: 24.7 };
    const column = buildPowerRankings([withCaptions, corps("b", 78)], null, 1);
    assert.equal(column.entries[0].ge, 30.1);
    assert.equal(column.entries[0].vis, 25.2);
    assert.equal(column.entries[0].mus, 24.7);
    // A corps without a persisted breakdown yields nulls, not undefined.
    assert.equal(column.entries[1].ge, null);
    assert.equal(column.entries[1].vis, null);
    assert.equal(column.entries[1].mus, null);
  });

  test("steady note for an unmoved mid-table corps", () => {
    const previous = buildPowerRankings([corps("a", 80), corps("b", 78), corps("c", 76)], null, 1);
    const column = buildPowerRankings([corps("a", 82), corps("b", 80), corps("c", 78)], previous, 2);
    assert.equal(column.entries[1].note, "Steady.");
    assert.equal(column.entries[1].delta, 0);
  });
});
