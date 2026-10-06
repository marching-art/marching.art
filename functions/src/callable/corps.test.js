// Input-hardening tests for processCorpsDecisions — the season-setup wizard
// path. "New" corps decisions used to store corpsName/location/showConcept
// VERBATIM, skipping the length and profanity checks that registerCorps and
// renameCorps enforce, and accepted arbitrarily long decisions arrays.
//
// Exercises the REAL onCall handler via the v2 `.run()` test hook with a fake
// Firestore injected through config.setDbForTesting — same pattern as
// economyCallables.test.js. Uses Node's built-in test runner (node:test).
// Run with `npm test` inside functions/.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const {
  processCorpsDecisions,
  sanitizeDecisionShowConcept,
  unretireCorps,
  renameCorps,
} = require("./corps");
const { rolloverInProgress } = require("../helpers/rolloverGate");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;

/**
 * Minimal fake Firestore covering exactly what processCorpsDecisions uses:
 * db.doc(), and db.runTransaction() with transaction.get/set/update. Records
 * every write for assertions.
 */
function makeFakeDb(docs = new Map()) {
  const writes = [];

  const makeRef = (path) => ({ path });

  const db = {
    doc: (path) => makeRef(path),
    async runTransaction(fn) {
      const transaction = {
        async get(ref) {
          const data = docs.get(ref.path);
          return { exists: data !== undefined, data: () => data };
        },
        update(ref, data) {
          writes.push({ type: "update", path: ref.path, data });
        },
        set(ref, data) {
          writes.push({ type: "set", path: ref.path, data });
        },
      };
      return fn(transaction);
    },
  };

  return { db, writes };
}

function authedRequest(uid, data = {}) {
  return { data, auth: { uid, token: {} } };
}

function makeDocs(profile = { corps: {} }) {
  // Season without schedule dates: no registration locks apply.
  return new Map([
    ["game-settings/season", { seasonUid: "season-1" }],
    [profilePath("u1"), profile],
  ]);
}

after(() => setDbForTesting(null));

