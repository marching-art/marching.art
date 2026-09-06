// Unit tests for the materialized show-registrations index helpers. The key
// derivation is shared by three writers (selectUserShows write-through, the
// nightly rebuild, getShowRegistrations' materialize-on-miss) — if it ever
// diverges between them the index silently fragments, so pin it here.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  showRegistrationEventKey,
  registrationEntryKey,
  collectRegistrationsFromProfile,
  buildEventDocs,
  collectPodiumRegistrations,
} = require("./showRegistrations");

describe("showRegistrationEventKey", () => {
  test("is deterministic and distinguishes week/name/date", () => {
    const a = showRegistrationEventKey(2, "DCI Anytown", "2026-07-10");
    assert.equal(a, showRegistrationEventKey(2, "DCI Anytown", "2026-07-10"));
    assert.notEqual(a, showRegistrationEventKey(3, "DCI Anytown", "2026-07-10"));
    assert.notEqual(a, showRegistrationEventKey(2, "DCI Elsewhere", "2026-07-10"));
    assert.notEqual(a, showRegistrationEventKey(2, "DCI Anytown", "2026-07-11"));
  });

  test("produces a Firestore-safe id for hostile event names", () => {
    const key = showRegistrationEventKey(1, "Show / With? Weird#Chars — ünïcode", "2026-07-01");
    assert.match(key, /^[A-Za-z0-9_-]+$/, "base64url alphabet only");
  });

  test("treats a missing date like an empty one", () => {
    assert.equal(
      showRegistrationEventKey(1, "Show", undefined),
      showRegistrationEventKey(1, "Show", null)
    );
  });
});

describe("collectRegistrationsFromProfile", () => {
  const profile = {
    username: "alice",
    corps: {
      worldClass: {
        corpsName: "Alice Corps",
        selectedShows: {
          week2: [
            { eventName: "DCI Anytown", date: "2026-07-10", day: 9 },
            { eventName: "DCI Elsewhere", date: "2026-07-12", day: 11 },
          ],
        },
      },
      soundSport: {
        corpsName: "Alice SS",
        selectedShows: { week2: [{ eventName: "DCI Anytown", date: "2026-07-10", day: 9 }] },
      },
    },
  };

  test("extracts one pair per (class, show) with denormalized display fields", () => {
    const pairs = collectRegistrationsFromProfile("alice-uid", profile);
    assert.equal(pairs.length, 3);

    const anytownWorld = pairs.find(
      (p) => p.eventName === "DCI Anytown" && p.entry.corpsClass === "worldClass"
    );
    assert.equal(anytownWorld.week, 2);
    assert.equal(anytownWorld.entryKey, registrationEntryKey("alice-uid", "worldClass"));
    assert.deepEqual(anytownWorld.entry, {
      uid: "alice-uid",
      corpsClass: "worldClass",
      corpsName: "Alice Corps",
      username: "alice",
      homeGeo: null, // no location on this corps → unresolved
      encoreDeclined: false,
    });
  });

  test("stamps homeGeo from a corps' location for the encore", () => {
    const withLocation = {
      username: "bob",
      corps: {
        worldClass: {
          corpsName: "Bob Corps",
          location: "Allentown, PA",
          selectedShows: { week1: [{ eventName: "Opener", date: "2026-06-20", day: 1 }] },
        },
      },
    };
    const [pair] = collectRegistrationsFromProfile("bob-uid", withLocation);
    assert.ok(pair.entry.homeGeo, "location should resolve to coordinates");
    assert.ok(Number.isFinite(pair.entry.homeGeo.lat));
  });

  test("prefers a homeGeo already cached on the corps", () => {
    const cached = {
      username: "cara",
      corps: {
        worldClass: {
          corpsName: "Cara Corps",
          location: "Allentown, PA",
          homeGeo: { lat: 1, lng: 2, venueId: "cached-venue" },
          selectedShows: { week1: [{ eventName: "Opener", date: "2026-06-20", day: 1 }] },
        },
      },
    };
    const [pair] = collectRegistrationsFromProfile("cara-uid", cached);
    assert.equal(pair.entry.homeGeo.venueId, "cached-venue");
  });

  test("skips malformed shows and handles empty profiles", () => {
    assert.deepEqual(collectRegistrationsFromProfile("u", {}), []);
    assert.deepEqual(
      collectRegistrationsFromProfile("u", {
        corps: { worldClass: { selectedShows: { week1: [null, { noEventName: true }] } } },
      }),
      []
    );
  });
});

