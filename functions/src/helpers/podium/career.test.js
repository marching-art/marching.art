// Tests for Podium careers (Phase 5): season archival gains, dormancy decay
// (the return-weaker invariant at the career layer), heritage credit, and
// the never-performed edge case.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  initCareer,
  applySeasonResult,
  applyDormancy,
  finalsPercentile,
  buildFinalStandings,
  applyBudgetRefund,
  reconcileSeasonDivisions,
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

describe("what an archived season has to remember (rehearsal: the re-sweep)", () => {
  // A sweep that fails is re-claimed the following night, by which point the
  // director has re-registered and the finished season's state doc is gone.
  // The rebuild then reads the career entry — so the entry has to carry the
  // division the corps COMPETED in and the medals it won there, or the frozen
  // standings come back with an empty medal count and next season's seat.
  test("the history entry carries the competing division and its medals", () => {
    const state = {
      ...finishedState(80),
      division: "openClass",
      medals: { gold: 6, silver: 1, bronze: 1 },
    };
    const updated = applySeasonResult(
      initCareer(),
      { seasonUid: "s1", seasonIndex: 1, state },
      balance
    );
    const entry = updated.history[0];

    assert.equal(entry.division, "openClass");
    assert.deepEqual(entry.medals, { gold: 6, silver: 1, bronze: 1 });
  });

  test("a corps with no division recorded archives as A Class, never undefined", () => {
    const updated = applySeasonResult(
      initCareer(),
      { seasonUid: "s1", seasonIndex: 1, state: finishedState(80) },
      balance
    );
    assert.equal(updated.history[0].division, "aClass");
    assert.deepEqual(updated.history[0].medals, {});
  });
});

describe("the profile résumé row (rehearsal: the rollover got there first)", () => {
  // The season rollover's profile sweep writes a fantasy-shaped row for every
  // corps class on the profile, podiumClass included, the night BEFORE Podium
  // archives. appendProfileSeasonHistory used to see that row and return early,
  // so the Podium result — final score, medals, show concept — never landed.
  const { appendProfileSeasonHistory } = require("./career");

  /** A profile doc whose seasonHistory can be inspected after the write. */
  function fakeProfile(seasonHistory) {
    const written = [];
    return {
      written,
      ref: {
        get: async () => ({
          exists: true,
          data: () => ({ corps: { podiumClass: { seasonHistory } } }),
        }),
        set: async (data) => written.push(data),
      },
    };
  }

  function fakeDb(profile) {
    return { doc: () => profile.ref };
  }

  const podiumState = {
    corpsName: "Vanguard Ascent",
    lastTotal: 76.7,
    seasonRank: 1,
    showConcept: "a rehearsal season",
    medals: { gold: 6 },
  };

  test("an existing rollover row is upgraded, not skipped", async () => {
    // Exactly what archiveAndResetProfiles leaves behind for a Podium corps.
    const profile = fakeProfile([
      {
        seasonId: "s1",
        seasonName: "s1",
        corpsClass: "podiumClass",
        corpsName: "Vanguard Ascent",
        totalSeasonScore: 76.7,
        placement: 1,
        lineup: null,
        showConcept: null,
        archivedAt: "yesterday",
      },
    ]);

    const wrote = await appendProfileSeasonHistory(fakeDb(profile), "u1", "s1", podiumState);

    assert.equal(wrote, true);
    const rows = profile.written[0].corps.podiumClass.seasonHistory;
    assert.equal(rows.length, 1, "the row is upgraded in place, never duplicated");
    assert.equal(rows[0].finalScore, 76.7);
    assert.deepEqual(rows[0].medals, { gold: 6 });
    assert.equal(rows[0].showConcept, "a rehearsal season");
    // The rollover's own fields survive the merge.
    assert.equal(rows[0].corpsClass, "podiumClass");
    assert.equal(rows[0].archivedAt, "yesterday");
  });

  test("re-running writes the identical row", async () => {
    const first = fakeProfile([]);
    await appendProfileSeasonHistory(fakeDb(first), "u1", "s1", podiumState);
    const row = first.written[0].corps.podiumClass.seasonHistory[0];

    const second = fakeProfile([row]);
    await appendProfileSeasonHistory(fakeDb(second), "u1", "s1", podiumState);
    const rows = second.written[0].corps.podiumClass.seasonHistory;

    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], row);
  });

  test("a season the corps never performed in leaves no row", async () => {
    const profile = fakeProfile([]);
    const wrote = await appendProfileSeasonHistory(fakeDb(profile), "u1", "s1", {
      corpsName: "Ghost",
      lastTotal: null,
    });
    assert.equal(wrote, false);
    assert.equal(profile.written.length, 0);
  });
});

