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
