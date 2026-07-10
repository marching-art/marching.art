// Calibration guards (2026-07 recalibration): the championship-week
// survivorship correction, the DCI-shaped tier ladder it enables, and the
// runtime balance-override path used for beta tuning.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const store = require("./store");
const { correctSurvivorship } = require("../../scripts/buildPodiumCurves");

describe("survivorship correction", () => {
  test("committed curveData carries a full-field finals band (Pioneer to champion)", () => {
    const finals = store.curves.totalBands[48];
    // Pre-correction the finals floor was ~80.7 (finalists only). The
    // corrected band must reach down to the community-corps tail...
    assert.ok(finals.p5 < 65, `finals p5 ${finals.p5} should be full-field (<65)`);
    assert.ok(finals.p25 < 78, `finals p25 ${finals.p25} should be Surf/Genesis (<78)`);
    // ...while the real champion top is untouched.
    assert.ok(finals.max > 98.5, `finals max ${finals.max} must keep the true top`);
    // Continuity with the last full-field day: no championship-week cliff.
    const day44 = store.curves.totalBands[43];
    assert.ok(Math.abs(finals.p5 - day44.p5) < 4, "p5 continuous across day 44 -> 49");
  });

  test("correctSurvivorship lowers inflated late floors, never raises, keeps the top", () => {
    // Synthetic band: flat full-field floor 60 through day 44, then a fake
    // selection jump to 80; steady top.
    const bands = Array.from({ length: 49 }, (_, i) => ({
      n: 30,
      p5: i < 44 ? 60 : 80,
      p25: i < 44 ? 70 : 84,
      p50: i < 44 ? 78 : 88,
      p75: 90,
      p95: 95,
      max: 99,
    }));
    correctSurvivorship(bands);
    assert.ok(bands[48].p5 < 65, `day-49 p5 repaired to trend: ${bands[48].p5}`);
    assert.ok(bands[48].p25 < 74, `day-49 p25 repaired: ${bands[48].p25}`);
    assert.equal(bands[48].p95, 95, "upper percentiles untouched");
    assert.equal(bands[48].max, 99, "max untouched");
    assert.equal(bands[40].p5, 60, "full-field window untouched");
    // Idempotent: min(observed, trend) twice is stable.
    const once = JSON.stringify(bands);
    correctSurvivorship(bands);
    assert.equal(JSON.stringify(bands), once);
  });

  test("tier ceilings land on the DCI shape at finals", () => {
    const targets = { 1: [72, 79], 4: [88, 93], 6: [96, 98], 7: [98.5, 99.7] };
    for (const [tier, [lo, hi]] of Object.entries(targets)) {
      const pct = store.balance.scoring.repCeilingPercentileByTier[tier];
      // Ceiling total implied by the percentile of the finals band.
      const band = store.curves.totalBands[48];
      const points = [
        [5, band.p5],
        [25, band.p25],
        [50, band.p50],
        [75, band.p75],
        [95, band.p95],
        [100, band.max],
      ];
      let ceiling = band.max;
      for (let i = 1; i < points.length; i++) {
        const [p0, v0] = points[i - 1];
        const [p1, v1] = points[i];
        if (pct <= p1) {
          ceiling = v0 + ((v1 - v0) * (pct - p0)) / (p1 - p0);
          break;
        }
      }
      assert.ok(
        ceiling >= lo && ceiling <= hi,
        `tier ${tier} ceiling ${ceiling.toFixed(1)} outside [${lo}, ${hi}]`
      );
    }
  });
});

describe("runtime balance overrides (podium-config/balance)", () => {
  const fakeDb = (data) => ({
    doc: () => ({ get: async () => ({ exists: data !== null, data: () => data }) }),
  });

  test("overrides merge over committed defaults and revert when removed", async () => {
    const committedCap = store.balance.scoring.totalCap;
    await store.applyBalanceOverrides(fakeDb({ scoring: { totalCap: 98.5 } }), { force: true });
    assert.equal(store.balance.scoring.totalCap, 98.5);
    // Sibling values in the same section survive a partial override.
    assert.ok(store.balance.scoring.repCeilingPercentileByTier["7"] === 100);
    // Removing the override reverts to the committed default on refresh.
    await store.applyBalanceOverrides(fakeDb(null), { force: true });
    assert.equal(store.balance.scoring.totalCap, committedCap);
  });

  test("a read failure keeps the current values (never throws)", async () => {
    const before = store.balance.scoring.totalCap;
    const failingDb = { doc: () => ({ get: async () => { throw new Error("offline"); } }) };
    await store.applyBalanceOverrides(failingDb, { force: true });
    assert.equal(store.balance.scoring.totalCap, before);
  });
});