describe("reconcileSeasonDivisions", () => {
  const NS = process.env.DATA_NAMESPACE;
  const statePath = (uid) => `artifacts/${NS}/users/${uid}/podium/state`;
  const careerPath = (uid) => `artifacts/${NS}/users/${uid}/podium/career`;
  const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
  const rosterPath = (season, uid) => `podium-season/${season}/corps/${uid}`;

  function deepMerge(prev, next) {
    const out = { ...prev };
    for (const [k, v] of Object.entries(next)) {
      out[k] =
        v && typeof v === "object" && !Array.isArray(v)
          ? deepMerge(prev[k] || {}, v)
          : v;
    }
    return out;
  }

  /** Fake Firestore over a Map<path, data>; records every set() as a write. */
  function makeDb(map) {
    const writes = [];
    return {
      writes,
      doc: (path) => ({
        async get() {
          return { exists: map.has(path), data: () => map.get(path) };
        },
        async set(data) {
          writes.push({ path, data });
          map.set(path, deepMerge(map.get(path) || {}, data));
        },
      }),
      collection: (prefix) => ({
        async get() {
          const docs = [];
          for (const key of map.keys()) {
            if (key.startsWith(prefix + "/")) {
              const rest = key.slice(prefix.length + 1);
              if (!rest.includes("/")) docs.push({ id: rest });
            }
          }
          return { docs };
        },
      }),
    };
  }

  /** Seed one corps: roster membership + live state + career seat. */
  function seed(map, season, uid, { stateDivision, stateSeason = season, careerDivision }) {
    map.set(rosterPath(season, uid), { uid });
    map.set(statePath(uid), { seasonUid: stateSeason, division: stateDivision });
    if (careerDivision !== undefined) map.set(careerPath(uid), { division: careerDivision });
  }

  test("raises a stale-seated corps to its earned division, on state and profile", async () => {
    const map = new Map();
    seed(map, "overture", "u1", { stateDivision: "aClass", careerDivision: "openClass" });
    const db = makeDb(map);

    const healed = await reconcileSeasonDivisions(db, "overture");

    assert.equal(healed, 1);
    assert.equal(map.get(statePath("u1")).division, "openClass");
    assert.equal(map.get(profilePath("u1")).corps.podiumClass.division, "openClass");
  });

  test("is idempotent — a second pass writes nothing", async () => {
    const map = new Map();
    seed(map, "overture", "u1", { stateDivision: "aClass", careerDivision: "openClass" });
    const db = makeDb(map);

    await reconcileSeasonDivisions(db, "overture");
    const writesAfterFirst = db.writes.length;
    const healed = await reconcileSeasonDivisions(db, "overture");

    assert.equal(healed, 0);
    assert.equal(db.writes.length, writesAfterFirst); // no further writes
  });

  test("never lowers a seat below the live state", async () => {
    const map = new Map();
    // Career somehow trails the state (World live, Open career) — a demotion is a
    // boundary decision, never this pass's job.
    seed(map, "overture", "u1", { stateDivision: "worldClass", careerDivision: "openClass" });
    const db = makeDb(map);

    const healed = await reconcileSeasonDivisions(db, "overture");

    assert.equal(healed, 0);
    assert.equal(map.get(statePath("u1")).division, "worldClass");
  });

  test("leaves an already-correct corps untouched", async () => {
    const map = new Map();
    seed(map, "overture", "u1", { stateDivision: "openClass", careerDivision: "openClass" });
    const db = makeDb(map);

    const healed = await reconcileSeasonDivisions(db, "overture");

    assert.equal(healed, 0);
    assert.equal(db.writes.length, 0);
  });

  test("skips a corps whose live state belongs to a different season", async () => {
    const map = new Map();
    // Roster lists u1 for overture, but its state is still last season's — the
    // director hasn't re-registered, so it must not be touched.
    seed(map, "overture", "u1", {
      stateDivision: "aClass",
      stateSeason: "live",
      careerDivision: "openClass",
    });
    const db = makeDb(map);

    const healed = await reconcileSeasonDivisions(db, "overture");

    assert.equal(healed, 0);
    assert.equal(map.get(statePath("u1")).division, "aClass");
  });

  test("skips a corps with no career record", async () => {
    const map = new Map();
    seed(map, "overture", "u1", { stateDivision: "aClass" }); // careerDivision omitted
    const db = makeDb(map);

    const healed = await reconcileSeasonDivisions(db, "overture");

    assert.equal(healed, 0);
  });
});
