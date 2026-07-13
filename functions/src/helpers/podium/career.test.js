// Tests for Podium careers (Phase 5): season archival gains, dormancy decay
// (the return-weaker invariant at the career layer), heritage credit, and
// the never-performed edge case.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  initCareer,
  applySeasonResult,
  applyDormancy,
  finalsPercentile,
  buildFinalStandings,
  applyBudgetRefund,
} = require("./career");
const balance = require("./balanceConfig.json");
const curves = require("./curveData.json");

// Records the writes a transaction receives so the refund's coin credit + the
// history row it logs can be asserted without an emulator.
function fakeTransaction() {
  const updates = [];
  const sets = [];
  return {
    updates,
    sets,
    update: (ref, data) => updates.push({ ref, data }),
    set: (ref, data) => sets.push({ ref, data }),
  };
}
const profileSnap = (corpsCoin) => ({ exists: true, data: () => ({ corpsCoin }) });
const report = (refunded) => ({ refunded, corpsName: "Cavaliers" });

/** A finished-season state posting `total` at day 49. */
const finishedState = (total, name = "Test Corps") => ({
  corpsName: name,
  lastTotal: total,
  lastScoredDay: 49,
  seasonRank: 1,
  seasonRankOf: 10,
});

describe("career season archival", () => {
  test("a strong finals gains reputation; history records the season", () => {
    const p95 = curves.totalBands[48].p95;
    const updated = applySeasonResult(
      initCareer(),
      { seasonUid: "s1", seasonIndex: 1, state: finishedState(p95) },
      balance
    );
    assert.ok(updated.reputation > 0, `reputation ${updated.reputation} should be > 0`);
    assert.equal(updated.seasonsPlayed, 1);
    assert.equal(updated.lastPlayedIndex, 1);
    assert.equal(updated.history.length, 1);
    assert.equal(updated.historicalPeak, updated.reputation);
  });

  test("a registered-but-never-performed season neither gains nor loses", () => {
    const career = { ...initCareer(), reputation: 40, historicalPeak: 40 };
    const updated = applySeasonResult(
      career,
      { seasonUid: "s2", seasonIndex: 2, state: { corpsName: "Ghost", lastTotal: null, lastScoredDay: null } },
      balance
    );
    assert.equal(updated.reputation, 40);
    assert.equal(updated.seasonsPlayed, 1);
  });

  test("heritage credit accelerates the re-climb below the old peak", () => {
    const p95 = curves.totalBands[48].p95;
    const fresh = applySeasonResult(
      initCareer(),
      { seasonUid: "a", seasonIndex: 1, state: finishedState(p95) },
      balance
    );
    const comeback = applySeasonResult(
      { ...initCareer(), reputation: 10, historicalPeak: 80 },
      { seasonUid: "b", seasonIndex: 5, state: finishedState(p95) },
      balance
    );
    const freshGain = fresh.reputation - 0;
    const comebackGain = comeback.reputation - 10;
    assert.ok(
      comebackGain > freshGain,
      `heritage gain ${comebackGain} should beat fresh gain ${freshGain}`
    );
  });
});

describe("career dormancy", () => {
  test("return is strictly weaker, and longer absences decay more", () => {
    const start = { ...initCareer(), reputation: 90, historicalPeak: 90 };
    const one = applyDormancy(start, 1, balance);
    const three = applyDormancy(start, 3, balance);
    const six = applyDormancy(start, 6, balance);
    assert.ok(one.reputation < 90);
    assert.ok(three.reputation < one.reputation);
    assert.ok(six.reputation < three.reputation);
    assert.ok(six.reputation >= 0);
  });

  test("zero missed seasons is a no-op", () => {
    const start = { ...initCareer(), reputation: 55 };
    assert.equal(applyDormancy(start, 0, balance).reputation, 55);
  });
});

describe("buildFinalStandings", () => {
  test("ranks by latest total, excludes unscored corps, assigns places", () => {
    const standings = buildFinalStandings([
      { uid: "b", corpsName: "Beta", lastTotal: 88.2, lastScoredDay: 49 },
      { uid: "ghost", corpsName: "Ghost", lastTotal: null, lastScoredDay: null },
      { uid: "a", corpsName: "Alpha", lastTotal: 91.5, lastScoredDay: 49 },
      { uid: "c", corpsName: "Gamma", lastTotal: 76.0, lastScoredDay: 35 },
    ]);
    assert.deepEqual(
      standings.map((s) => [s.uid, s.place]),
      [["a", 1], ["b", 2], ["c", 3]]
    );
  });

  test("ties break deterministically by uid (idempotent re-sweeps)", () => {
    const entries = [
      { uid: "z", lastTotal: 80, lastScoredDay: 49 },
      { uid: "a", lastTotal: 80, lastScoredDay: 49 },
    ];
    const first = buildFinalStandings(entries);
    const again = buildFinalStandings([...entries].reverse());
    assert.deepEqual(first, again);
    assert.equal(first[0].uid, "a");
  });

  test("empty sweep produces empty standings (champion null upstream)", () => {
    assert.deepEqual(buildFinalStandings([]), []);
  });
});

describe("finalsPercentile", () => {
  test("null for unscored corps; in 0-100 for scored", () => {
    assert.equal(finalsPercentile({ lastTotal: null, lastScoredDay: null }), null);
    const pct = finalsPercentile({ lastTotal: 92, lastScoredDay: 49 });
    assert.ok(pct > 0 && pct <= 100);
  });
});

describe("applyBudgetRefund (end-of-season CC sweep)", () => {
  // economy.addCoinHistoryEntryToTransaction resolves a history collection ref;
  // the stub only needs to return a doc handle for transaction.set to record.
  const db = { doc: () => ({}), collection: () => ({ doc: () => ({}) }) };

  test("credits the leftover balance and logs a refund history row", () => {
    const txn = fakeTransaction();
    const refunded = applyBudgetRefund(txn, db, "u1", profileSnap(1000), report(400), "s5");
    assert.equal(refunded, 400);
    // Wallet credited: 1000 + 400.
    assert.equal(txn.updates.length, 1);
    assert.equal(txn.updates[0].data.corpsCoin, 1400);
    // One coin-history row, positive, tagged as a podium budget refund.
    assert.equal(txn.sets.length, 1);
    assert.equal(txn.sets[0].data.type, "podium_budget_refund");
    assert.equal(txn.sets[0].data.amount, 400);
    assert.equal(txn.sets[0].data.balance, 1400);
    assert.equal(txn.sets[0].data.seasonUid, "s5");
  });

  test("a zero (or negative) refund is a no-op — no wallet write, no history", () => {
    const txn = fakeTransaction();
    assert.equal(applyBudgetRefund(txn, db, "u1", profileSnap(1000), report(0), "s5"), 0);
    assert.equal(txn.updates.length, 0);
    assert.equal(txn.sets.length, 0);
  });

  test("a missing profile skips the credit rather than throwing", () => {
    const txn = fakeTransaction();
    const refunded = applyBudgetRefund(
      txn,
      db,
      "u1",
      { exists: false },
      report(400),
      "s5"
    );
    assert.equal(refunded, 0);
    assert.equal(txn.updates.length, 0);
  });
});