describe("processCorpsDecisions input validation", () => {
  beforeEach(() => setDbForTesting(null));

  test("caps the decisions array at one per fantasy class", async () => {
    const { db } = makeFakeDb(makeDocs());
    setDbForTesting(db);

    const decisions = Array.from({ length: 5 }, () => ({
      corpsClass: "soundSport",
      action: "skip",
    }));
    await assert.rejects(
      processCorpsDecisions.run(authedRequest("u1", { decisions })),
      /Too many decisions/
    );
  });

  test("rejects a new-corps decision with a missing or non-string name/location", async () => {
    const { db } = makeFakeDb(makeDocs());
    setDbForTesting(db);

    for (const bad of [
      { corpsName: "", location: "Anytown" },
      { corpsName: "   ", location: "Anytown" },
      { corpsName: { hax: 1 }, location: "Anytown" },
      { corpsName: "Fine Name", location: "" },
      { corpsName: "Fine Name", location: 42 },
    ]) {
      await assert.rejects(
        processCorpsDecisions.run(authedRequest("u1", {
          decisions: [{ corpsClass: "soundSport", action: "new", ...bad }],
        })),
        /requires name and location/
      );
    }
  });

  test("rejects names/locations over 50 chars (same rule as registerCorps)", async () => {
    const { db } = makeFakeDb(makeDocs());
    setDbForTesting(db);

    await assert.rejects(
      processCorpsDecisions.run(authedRequest("u1", {
        decisions: [{
          corpsClass: "soundSport", action: "new",
          corpsName: "x".repeat(51), location: "Anytown",
        }],
      })),
      /cannot exceed 50 characters/
    );
    await assert.rejects(
      processCorpsDecisions.run(authedRequest("u1", {
        decisions: [{
          corpsClass: "soundSport", action: "new",
          corpsName: "Fine Name", location: "y".repeat(51),
        }],
      })),
      /cannot exceed 50 characters/
    );
  });

  test("rejects profane names and locations (same rule as registerCorps)", async () => {
    const { db } = makeFakeDb(makeDocs());
    setDbForTesting(db);

    await assert.rejects(
      processCorpsDecisions.run(authedRequest("u1", {
        decisions: [{
          corpsClass: "soundSport", action: "new",
          corpsName: "The Damn Corps", location: "Anytown",
        }],
      })),
      /Profane language/
    );
    await assert.rejects(
      processCorpsDecisions.run(authedRequest("u1", {
        decisions: [{
          corpsClass: "soundSport", action: "new",
          corpsName: "Fine Name", location: "Shitsville",
        }],
      })),
      /Profane language/
    );
  });

  test("stores the trimmed name/location and drops a free-text show concept", async () => {
    const { db, writes } = makeFakeDb(makeDocs());
    setDbForTesting(db);

    const result = await processCorpsDecisions.run(authedRequest("u1", {
      decisions: [{
        corpsClass: "soundSport",
        action: "new",
        corpsName: "  Starlight Cadets  ",
        location: "  Anytown, USA  ",
        showConcept: "a".repeat(100000), // legacy free-text: dropped, never stored
      }],
    }));

    assert.equal(result.success, true);

    const profileWrite = writes.find(
      (w) => w.type === "update" && w.path === profilePath("u1")
    );
    const stored = profileWrite.data.corps.soundSport;
    assert.equal(stored.corpsName, "Starlight Cadets");
    assert.equal(stored.location, "Anytown, USA");
    assert.equal(stored.showConcept, "");

    // The corpsnames reservation uses the trimmed name too
    const reservation = writes.find(
      (w) => w.type === "set" && w.path === "corpsnames/season-1_starlight cadets"
    );
    assert.equal(reservation.data.corpsName, "Starlight Cadets");
  });

  test("stores the registration description as the profile's ensemble mission", async () => {
    const { db, writes } = makeFakeDb(makeDocs());
    setDbForTesting(db);

    await processCorpsDecisions.run(authedRequest("u1", {
      decisions: [{
        corpsClass: "soundSport",
        action: "new",
        corpsName: "Starlight Cadets",
        location: "Anytown, USA",
        description: "  Small-town corps, big-stage sound.  ",
      }],
    }));

    const stored = writes.find(
      (w) => w.type === "update" && w.path === profilePath("u1")
    ).data.corps.soundSport;
    assert.deepEqual(stored.ensembleInfo, { mission: "Small-town corps, big-stage sound." });
  });

  test("omits ensembleInfo when no description is given, and caps/filters it", async () => {
    const { db, writes } = makeFakeDb(makeDocs());
    setDbForTesting(db);

    await processCorpsDecisions.run(authedRequest("u1", {
      decisions: [{
        corpsClass: "soundSport", action: "new",
        corpsName: "Starlight Cadets", location: "Anytown, USA",
      }],
    }));
    const stored = writes.find(
      (w) => w.type === "update" && w.path === profilePath("u1")
    ).data.corps.soundSport;
    assert.equal(stored.ensembleInfo, undefined);

    await assert.rejects(
      processCorpsDecisions.run(authedRequest("u1", {
        decisions: [{
          corpsClass: "soundSport", action: "new",
          corpsName: "Fine Name", location: "Anytown", description: "z".repeat(501),
        }],
      })),
      /cannot exceed 500 characters/
    );
    await assert.rejects(
      processCorpsDecisions.run(authedRequest("u1", {
        decisions: [{
          corpsClass: "soundSport", action: "new",
          corpsName: "Fine Name", location: "Anytown", description: "damn good",
        }],
      })),
      /Profane language/
    );
  });

  test("stores a structured show concept sanitized to the saveShowConcept shape", async () => {
    const { db, writes } = makeFakeDb(makeDocs());
    setDbForTesting(db);

    await processCorpsDecisions.run(authedRequest("u1", {
      decisions: [{
        corpsClass: "soundSport",
        action: "new",
        corpsName: "Starlight Cadets",
        location: "Anytown, USA",
        showConcept: {
          showName: `  Neon ${"Nights ".repeat(20)}`,
          theme: "space",
          musicSource: "classical",
          drillStyle: "geometric",
          hax: true, // unknown keys must not be stored
        },
      }],
    }));

    const profileWrite = writes.find(
      (w) => w.type === "update" && w.path === profilePath("u1")
    );
    const concept = profileWrite.data.corps.soundSport.showConcept;
    assert.equal(concept.theme, "space");
    assert.equal(concept.musicSource, "classical");
    assert.equal(concept.drillStyle, "geometric");
    assert.equal(concept.showName.length, 60); // trimmed + capped like saveShowConcept
    assert.equal(concept.hax, undefined);
  });
});

describe("sanitizeDecisionShowConcept", () => {
  test("drops strings, arrays, and incomplete objects", () => {
    assert.equal(sanitizeDecisionShowConcept("free text"), "");
    assert.equal(sanitizeDecisionShowConcept(["a"]), "");
    assert.equal(sanitizeDecisionShowConcept(null), "");
    assert.equal(sanitizeDecisionShowConcept({ theme: "space" }), "");
    assert.equal(
      sanitizeDecisionShowConcept({ theme: "space", musicSource: "x", drillStyle: 42 }),
      ""
    );
  });

  test("keeps a valid structured concept and normalizes the title", () => {
    const concept = sanitizeDecisionShowConcept({
      showName: "  A   Show\n Title ",
      theme: "space",
      musicSource: "classical",
      drillStyle: "geometric",
    });
    assert.equal(concept.showName, "A Show Title");
    assert.equal(concept.theme, "space");

    // A too-short title is omitted rather than failing the whole concept
    const untitled = sanitizeDecisionShowConcept({
      showName: "x",
      theme: "space",
      musicSource: "classical",
      drillStyle: "geometric",
    });
    assert.equal(untitled.showName, null);
  });
});

