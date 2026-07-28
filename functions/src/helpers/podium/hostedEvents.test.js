// Tests for hosted-event validation (Phase 6.2). Payout flow is covered by
// the E2E smoke; this pins the pure request validation.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  validateHostRequest,
  scheduledVenueIds,
  collectAttendees,
  summarizeHosting,
} = require("./hostedEvents");
const venues = require("./venues");

const good = {
  eventName: "The Rohn Invitational",
  venueTier: "collegeBowl",
  day: 20,
  location: "Canton, Ohio",
};

describe("validateHostRequest", () => {
  test("accepts a valid request and resolves the venue", () => {
    const result = validateHostRequest(good, 10);
    assert.equal(result.day, 20);
    assert.equal(result.venue.city, "Canton");
    assert.equal(result.tier.capacity, 30);
  });

  test("rejects unknown tiers, bad names, and unknown cities", () => {
    assert.throws(() => validateHostRequest({ ...good, venueTier: "colosseum" }, 10));
    assert.throws(() => validateHostRequest({ ...good, eventName: "ab" }, 10));
    assert.throws(() => validateHostRequest({ ...good, location: "Atlantis, Ocean" }, 10));
  });

  test("rejects the majors' exclusive days and too-soon/too-late dates", () => {
    assert.throws(() => validateHostRequest({ ...good, day: 28 }, 10)); // Southwestern
    assert.throws(() => validateHostRequest({ ...good, day: 41 }, 10)); // Eastern N1
    assert.throws(() => validateHostRequest({ ...good, day: 11 }, 10)); // < 2 days ahead
    assert.throws(() => validateHostRequest({ ...good, day: 45 }, 10)); // champ week
  });
});

describe("scheduledVenueIds", () => {
  test("resolves scheduled locations to venueIds, ignoring unknown ones", () => {
    const canton = venues.venueFor("Canton, Ohio");
    const allentown = venues.venueFor("Allentown, Pennsylvania");
    const taken = scheduledVenueIds([
      { location: "Canton, OH" }, // abbreviation still resolves
      { location: "Allentown, Pennsylvania" },
      { location: "Atlantis, Ocean" }, // unknown -> skipped
      { location: "" }, // empty -> skipped
      {}, // no location -> skipped
    ]);
    assert.ok(taken.has(canton.venueId));
    assert.ok(taken.has(allentown.venueId));
    assert.equal(taken.size, 2);
  });

  test("handles empty/undefined input", () => {
    assert.equal(scheduledVenueIds([]).size, 0);
    assert.equal(scheduledVenueIds(undefined).size, 0);
  });
});

describe("collectAttendees", () => {
  const fantasyShow = {
    eventName: "The Rohn Invitational",
    results: [
      { uid: "u1", corpsClass: "worldClass", corpsName: "Blue Devils", displayName: "chris", totalScore: 97.2 },
      { uid: "u1", corpsClass: "openClass", corpsName: "Second Corps", totalScore: 88.1 },
      { uid: "u2", corpsClass: "worldClass", corpsName: "Cavaliers", totalScore: 95.4 },
    ],
  };

  test("lists one row per corps but counts directors once (alt-farm guard)", () => {
    const { rows, directors } = collectAttendees(fantasyShow, []);
    assert.equal(rows.length, 3, "three corps performed");
    assert.equal(directors.size, 2, "two distinct directors pay out");
  });

  test("merges podium performers and ranks the roster by score", () => {
    const { rows, directors } = collectAttendees(fantasyShow, [
      { uid: "u3", corpsName: "Podium Corps", totalScore: 99.0 },
    ]);
    assert.equal(directors.size, 3);
    assert.equal(rows[0].corpsName, "Podium Corps", "highest score leads the roster");
    assert.equal(rows[0].corpsClass, "podiumClass");
    assert.equal(rows[rows.length - 1].corpsName, "Second Corps");
  });

  test("dedupes a corps appearing twice and skips results with no uid", () => {
    const { rows, directors } = collectAttendees(
      { results: [...fantasyShow.results, fantasyShow.results[0], { corpsName: "Ghost" }] },
      []
    );
    assert.equal(rows.length, 3);
    assert.equal(directors.size, 2);
  });

  test("handles a missing show and missing podium results", () => {
    const { rows, directors } = collectAttendees(null, null);
    assert.equal(rows.length, 0);
    assert.equal(directors.size, 0);
  });
});

describe("summarizeHosting", () => {
  const events = [
    {
      id: "a", seasonUid: "live_2025-25", day: 10, venueTier: "highSchool",
      rentalCC: 150, paidOut: true, payout: 375, attendance: 15, corpsCount: 15, successful: true,
    },
    {
      id: "b", seasonUid: "live_2026-26", day: 12, venueTier: "collegeBowl",
      rentalCC: 400, paidOut: true, payout: 700, attendance: 20, corpsCount: 22, successful: false,
    },
    {
      id: "c", seasonUid: "live_2026-26", day: 30, venueTier: "highSchool",
      rentalCC: 150, paidOut: false,
    },
  ];

  test("orders newest season first, then latest day", () => {
    const { events: sorted } = summarizeHosting(events);
    assert.deepEqual(sorted.map((e) => e.id), ["c", "b", "a"]);
  });

  test("totals CorpsCoin in and out, counting rental on unsettled shows", () => {
    const { totals } = summarizeHosting(events);
    assert.equal(totals.eventsHosted, 3);
    assert.equal(totals.eventsSettled, 2);
    assert.equal(totals.rentalSpent, 700, "all three rentals are already spent");
    assert.equal(totals.earned, 1075);
    assert.equal(totals.net, 375);
    assert.equal(totals.successful, 1);
  });

  test("draw uses the uncapped roster count and tracks the best show", () => {
    const { totals } = summarizeHosting(events);
    assert.equal(totals.corpsDrawn, 37, "22 corps drawn even though 20 were paid");
    assert.equal(totals.bestDraw, 22);
  });

  test("falls back to attendance for events settled before rosters existed", () => {
    const { totals } = summarizeHosting([
      { id: "old", seasonUid: "live_2024-24", day: 5, venueTier: "highSchool",
        rentalCC: 150, paidOut: true, payout: 250, attendance: 10, successful: true },
    ]);
    assert.equal(totals.corpsDrawn, 10);
    assert.equal(totals.bestDraw, 10);
  });

  test("groups the résumé by venue tier", () => {
    const { byTier } = summarizeHosting(events);
    assert.deepEqual(byTier.highSchool, { hosted: 2, successful: 1, earned: 375 });
    assert.deepEqual(byTier.collegeBowl, { hosted: 1, successful: 0, earned: 700 });
  });

  test("handles a director who has never hosted", () => {
    const { events: sorted, totals, byTier } = summarizeHosting([]);
    assert.deepEqual(sorted, []);
    assert.equal(totals.eventsHosted, 0);
    assert.equal(totals.net, 0);
    assert.deepEqual(byTier, {});
  });
});
