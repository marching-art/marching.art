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
    });
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
      },
    ]);
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
