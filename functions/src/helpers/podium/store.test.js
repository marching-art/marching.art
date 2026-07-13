// Store loaders that back the Podium API. Currently pins loadScheduleLocations,
// the {day -> location} preload joint-rehearsal acceptance uses to resolve each
// corps' tour position (helpers/podium/joint.corpsVenueOnDay). A missing/renamed
// export here previously crashed every accept with an internal error, so this
// guards the exact contract that path depends on.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const store = require("./store");

// Minimal Firestore stub: only db.doc(path).get() is exercised.
function fakeDb(competitions) {
  return {
    doc: () => ({
      get: async () => ({ exists: true, data: () => ({ competitions }) }),
    }),
  };
}

describe("loadScheduleLocations", () => {
  test("maps each schedule day to its location string", async () => {
    const db = fakeDb([
      { day: 5, name: "DCI Tour Premiere", location: "Akron, Ohio" },
      { day: 12, name: "DCI Southeastern", location: "Atlanta, Georgia" },
    ]);
    const locations = await store.loadScheduleLocations(db, { dataDocId: "sched-1" });
    assert.equal(locations[5], "Akron, Ohio");
    assert.equal(locations[12], "Atlanta, Georgia");
  });

  test("keeps the first non-empty location when a day has several shows", async () => {
    const db = fakeDb([
      { day: 8, name: "Placeholder", location: "" },
      { day: 8, name: "DCI Mideast", location: "Massillon, Ohio" },
    ]);
    const locations = await store.loadScheduleLocations(db, { dataDocId: "sched-1" });
    assert.equal(locations[8], "Massillon, Ohio");
  });

  test("returns an empty map when the schedule doc is missing", async () => {
    const db = { doc: () => ({ get: async () => ({ exists: false }) }) };
    const locations = await store.loadScheduleLocations(db, { dataDocId: "sched-1" });
    assert.deepEqual(locations, {});
  });
});

describe("Corps Budget ledger — per-category tracking", () => {
  test("credits and debits accrue into byCategory", () => {
    const s = { budget: store.initBudget() };
    store.creditBudget(s, 2500, "commitment", 0);
    store.creditBudget(s, 30, "showPayout", 28);
    store.debitBudget(s, 300, "staff:brass", 0);
    store.debitBudget(s, 120, "travel", 5);
    store.debitBudget(s, 40, "jointTravel", 8); // folds into travel
    store.debitBudget(s, 60, "food:standard", 6);
    store.debitBudget(s, 25, "camp", 1);
    assert.equal(s.budget.byCategory.commitment, 2500);
    assert.equal(s.budget.byCategory.earnings, 30);
    assert.equal(s.budget.byCategory.staff, 300);
    assert.equal(s.budget.byCategory.travel, 160); // 120 + 40
    assert.equal(s.budget.byCategory.food, 60);
    assert.equal(s.budget.byCategory.camp, 25);
    assert.equal(s.budget.balance, 2500 + 30 - 300 - 120 - 40 - 60 - 25);
  });

  test("budgetCategoryOf normalizes namespaced reasons", () => {
    assert.equal(store.budgetCategoryOf("staff:guard"), "staff");
    assert.equal(store.budgetCategoryOf("staffRetrain:brass"), "staff");
    assert.equal(store.budgetCategoryOf("food:fullKitchen"), "food");
    assert.equal(store.budgetCategoryOf("jointTravel"), "travel");
    assert.equal(store.budgetCategoryOf("clinician"), "clinician");
    assert.equal(store.budgetCategoryOf("mystery"), "other");
  });
});

describe("buildSeasonFinancialReport", () => {
  const seasonState = () => {
    const s = { seasonUid: "s5", corpsName: "Test Corps", budget: store.initBudget() };
    store.creditBudget(s, 2500, "commitment", 0);
    store.creditBudget(s, 30, "showPayout", 28);
    store.creditBudget(s, 9, "fundraiser", 10);
    store.debitBudget(s, 300, "staff:brass", 0);
    store.debitBudget(s, 160, "travel", 5);
    store.debitBudget(s, 60, "food:standard", 6);
    store.debitBudget(s, 25, "camp", 1);
    return s;
  };

  test("line items reconcile: committed + earned - spent === refunded", () => {
    const report = store.buildSeasonFinancialReport(seasonState(), {
      seasonUid: "s5",
      seasonIndex: 5,
    });
    assert.equal(report.committed, 2500);
    assert.equal(report.earned, 39);
    assert.equal(report.spent, 545);
    assert.equal(report.refunded, 2500 + 39 - 545);
    assert.equal(report.committed + report.earned - report.spent, report.refunded);
    // Spend line items sum back to `spent`.
    const lineTotal = report.lineItems.reduce((sum, i) => sum + i.amount, 0);
    assert.equal(lineTotal, report.spent);
    // Estimate basis: operating spend excludes staff salary.
    assert.equal(report.staffSpend, 300);
    assert.equal(report.operatingSpend, 545 - 300);
  });

  test("an empty ledger refunds nothing and lists no line items", () => {
    const report = store.buildSeasonFinancialReport({ budget: store.initBudget() }, {});
    assert.equal(report.refunded, 0);
    assert.equal(report.spent, 0);
    assert.deepEqual(report.lineItems, []);
  });

  test("a missing budget (pre-ledger state) is treated as empty, never throws", () => {
    const report = store.buildSeasonFinancialReport({ corpsName: "Legacy" }, { seasonUid: "s1" });
    assert.equal(report.refunded, 0);
    assert.equal(report.corpsName, "Legacy");
  });

  test("falls back to the log when byCategory is absent (pre-migration state)", () => {
    const legacy = {
      seasonUid: "s4",
      corpsName: "Old Guard",
      budget: {
        balance: 500,
        committed: 1000,
        earned: 0,
        spent: 500,
        log: [
          { day: 0, amount: 1000, reason: "commitment" },
          { day: 3, amount: -300, reason: "staff:guard" },
          { day: 5, amount: -200, reason: "travel" },
        ],
      },
    };
    const report = store.buildSeasonFinancialReport(legacy, { seasonUid: "s4" });
    assert.equal(report.refunded, 500);
    assert.deepEqual(
      report.lineItems.map((i) => [i.category, i.amount]),
      [
        ["staff", 300],
        ["travel", 200],
      ]
    );
  });
});