describe("buildEventDocs", () => {
  test("groups pairs into one doc per event, both classes under the same event", () => {
    const pairs = collectRegistrationsFromProfile("alice-uid", {
      username: "alice",
      corps: {
        worldClass: {
          corpsName: "Alice Corps",
          selectedShows: { week2: [{ eventName: "DCI Anytown", date: "2026-07-10" }] },
        },
        soundSport: {
          corpsName: "Alice SS",
          selectedShows: { week2: [{ eventName: "DCI Anytown", date: "2026-07-10" }] },
        },
      },
    });
    const docs = buildEventDocs(pairs);
    assert.equal(docs.size, 1);

    const doc = docs.get(showRegistrationEventKey(2, "DCI Anytown", "2026-07-10"));
    assert.equal(doc.week, 2);
    assert.equal(doc.eventName, "DCI Anytown");
    assert.equal(Object.keys(doc.registrations).length, 2);
    assert.equal(doc.registrations["alice-uid_soundSport"].corpsName, "Alice SS");
  });
});

describe("collectPodiumRegistrations", () => {
  const SEASON = "live_2026-26";
  const params = { day: 15, eventName: "marching.art Mile High", activeSeasonId: SEASON };

  test("keeps the corps whose pick for the day names this show", () => {
    const entries = [
      {
        uid: "druski",
        state: {
          seasonUid: SEASON,
          corpsName: "Altitude Podium",
          lastTotal: 87.5,
          selectedShows: { 15: { eventName: "marching.art Mile High", location: "Fort Collins, CO" } },
        },
      },
    ];
    const out = collectPodiumRegistrations(entries, params);
    assert.deepEqual(out, [
      {
        uid: "druski",
        corpsName: "Altitude Podium",
        corpsClass: "podiumClass",
        username: null,
        lastTotal: 87.5,
        auto: false,
        homeGeo: null, // no structured home on this corps → unresolved
      },
    ]);
  });

  describe("auto-attended shows (majors + championship week)", () => {
    const corps = (uid, division, extra = {}) => ({
      uid,
      state: { seasonUid: SEASON, corpsName: `${uid} Podium`, division, selectedShows: {}, ...extra },
    });

    test("every rostered corps attends the Southwestern Championship on day 28", () => {
      const entries = [corps("w", "worldClass"), corps("o", "openClass"), corps("a", "aClass")];
      const out = collectPodiumRegistrations(entries, {
        day: 28,
        eventName: "marching.art Southwestern Championship",
        activeSeasonId: SEASON,
        show: { eventTier: "regional" },
      });
      assert.deepEqual(out.map((r) => r.uid), ["w", "o", "a"]);
      assert.ok(out.every((r) => r.auto === true && r.corpsClass === "podiumClass"));
    });

    test("a major is recognized by name when the schedule entry carries no eventTier", () => {
      const out = collectPodiumRegistrations([corps("w", "worldClass")], {
        day: 35,
        eventName: "marching.art Southeastern Championship",
        activeSeasonId: SEASON,
      });
      assert.equal(out.length, 1);
    });

    test("a stale prior-season corps never auto-attends", () => {
      const out = collectPodiumRegistrations([corps("old", "worldClass", { seasonUid: "live_2025-25" })], {
        day: 28,
        eventName: "marching.art Southwestern Championship",
        activeSeasonId: SEASON,
      });
      assert.deepEqual(out, []);
    });

    test("a pool show sharing a major's day is not auto-attended", () => {
      const out = collectPodiumRegistrations([corps("w", "worldClass")], {
        day: 28,
        eventName: "DCI Somewhere",
        activeSeasonId: SEASON,
      });
      assert.deepEqual(out, []);
    });

    test("the Eastern Classic seats each corps on its published night only", () => {
      const entries = [corps("n1", "worldClass"), corps("n2", "openClass")];
      const easternAssignments = { n1: 41, n2: 42 };
      const night = (day) =>
        collectPodiumRegistrations(entries, {
          day,
          eventName: "marching.art Eastern Classic",
          activeSeasonId: SEASON,
          easternAssignments,
        }).map((r) => r.uid);
      assert.deepEqual(night(41), ["n1"]);
      assert.deepEqual(night(42), ["n2"]);
    });

    test("championship rounds seat the divisions that march them", () => {
      const entries = [corps("w", "worldClass"), corps("o", "openClass"), corps("a", "aClass")];
      const field = (day, eventName) =>
        collectPodiumRegistrations(entries, {
          day,
          eventName,
          activeSeasonId: SEASON,
          show: { type: "championship", mandatory: true },
        }).map((r) => r.uid);
      assert.deepEqual(field(45, "Open and A Class Prelims"), ["o", "a"]);
      assert.deepEqual(field(47, "marching.art World Championship Prelims"), ["w", "o", "a"]);
    });

    test("an advancement round seats only the cut survivors when the cut is known", () => {
      const entries = [corps("w", "worldClass"), corps("o", "openClass"), corps("a", "aClass")];
      const out = collectPodiumRegistrations(entries, {
        day: 49,
        eventName: "marching.art World Championship Finals",
        activeSeasonId: SEASON,
        advancing: new Set(["w", "a"]),
      });
      assert.deepEqual(out.map((r) => r.uid), ["w", "a"]);
    });

    test("the day-49 SoundSport festival is never a Podium show", () => {
      const out = collectPodiumRegistrations([corps("w", "worldClass")], {
        day: 49,
        eventName: "SoundSport International Music & Food Festival",
        activeSeasonId: SEASON,
        show: { type: "championship", eligibleClasses: ["soundSport"] },
      });
      assert.deepEqual(out, []);
    });
  });

  test("carries homeGeo from the corps' structured home for the encore", () => {
    const entries = [
      {
        uid: "druski",
        state: {
          seasonUid: SEASON,
          corpsName: "Altitude Podium",
          lastTotal: 87.5,
          home: { venueId: "denver-co", city: "Denver", region: "CO", lat: 39.74, lng: -104.99 },
          selectedShows: { 15: { eventName: "marching.art Mile High" } },
        },
      },
    ];
    const [pod] = collectPodiumRegistrations(entries, params);
    assert.deepEqual(pod.homeGeo, { lat: 39.74, lng: -104.99, venueId: "denver-co" });
  });

  test("lastTotal defaults to null before the corps has been scored", () => {
    const entries = [
      {
        uid: "rookie",
        state: {
          seasonUid: SEASON,
          corpsName: "Fresh Podium",
          selectedShows: { 15: { eventName: "marching.art Mile High" } },
        },
      },
    ];
    assert.equal(collectPodiumRegistrations(entries, params)[0].lastTotal, null);
  });

  test("matches when Firestore has stringified the day map keys", () => {
    const entries = [
      {
        uid: "druski",
        state: {
          seasonUid: SEASON,
          corpsName: "Altitude Podium",
          selectedShows: { "15": { eventName: "marching.art Mile High" } },
        },
      },
    ];
    assert.equal(collectPodiumRegistrations(entries, params).length, 1);
  });

  test("skips a pick for the same day at a different show", () => {
    const entries = [
      {
        uid: "someone",
        state: {
          seasonUid: SEASON,
          corpsName: "Elsewhere Podium",
          selectedShows: { 15: { eventName: "Some Other Show" } },
        },
      },
    ];
    assert.deepEqual(collectPodiumRegistrations(entries, params), []);
  });

  test("skips a corps with no pick on that day", () => {
    const entries = [
      {
        uid: "someone",
        state: { seasonUid: SEASON, corpsName: "No Pick", selectedShows: { 14: { eventName: "marching.art Mile High" } } },
      },
    ];
    assert.deepEqual(collectPodiumRegistrations(entries, params), []);
  });

  test("skips a stale prior-season state even if its pick matches", () => {
    const entries = [
      {
        uid: "druski",
        state: {
          seasonUid: "finale_2025-25",
          corpsName: "Last Year",
          selectedShows: { 15: { eventName: "marching.art Mile High" } },
        },
      },
    ];
    assert.deepEqual(collectPodiumRegistrations(entries, params), []);
  });

  test("falls back to a placeholder name and tolerates missing states", () => {
    const entries = [
      { uid: "nameless", state: { seasonUid: SEASON, selectedShows: { 15: { eventName: "marching.art Mile High" } } } },
      { uid: "gone", state: null },
    ];
    const out = collectPodiumRegistrations(entries, params);
    assert.equal(out.length, 1);
    assert.equal(out[0].corpsName, "Podium Corps");
  });
});
