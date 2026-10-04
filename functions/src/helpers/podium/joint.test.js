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
const venues = require("./venues");

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

  test("pendingJoints tolerates the legacy single slot and the multi-week array", () => {
    assert.deepEqual(joint.pendingJoints({}), []);
    assert.deepEqual(joint.pendingJoints({ jointRehearsal: { day: 12 } }), [{ day: 12 }]);
    const many = { jointRehearsals: [{ day: 12 }, { day: 20 }] };
    assert.equal(joint.pendingJoints(many).length, 2);
    // The array wins when both are present (post-migration writes null the slot).
    assert.deepEqual(joint.pendingJoints({ jointRehearsal: { day: 3 }, jointRehearsals: [] }), []);
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
    showPickFor: store.showPickFor,
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
    // The bonus itself is never shown to directors (PODIUM.md decision 47).
    assert.equal("ensembleBonusPct" in windows[0], false);
  });

  test("the proposer's Tour Manager cuts the stamina each window shows", () => {
    const me = { ...corps("Canton, Ohio"), staff: { tourManager: { tier: "legend" } } };
    const [managed] = joint.computeOverlaps(me, corps("Dallas, Texas"), "me", "them", ctx());
    const [plain] = joint.computeOverlaps(
      corps("Canton, Ohio"), corps("Dallas, Texas"), "me", "them", ctx()
    );
    assert.equal(managed.staminaCost, Math.round(plain.staminaCost * 0.7 * 10) / 10);
    assert.equal(managed.coinCost, plain.coinCost, "coin is not a Tour Manager's to cut");
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

  test("tour position follows each corps' OWN picked show, not the day's first listed show", () => {
    // Both corps toured Indiana/Ohio on day 2, but the schedule lists a
    // Virginia show first that day. The joint must land in the Midwest.
    const me = { location: "Canton, Ohio", selectedShows: { 2: { eventName: "A", location: "Dayton, Ohio" } } };
    const them = { location: "Akron, Ohio", selectedShows: { 2: { eventName: "B", location: "Fort Wayne, Indiana" } } };
    const windows = joint.computeOverlaps(
      me, them, "me", "them",
      ctx({
        scheduleLocations: { 2: "Richmond, Virginia" },
        showDays: { me: new Set([2]), them: new Set([2]) },
      })
    );
    assert.ok(windows.length > 0);
    assert.ok(windows.every((w) => w.city === "Fort Wayne, IN"), "partner's picked venue hosts");
    assert.ok(windows.every((w) => w.isFree), "Dayton ↔ Fort Wayne is a day trip");
  });

  test("a legacy pick with no stored location falls back to the day's schedule", () => {
    const legacy = { location: "Canton, Ohio", selectedShowDays: [2] };
    const venue = joint.corpsVenueOnDay(
      legacy, "me", 5, { 2: "Fort Wayne, Indiana" }, fakeStore({ me: new Set([2]) }), null
    );
    assert.equal(venue.city, "Fort Wayne");
  });

  test("no show yet: the structured home venue wins over the free-text hometown", () => {
    const home = { venueId: "x", city: "Dayton", region: "OH", lat: 39.76, lng: -84.19 };
    const venue = joint.corpsVenueOnDay(
      { home, location: "Richmond, Virginia" }, "me", 5, {}, fakeStore({}), null
    );
    assert.equal(venue, home);
  });

  test("two-week horizon, capped at the season end", () => {
    const windows = joint.computeOverlaps(
      corps("Canton, Ohio"), corps("Akron, Ohio"), "me", "them",
      ctx({ competitionDay: 40 })
    );
    assert.ok(windows.every((w) => w.day > 40 && w.day <= 49), "clamped to day 49");
  });
});

