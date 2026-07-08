// Tests for the learned schedule model. Two layers:
//   1. Back-test against a REAL sampled event (2019 DCI Arkansas) — feeding the
//      real field + scores must reproduce the real performance order closely
//      (Spearman >= 0.9), the same signal the calibration measured in aggregate.
//   2. Deterministic unit tests of the generator mechanics (ordering, interval
//      spacing, intermission placement, gates/scores offsets, end-anchoring,
//      clock formatting).
//
// Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { deriveRunningOrder, formatLocalClock, CONSTANTS } = require("./scheduleModel");

function spearman(xs, ys) {
  const rank = (arr) => {
    const sorted = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(arr.length);
    sorted.forEach(([, idx], i) => { r[idx] = i + 1; });
    return r;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

describe("deriveRunningOrder — back-test vs real 2019 DCI Arkansas", () => {
  // Real field in REAL performance order, with that night's final scores.
  const realOrder = [
    { corps: "Jersey Surf", score: 69.9 },
    { corps: "Music City", score: 72.75 },
    { corps: "Colts", score: 78.65 },
    { corps: "Phantom Regiment", score: 82.05 },
    { corps: "Crossmen", score: 82.7 },
    { corps: "Blue Knights", score: 85.55 },
    { corps: "Boston Crusaders", score: 89.85 },
    { corps: "The Cavaliers", score: 88.575 },
    { corps: "Bluecoats", score: 92.05 },
    { corps: "Santa Clara Vanguard", score: 91.25 },
  ];

  test("reproduces the real running order with Spearman >= 0.9", () => {
    const derived = deriveRunningOrder(realOrder);
    // Map each corps' derived slot back onto its real slot and correlate.
    const realPos = new Map(realOrder.map((c, i) => [c.corps, i + 1]));
    const derivedPos = derived.lineup.map((e) => e.order);
    const realForDerived = derived.lineup.map((e) => realPos.get(e.corps));
    const rho = spearman(derivedPos, realForDerived);
    assert.ok(rho >= 0.9, `expected rho >= 0.9, got ${rho.toFixed(3)}`);
  });

  test("first and last performers match the true extremes", () => {
    const { lineup } = deriveRunningOrder(realOrder);
    assert.equal(lineup[0].corps, "Jersey Surf"); // lowest score performs first
    assert.equal(lineup[lineup.length - 1].corps, "Bluecoats"); // highest performs last
  });
});

describe("deriveRunningOrder — mechanics", () => {
  const field = (n) =>
    Array.from({ length: n }, (_, i) => ({ corps: `Corps ${String.fromCharCode(65 + i)}`, score: 60 + i }));

  test("orders worst-to-best by score, deterministic on ties", () => {
    const { lineup } = deriveRunningOrder([
      { corps: "Zeta", score: 80 },
      { corps: "Alpha", score: 80 },
      { corps: "Mid", score: 75 },
    ]);
    assert.deepEqual(lineup.map((e) => e.corps), ["Mid", "Alpha", "Zeta"]);
  });

  test("spaces performers by the interval, with one intermission gap", () => {
    const { lineup } = deriveRunningOrder(field(10));
    // A normal adjacent gap is the interval.
    assert.equal(
      lineup[1].performsAtLocalMinutes - lineup[0].performsAtLocalMinutes,
      CONSTANTS.intervalMin
    );
    // Exactly one gap carries the extra intermission time.
    const gaps = [];
    for (let i = 1; i < lineup.length; i++) {
      gaps.push(lineup[i].performsAtLocalMinutes - lineup[i - 1].performsAtLocalMinutes);
    }
    const longGaps = gaps.filter((g) => g === CONSTANTS.intervalMin + CONSTANTS.intermissionMin);
    assert.equal(longGaps.length, 1, "expected exactly one intermission gap");
  });

  test("no intermission for a tiny field", () => {
    const { lineup } = deriveRunningOrder(field(4));
    const gaps = [];
    for (let i = 1; i < lineup.length; i++) {
      gaps.push(lineup[i].performsAtLocalMinutes - lineup[i - 1].performsAtLocalMinutes);
    }
    assert.ok(gaps.every((g) => g === CONSTANTS.intervalMin));
  });

  test("gates precede the first performer and scores follow the last", () => {
    const r = deriveRunningOrder(field(10));
    assert.equal(r.gatesLocalMinutes, r.startLocalMinutes - CONSTANTS.gatesOffsetMin);
    const lastT = r.lineup[r.lineup.length - 1].performsAtLocalMinutes;
    assert.equal(r.scoresLocalMinutes, lastT + CONSTANTS.scoresOffsetMin);
  });

  test("regional-sized field keeps the evening default start", () => {
    const r = deriveRunningOrder(field(10));
    assert.equal(r.startLocalMinutes, CONSTANTS.defaultStartLocalMinutes);
    assert.equal(r.lineup[0].performanceTime, "7:10 PM");
  });

  test("large field is pulled earlier so it doesn't run past midnight", () => {
    const r = deriveRunningOrder(field(25));
    assert.ok(
      r.startLocalMinutes < CONSTANTS.defaultStartLocalMinutes,
      "25-corps field should start before the evening default"
    );
    // Last performer should land near the target end (within one interval).
    const lastT = r.lineup[r.lineup.length - 1].performsAtLocalMinutes;
    assert.ok(Math.abs(lastT - CONSTANTS.targetLastPerformerLocalMinutes) <= CONSTANTS.intervalMin);
  });

  test("empty / unscored field yields an empty lineup, no throw", () => {
    assert.deepEqual(deriveRunningOrder([]).lineup, []);
    assert.deepEqual(deriveRunningOrder([{ corps: "X", score: NaN }]).lineup, []);
  });
});

describe("formatLocalClock", () => {
  test("formats within a day", () => {
    assert.equal(formatLocalClock(19 * 60 + 10), "7:10 PM");
    assert.equal(formatLocalClock(12 * 60), "12:00 PM");
    assert.equal(formatLocalClock(0), "12:00 AM");
    assert.equal(formatLocalClock(9 * 60 + 5), "9:05 AM");
  });
  test("wraps past midnight for display", () => {
    assert.equal(formatLocalClock(1440 + 130), "2:10 AM");
  });
});
