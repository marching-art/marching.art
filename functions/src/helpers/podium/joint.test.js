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

describe("computeOverlaps (ranked windows)", () => {
  // Fake store: the only thing the engine reads from it is isShowDayFor, which
  // also drives corpsVenueOnDay's location resolution. Controlling it makes the
  // windows deterministic without a season doc.
  const fakeStore = (showDaysByUid) => ({
    isShowDayFor: (_state, uid, day) => (showDaysByUid[uid] || new Set()).has(day),
  });
  const ctx = (over = {}) => ({
    competitionDay: 1,
    scheduleLocations: {},
    easternAssignments: null,
    storeModule: fakeStore(over.showDays || {}),
    cfg: balance,
    ...over,
  });
  // No show days → each corps sits at its hometown all fortnight.
  const corps = (location, jointHistory = []) => ({ location, jointHistory });

  test("nearby corps: every open day is a free window, hosted at the partner's city+stadium", () => {
    const me = corps("Canton, Ohio");
    const them = corps("Akron, Ohio");
    const windows = joint.computeOverlaps(me, them, "me", "them", ctx());
    assert.ok(windows.length > 0, "should surface open-day windows");
    assert.ok(windows.every((w) => w.isFree && w.travelTier === null), "all within a day trip → free");
    assert.equal(windows[0].city, "Akron, OH", "partner's city hosts");
    assert.equal(windows[0].stadium, "Summa Field at InfoCision Stadium", "stadium shown when on file");
    assert.equal(windows[0].ensembleBonusPct, 25, "first pairing = full bonus");
  });

  test("distant corps: windows carry the proposer's travel tier, stamina and coin", () => {
    const windows = joint.computeOverlaps(
      corps("Canton, Ohio"), corps("Dallas, Texas"), "me", "them", ctx()
    );
    assert.ok(windows.length > 0);
    assert.ok(windows.every((w) => !w.isFree && w.travelTier), "cross-country → priced");
    assert.ok(windows[0].coinCost > 0 && windows[0].staminaCost > 0, "proposer pays the gap");
    assert.equal(windows[0].stadium, "Cotton Bowl Stadium", "Dallas venue on file");
  });

  test("open days only: a show day for either corps is excluded", () => {
    const windows = joint.computeOverlaps(
      corps("Canton, Ohio"), corps("Akron, Ohio"), "me", "them",
      ctx({ showDays: { me: new Set([3]), them: new Set([5]) } })
    );
    const days = windows.map((w) => w.day);
    assert.ok(!days.includes(3), "my show day is not a joint day");
    assert.ok(!days.includes(5), "their show day is not a joint day");
  });

  test("weekly cap: a week either corps already spent yields no windows", () => {
    // A joint already banked in week 1 removes days 2-7 from the results.
    const me = corps("Canton, Ohio", [{ day: 3, partnerUid: "x", week: 1 }]);
    const windows = joint.computeOverlaps(me, corps("Akron, Ohio"), "me", "them", ctx());
    assert.ok(windows.every((w) => w.week !== 1), "no windows in the spent week");
    assert.ok(windows.some((w) => w.week === 2), "later weeks still open");
  });

  test("two-week horizon, capped at the season end", () => {
    const windows = joint.computeOverlaps(
      corps("Canton, Ohio"), corps("Akron, Ohio"), "me", "them",
      ctx({ competitionDay: 40 })
    );
    assert.ok(windows.every((w) => w.day > 40 && w.day <= 49), "clamped to day 49");
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
