// Tests for joint rehearsals (Phase 7.1, design §5.12): weekly cap and
// repeat-pair decay bookkeeping, the geography gate, and the scrimmage
// report's private head-to-head shape.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const joint = require("./joint");
const engine = require("./engine");
const store = require("./store");
const balance = require("./balanceConfig.json");

describe("joint caps and decay", () => {
  test("weekOf maps competition days to weeks (pre-season is week 0)", () => {
    assert.equal(joint.weekOf(1), 1);
    assert.equal(joint.weekOf(7), 1);
    assert.equal(joint.weekOf(8), 2);
    assert.equal(joint.weekOf(49), 7);
    assert.equal(joint.weekOf(0), 0);
  });

  test("jointsUsedInWeek and pairCountWith read the history", () => {
    const state = {
      jointHistory: [
        { day: 3, partnerUid: "b", week: 1 },
        { day: 10, partnerUid: "c", week: 2 },
        { day: 12, partnerUid: "b", week: 2 },
      ],
    };
    assert.equal(joint.jointsUsedInWeek(state, 1), 1);
    assert.equal(joint.jointsUsedInWeek(state, 2), 2);
    assert.equal(joint.jointsUsedInWeek(state, 3), 0);
    assert.equal(joint.pairCountWith(state, "b"), 2);
    assert.equal(joint.pairCountWith(state, "z"), 0);
    assert.equal(joint.jointsUsedInWeek({}, 1), 0);
  });

  test("repeat pairings decay: full bonus, half, then none", () => {
    assert.equal(joint.ensembleBonusFor(0, balance), 1.25);
    assert.equal(joint.ensembleBonusFor(1, balance), 1.125);
    assert.equal(joint.ensembleBonusFor(2, balance), 1);
    assert.equal(joint.ensembleBonusFor(7, balance), 1); // stays dry
  });
});

describe("geography gate", () => {
  const venueOf = (city) => require("./venues").venueFor(city);

  test("day-trip range is free; a long gap prices the proposer's travel tier", () => {
    const canton = venueOf("Canton, Ohio");
    const akron = venueOf("Akron, Ohio");
    const dallas = venueOf("Dallas, Texas");
    assert.ok(canton && akron && dallas, "gazetteer must know the test cities");

    const near = joint.geographyGate(canton, akron, balance);
    assert.equal(near.travelTier, null);

    const far = joint.geographyGate(canton, dallas, balance);
    assert.ok(far.travelTier, "cross-country joint must carry a travel tier");
    assert.ok(far.miles > 250);
  });

  test("unknown venues pass free — bad gazetteer data must never gate play", () => {
    const gate = joint.geographyGate(null, venueOf("Dallas, Texas"), balance);
    assert.equal(gate.allowed, true);
    assert.equal(gate.travelTier, null);
  });
});

describe("scrimmage report", () => {
  const makeState = (name, challengeLevel) => {
    const state = engine.createSeasonState(
      {
        challenge: Object.fromEntries(engine.CAPTIONS.map((c) => [c, challengeLevel])),
        auditions: null,
        repTier: 3,
      },
      store.curves,
      store.balance
    );
    state.corpsName = name;
    return state;
  };

  test("private head-to-head: both sheets, deterministic, never an official score", () => {
    const a = makeState("Alpha Corps", 5);
    const b = makeState("Beta Corps", 5);
    const report = joint.scrimmageReport(a, b, 20, "test_season", store.curves, store.balance);
    assert.equal(report.partnerCorpsName, "Beta Corps");
    assert.equal(report.day, 20);
    assert.equal(typeof report.mine.total, "number");
    assert.equal(typeof report.theirs.total, "number");
    for (const caption of engine.CAPTIONS) {
      assert.equal(typeof report.mine.captions[caption], "number");
      assert.equal(typeof report.theirs.captions[caption], "number");
    }
    // Deterministic: the same pairing produces the same report.
    const again = joint.scrimmageReport(a, b, 20, "test_season", store.curves, store.balance);
    assert.deepEqual(report, again);
    // The seed is joint-specific, so the diagnostic differs from the
    // official show seed for the same corps/day.
    const official = engine.scoreCorps(a, 20, "test_season|20|uidA", store.curves, store.balance);
    assert.notEqual(report.mine.total, official.total);
  });
});