describe("jointTravelCharge (the proposer's joint-day bill)", () => {
  const tier = (key) => balance.travel.tiers.find((t) => t.key === key);
  const canton = venues.venueFor("Canton, Ohio");
  const akron = venues.venueFor("Akron, Ohio");
  const dallas = venues.venueFor("Dallas, Texas");
  const plain = {};

  test("the acceptor's copy (no booked tier) is never charged", () => {
    assert.equal(joint.jointTravelCharge(plain, null, canton, dallas, balance), null);
  });

  test("a far partner costs the booked tier's coin AND stamina", () => {
    const charge = joint.jointTravelCharge(plain, "crossCountry", canton, dallas, balance);
    const live = joint.geographyGate(canton, dallas, balance).travelTier;
    const expected = tier(live);
    assert.equal(charge.tier, live);
    assert.equal(charge.coinCost, expected.coinCost);
    assert.equal(charge.staminaCost, expected.staminaCost);
    assert.equal(charge.hostVenueId, dallas.venueId);
    assert.ok(charge.miles > 600);
  });

  test("never more than booked: a real gap wider than the booking is capped at the booked tier", () => {
    const charge = joint.jointTravelCharge(plain, "overnightHaul", canton, dallas, balance);
    assert.equal(charge.tier, "overnightHaul");
    assert.equal(charge.staminaCost, tier("overnightHaul").staminaCost);
    assert.equal(charge.coinCost, tier("overnightHaul").coinCost);
  });

  test("a booking priced from a stale far position costs only tonight's real gap", () => {
    // Booked as cross-country (hosted far off by the old first-show lookup),
    // but the partner is really in Akron — a day trip from Canton — so it's free.
    assert.equal(joint.jointTravelCharge(plain, "crossCountry", canton, akron, balance), null);
  });

  test("an unplaceable position or a vanished partner costs nothing (free floor)", () => {
    assert.equal(joint.jointTravelCharge(plain, "longHaul", canton, null, balance), null);
    assert.equal(joint.jointTravelCharge(plain, "longHaul", null, dallas, balance), null);
    assert.equal(joint.jointTravelCharge(plain, "notATier", canton, dallas, balance), null);
  });

  test("a Tour Manager cuts the stamina (not the coin), rounded like a show leg", () => {
    const managed = { staff: { tourManager: { tier: "journeyman" } } };
    const charge = joint.jointTravelCharge(managed, "longHaul", canton, dallas, balance);
    assert.equal(charge.staminaCost, Math.round(tier("longHaul").staminaCost * 0.85 * 10) / 10);
    assert.equal(charge.coinCost, tier("longHaul").coinCost);
  });

  test("applyJointTravel debits coin, drains stamina and logs the leg", () => {
    const charge = joint.jointTravelCharge(plain, "longHaul", canton, dallas, balance);
    const state = { condition: { stamina: 80 } };
    const debits = [];
    const pay = (_s, amount, reason) => (debits.push([amount, reason]), true);
    joint.applyJointTravel(state, charge, 9, pay, balance);
    assert.deepEqual(debits, [[charge.coinCost, "jointTravel"]]);
    assert.equal(state.condition.stamina, 80 - charge.staminaCost);
    assert.equal(state.travelLog[0].joint, true);
    assert.equal(state.travelLog[0].coinCost, charge.coinCost);
  });

  test("applyJointTravel: an unaffordable fare adds the stamina surcharge instead", () => {
    const charge = joint.jointTravelCharge(plain, "longHaul", canton, dallas, balance);
    const state = { condition: { stamina: 80 } };
    joint.applyJointTravel(state, charge, 9, () => false, balance);
    const expected = 80 - charge.staminaCost - balance.travel.unaffordableStaminaSurcharge;
    assert.equal(state.condition.stamina, expected);
    assert.equal(state.travelLog[0].coinCost, 0);
    assert.equal(state.travelLog[0].unaffordable, true);
  });

  test("tourPositionOf: last show venue, else structured home, else hometown text", () => {
    assert.equal(joint.tourPositionOf({ lastVenue: dallas, home: canton }), dallas);
    assert.equal(joint.tourPositionOf({ home: canton, location: "Dallas, Texas" }), canton);
    assert.equal(joint.tourPositionOf({ location: "Akron, Ohio" }).venueId, akron.venueId);
    assert.equal(joint.tourPositionOf({}), null);
  });
});

describe("proposalPreview (one rule for proposal, inbox and acceptance)", () => {
  const storeModule = {
    isShowDayFor: (state, _uid, day) => (state.showDays || []).includes(day),
    showPickFor: store.showPickFor,
  };
  const ctx = { scheduleLocations: {}, easternAssignments: null, storeModule, cfg: balance };

  test("the invitee's tour position hosts, and the invitee never travels", () => {
    // Proposer toured to Allentown; invitee has picked a show in Dallas since.
    const from = { home: venues.venueFor("Canton, Ohio"), showDays: [2],
      selectedShows: { 2: { eventName: "E", location: "Allentown, Pennsylvania" } } };
    const to = { home: venues.venueFor("Canton, Ohio"), showDays: [3],
      selectedShows: { 3: { eventName: "W", location: "Dallas, Texas" } } };
    const preview = joint.proposalPreview(from, "a", to, "b", 5, ctx);
    assert.equal(preview.city, "Dallas, TX", "hosted where the invitee actually is");
    assert.ok(preview.proposerTravelTier, "the proposer owes the gap");
    assert.ok(preview.proposerStaminaCost > 0 && preview.proposerCoinCost > 0);
  });

  test("before the invitee's first show its home hosts; nearby is free for everyone", () => {
    const from = { home: venues.venueFor("Akron, Ohio") };
    const to = { home: venues.venueFor("Canton, Ohio") };
    const preview = joint.proposalPreview(from, "a", to, "b", 4, ctx);
    assert.equal(preview.city, "Canton, OH");
    assert.equal(preview.proposerTravelTier, null);
    assert.equal(preview.proposerStaminaCost, 0);
    assert.equal(preview.proposerCoinCost, 0);
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