// History follows the corps (owner direction, 2026-10): a corps keeps its name
// for life, reviving a corps retires the class's active one, and nothing
// changes hands while a season rollover is archiving.
describe("unretireCorps — reviving a corps retires the active one", () => {
  beforeEach(() => setDbForTesting(null));

  const retiredRecord = {
    corpsClass: "openClass",
    corpsName: "Phoenix",
    location: "Reno, NV",
    seasonHistory: [{ seasonId: "s0", totalSeasonScore: 80 }],
    avatarUrl: "phoenix.png",
  };

  test("swaps in the retired corps with its own record and banks the active one", async () => {
    const active = { corpsName: "Upstart", location: "Elko, NV", seasonHistory: [] };
    const { db, writes } = makeFakeDb(
      makeDocs({ corps: { openClass: active }, retiredCorps: [retiredRecord] })
    );
    setDbForTesting(db);

    const res = await unretireCorps.run(authedRequest("u1", { corpsClass: "openClass", retiredIndex: 0 }));
    assert.equal(res.replaced, "Upstart");
    const update = writes.find((w) => w.path === profilePath("u1")).data;
    assert.equal(update.corps.openClass.corpsName, "Phoenix");
    assert.deepEqual(update.corps.openClass.seasonHistory, retiredRecord.seasonHistory);
    assert.equal(update.corps.openClass.avatarUrl, "phoenix.png");
    assert.equal(update.corps.openClass.seasonUid, "season-1");
    assert.equal(update.retiredCorps.length, 1);
    assert.equal(update.retiredCorps[0].corpsName, "Upstart");
  });

  test("waits for the season to end when the active corps has competed", async () => {
    const active = { corpsName: "Upstart", totalSeasonScore: 70.5, seasonHistory: [] };
    const { db, writes } = makeFakeDb(
      makeDocs({ corps: { openClass: active }, retiredCorps: [retiredRecord] })
    );
    setDbForTesting(db);

    await assert.rejects(
      unretireCorps.run(authedRequest("u1", { corpsClass: "openClass", retiredIndex: 0 })),
      /already competed/
    );
    assert.equal(writes.length, 0);
  });

  test("an empty class simply welcomes the corps back", async () => {
    const { db, writes } = makeFakeDb(makeDocs({ corps: {}, retiredCorps: [retiredRecord] }));
    setDbForTesting(db);

    const res = await unretireCorps.run(authedRequest("u1", { corpsClass: "openClass", retiredIndex: 0 }));
    assert.equal(res.replaced, null);
    const update = writes.find((w) => w.path === profilePath("u1")).data;
    assert.equal(update.retiredCorps.length, 0);
  });
});

describe("renameCorps — a corps keeps its name for life", () => {
  beforeEach(() => setDbForTesting(null));

  test("refuses to rebrand a corps that has no name conflict", async () => {
    const { db, writes } = makeFakeDb(
      makeDocs({ corps: { aClass: { corpsName: "Cascade", seasonHistory: [] } } })
    );
    setDbForTesting(db);

    await assert.rejects(
      renameCorps.run(authedRequest("u1", { corpsClass: "aClass", newName: "Rebrand" })),
      /keeps its name for life/
    );
    assert.equal(writes.length, 0);
  });

  test("still resolves a duplicate-name conflict the director didn't choose", async () => {
    const { db, writes } = makeFakeDb(
      makeDocs({ corps: { aClass: { corpsName: "Cascade", mustRename: true, seasonHistory: [] } } })
    );
    setDbForTesting(db);

    const res = await renameCorps.run(authedRequest("u1", { corpsClass: "aClass", newName: "Cascade Lakes" }));
    assert.equal(res.newName, "Cascade Lakes");
    assert.ok(writes.some((w) => w.path === profilePath("u1")));
  });
});

describe("rolloverInProgress", () => {
  const now = new Date("2026-10-06T12:00:00Z");
  test("a fresh running lease blocks; completed, failed and stale ones don't", () => {
    assert.equal(rolloverInProgress({ status: "running", startedAt: new Date("2026-10-06T11:55:00Z") }, now), true);
    assert.equal(rolloverInProgress({ status: "running", startedAt: new Date("2026-10-06T10:00:00Z") }, now), false);
    assert.equal(rolloverInProgress({ status: "completed" }, now), false);
    assert.equal(rolloverInProgress({ status: "failed" }, now), false);
    assert.equal(rolloverInProgress(null, now), false);
  });
});
