// Tests for the Eastern Classic two-night split (Phase 6.1, design §5.11):
// snake seeding, per-class balance, season parity, and — the critical
// regression — day 42 scoring the EXACT complement of day 41 even when
// enrollment changes between the nights (the v0 alphabetical split
// recomputed nightly, so an enrollment edit could double- or zero-score a
// corps).
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  isTwoNightShow,
  seasonNightParity,
  collectEnrollees,
  snakeSplitByClass,
  computeSplit,
  diffLineups,
  hasLineupChange,
  lineupIndex,
  resolveEasternNightSet,
} = require("./easternSplit");

// --- fixtures -------------------------------------------------------------

const profileDoc = (uid, data) => ({
  data: () => data,
  ref: { parent: { parent: { id: uid } } },
});

/** N worldClass corps enrolled in the event, seeded by descending score. */
function snapshotWithCorps(entries, eventName = "marching.art Eastern Classic", week = 6) {
  return {
    docs: entries.map(({ uid, corpsClass = "worldClass", score }) =>
      profileDoc(uid, {
        corps: {
          [corpsClass]: {
            corpsName: `Corps ${uid}`,
            totalSeasonScore: score,
            selectedShows: { [`week${week}`]: [{ eventName, day: 41 }] },
          },
        },
      })
    ),
  };
}

/** Minimal Firestore fake: doc get/set with top-level merge. */
function fakeDb(docs = {}) {
  return {
    _docs: docs,
    doc(path) {
      return {
        async get() {
          const data = docs[path];
          return { exists: data !== undefined, data: () => data };
        },
        async set(value, opts) {
          docs[path] = opts && opts.merge ? { ...(docs[path] || {}), ...value } : value;
        },
      };
    },
  };
}

const EASTERN_SHOW = {
  eventName: "marching.art Eastern Classic",
  multiNight: { nights: [41, 42] },
};

/**
 * Run `fn` with publishEasternPreview's two lazy dependencies stubbed: the
 * schedule read (which would hit the real Firestore config) and the in-app
 * notification fan-out (which needs an initialized firebase-admin). Every
 * notification the run would send is collected into `sink`.
 */
async function withStubbedDeps(dayEventData, sink, fn) {
  const stub = (path, exports) => ({ id: path, filename: path, loaded: true, exports });
  const schedulePath = require.resolve("./seasonSchedule");
  const notifyPath = require.resolve("./userNotifications");
  const realSchedule = require.cache[schedulePath];
  const realNotify = require.cache[notifyPath];

  require.cache[schedulePath] = /** @type {*} */ (
    stub(schedulePath, { getScheduleDay: async () => dayEventData })
  );
  require.cache[notifyPath] = /** @type {*} */ (
    stub(notifyPath, {
      createUserNotifications: async (_db, entries) => {
        sink.push(...entries);
        return { written: entries.length, skipped: 0 };
      },
    })
  );
  try {
    return await fn();
  } finally {
    if (realSchedule) require.cache[schedulePath] = realSchedule;
    else delete require.cache[schedulePath];
    if (realNotify) require.cache[notifyPath] = realNotify;
    else delete require.cache[notifyPath];
  }
}

// --- pure pieces ------------------------------------------------------------

describe("isTwoNightShow", () => {
  test("multiNight metadata, name fallback, and negatives", () => {
    assert.ok(isTwoNightShow(EASTERN_SHOW));
    assert.ok(isTwoNightShow({ eventName: "DCI Eastern Classic" })); // legacy schedules
    assert.ok(!isTwoNightShow({ eventName: "Music on the March" }));
    assert.ok(!isTwoNightShow({ eventName: "X", multiNight: { nights: [41] } }));
    assert.ok(!isTwoNightShow(null));
  });
});

describe("snakeSplitByClass", () => {
  const nights = [41, 42];

  test("snake pattern: seeds 1,4,5,8 one night; 2,3,6,7 the other", () => {
    const enrollees = [8, 7, 6, 5, 4, 3, 2, 1].map((n) => ({
      key: `u${9 - n}_worldClass`,
      uid: `u${9 - n}`,
      corpsClass: "worldClass",
      corpsName: `C${9 - n}`,
      score: n * 10, // u1 highest
    }));
    const split = snakeSplitByClass(enrollees, nights, false);
    assert.deepEqual(
      split["41"].map((e) => e.seed),
      [1, 4, 5, 8]
    );
    assert.deepEqual(
      split["42"].map((e) => e.seed),
      [2, 3, 6, 7]
    );
  });

  test("parity swaps the nights without changing the buckets", () => {
    const enrollees = [4, 3, 2, 1].map((n, i) => ({
      key: `u${i}_aClass`,
      uid: `u${i}`,
      corpsClass: "aClass",
      corpsName: `C${i}`,
      score: n,
    }));
    const even = snakeSplitByClass(enrollees, nights, false);
    const odd = snakeSplitByClass(enrollees, nights, true);
    assert.deepEqual(
      even["41"].map((e) => e.key),
      odd["42"].map((e) => e.key)
    );
    assert.deepEqual(
      even["42"].map((e) => e.key),
      odd["41"].map((e) => e.key)
    );
  });

  test("per-class headcount balance within ±1, every class on both nights", () => {
    const enrollees = [];
    for (let i = 0; i < 7; i++) {
      enrollees.push({ key: `w${i}_worldClass`, uid: `w${i}`, corpsClass: "worldClass", corpsName: null, score: i });
    }
    for (let i = 0; i < 4; i++) {
      enrollees.push({ key: `a${i}_aClass`, uid: `a${i}`, corpsClass: "aClass", corpsName: null, score: i });
    }
    const split = snakeSplitByClass(enrollees, nights, false);
    for (const corpsClass of ["worldClass", "aClass"]) {
      const on41 = split["41"].filter((e) => e.corpsClass === corpsClass).length;
      const on42 = split["42"].filter((e) => e.corpsClass === corpsClass).length;
      assert.ok(Math.abs(on41 - on42) <= 1, `${corpsClass}: ${on41} vs ${on42}`);
      assert.ok(on41 > 0 && on42 > 0, `${corpsClass} must appear both nights`);
    }
    assert.equal(split["41"].length + split["42"].length, 11);
  });

  test("unscored corps seed last with deterministic uid tiebreak", () => {
    const enrollees = [
      { key: "z_worldClass", uid: "z", corpsClass: "worldClass", corpsName: null, score: 0 },
      { key: "a_worldClass", uid: "a", corpsClass: "worldClass", corpsName: null, score: 0 },
      { key: "m_worldClass", uid: "m", corpsClass: "worldClass", corpsName: null, score: 90 },
    ];
    const split = snakeSplitByClass(enrollees, nights, false);
    const bySeed = [...split["41"], ...split["42"]].sort((x, y) => x.seed - y.seed);
    assert.deepEqual(
      bySeed.map((e) => e.key),
      ["m_worldClass", "a_worldClass", "z_worldClass"]
    );
  });
});

describe("collectEnrollees / computeSplit", () => {
  test("collects only registrants of the event, with scores", () => {
    const snapshot = {
      docs: [
        profileDoc("u1", {
          corps: {
            worldClass: {
              corpsName: "In",
              totalSeasonScore: 82.5,
              selectedShows: { week6: [{ eventName: "marching.art Eastern Classic", day: 41 }] },
            },
            aClass: {
              corpsName: "Out",
              selectedShows: { week6: [{ eventName: "Elsewhere", day: 40 }] },
            },
          },
        }),
      ],
    };
    const enrollees = collectEnrollees(snapshot, "marching.art Eastern Classic", 6);
    assert.equal(enrollees.length, 1);
    assert.deepEqual(enrollees[0], {
      key: "u1_worldClass",
      uid: "u1",
      corpsClass: "worldClass",
      corpsName: "In",
      score: 82.5,
    });
  });

  test("deterministic: identical inputs produce identical splits", () => {
    const snapshot = snapshotWithCorps(
      Array.from({ length: 9 }, (_, i) => ({ uid: `u${i}`, score: 90 - i }))
    );
    const a = computeSplit(snapshot, "marching.art Eastern Classic", 6, "season_x", [41, 42]);
    const b = computeSplit(snapshot, "marching.art Eastern Classic", 6, "season_x", [41, 42]);
    assert.deepEqual(a, b);
    assert.equal(a.enrolled, 9);
    assert.equal(a.counts["41"] + a.counts["42"], 9);
  });

  test("seasonNightParity is a stable boolean per season", () => {
    const p = seasonNightParity("s2026_summer");
    assert.equal(typeof p, "boolean");
    assert.equal(seasonNightParity("s2026_summer"), p);
  });
});

// --- change detection -------------------------------------------------------

describe("lineupIndex / diffLineups", () => {
  const lineup = (pairs) =>
    lineupIndex({
      41: pairs.filter(([, night]) => night === 41).map(([key], i) => ({
        key, uid: key.split("_")[0], corpsClass: "worldClass", corpsName: key, seed: i + 1,
      })),
      42: pairs.filter(([, night]) => night === 42).map(([key], i) => ({
        key, uid: key.split("_")[0], corpsClass: "worldClass", corpsName: key, seed: i + 1,
      })),
    });

  test("flattens both nights into one key -> placement map", () => {
    const index = lineup([["a_worldClass", 41], ["b_worldClass", 42]]);
    assert.equal(index["a_worldClass"].night, 41);
    assert.equal(index["b_worldClass"].night, 42);
    assert.equal(index["a_worldClass"].uid, "a");
  });

  test("reports moved, added and dropped corps", () => {
    const before = lineup([["a_worldClass", 41], ["b_worldClass", 42], ["c_worldClass", 41]]);
    const after = lineup([["a_worldClass", 42], ["b_worldClass", 42], ["d_worldClass", 41]]);
    const changes = diffLineups(before, after);

    assert.deepEqual(changes.moved.map((e) => [e.key, e.from, e.to]), [["a_worldClass", 41, 42]]);
    assert.deepEqual(changes.added.map((e) => e.key), ["d_worldClass"]);
    assert.deepEqual(changes.removed.map((e) => e.key), ["c_worldClass"]);
    assert.ok(hasLineupChange(changes));
  });

  test("a pure re-seed inside the same night is NOT a change", () => {
    // Seeds churn every time anyone's score moves; announcing that would mean
    // an 'updated lineup' post nearly every night.
    const before = lineupIndex({
      41: [{ key: "a_worldClass", uid: "a", corpsClass: "worldClass", corpsName: "A", seed: 1 }],
      42: [],
    });
    const after = lineupIndex({
      41: [{ key: "a_worldClass", uid: "a", corpsClass: "worldClass", corpsName: "A", seed: 4 }],
      42: [],
    });
    assert.ok(!hasLineupChange(diffLineups(before, after)));
  });

  test("no previous lineup means no change to report", () => {
    assert.ok(!hasLineupChange(diffLineups({}, {})));
    assert.ok(!hasLineupChange(null));
  });
});

// --- republishing a lineup that moved ---------------------------------------

describe("publishEasternPreview", () => {
  const { publishEasternPreview } = require("./easternSplit");
  const seasonData = { seasonUid: "s_pub" };
  const dayEventData = { offSeasonDay: 41, shows: [EASTERN_SHOW] };
  const roster = (n) => Array.from({ length: n }, (_, i) => ({ uid: `u${i}`, score: 80 - i }));

  test("day 38 publishes revision 0; an unchanged day 39 leaves the revision alone", async () => {
    const db = fakeDb();
    const sink = [];
    const snapshot = snapshotWithCorps(roster(6));

    const first = await withStubbedDeps(dayEventData, sink, () =>
      publishEasternPreview(db, seasonData, snapshot, 38)
    );
    assert.equal(first.revision, 0);
    assert.equal(first.changed, true);
    assert.equal(sink.length, 0, "nobody is told about the FIRST lineup — it is the lineup");

    const second = await withStubbedDeps(dayEventData, sink, () =>
      publishEasternPreview(db, seasonData, snapshot, 39)
    );
    assert.equal(second.changed, false);
    assert.equal(second.revision, 0);
    assert.equal(db._docs["eastern-classic/s_pub"].preview.revision, 0);
    // Refreshed anyway, so seeds and names never go stale in the app.
    assert.equal(db._docs["eastern-classic/s_pub"].preview.computedAfterDay, 39);
    assert.equal(sink.length, 0);
  });

  test("a late registration re-seeds the snake: revision bumps and moved directors are told", async () => {
    const db = fakeDb();
    const sink = [];
    await withStubbedDeps(dayEventData, sink, () =>
      publishEasternPreview(db, seasonData, snapshotWithCorps(roster(6)), 38)
    );
    const before = db._docs["eastern-classic/s_pub"].preview.assignments;

    // A top-seeded corps registers on day 39, shifting every snake index.
    const withLatecomer = snapshotWithCorps([{ uid: "late", score: 99 }, ...roster(6)]);
    const result = await withStubbedDeps(dayEventData, sink, () =>
      publishEasternPreview(db, seasonData, withLatecomer, 39)
    );

    assert.equal(result.changed, true);
    assert.equal(result.revision, 1);
    assert.deepEqual(result.changes.added.map((e) => e.uid), ["late"]);
    assert.ok(result.changes.moved.length > 0, "a re-seed must move somebody");
    assert.notDeepEqual(db._docs["eastern-classic/s_pub"].preview.assignments, before);

    // One inbox entry per moved corps, naming the new night, deduped per
    // revision so a re-run cannot double-notify.
    assert.equal(sink.length, result.changes.moved.length);
    for (const entry of sink) {
      assert.equal(entry.type, "eastern_night_change");
      assert.match(entry.message, /now performs Night [12] \(Day 4[12]\)/);
      assert.match(entry.dedupeKey, /^eastern_night_s_pub_r1_/);
    }
    // The corps that just joined is seeing its night for the first time.
    assert.ok(!sink.some((entry) => entry.uid === "late"));
  });

  test("silent outside days 38-40, and never over a locked final split", async () => {
    const sink = [];
    for (const day of [37, 41, 42]) {
      const db = fakeDb();
      const result = await withStubbedDeps(dayEventData, sink, () =>
        publishEasternPreview(db, seasonData, snapshotWithCorps(roster(4)), day)
      );
      assert.equal(result, null, `day ${day} must not republish`);
      assert.deepEqual(db._docs, {});
    }

    const locked = fakeDb({
      "eastern-classic/s_pub": { final: { assignments: { 41: [], 42: [] } } },
    });
    const result = await withStubbedDeps(dayEventData, sink, () =>
      publishEasternPreview(locked, seasonData, snapshotWithCorps(roster(4)), 40)
    );
    assert.equal(result, null);
    assert.equal(locked._docs["eastern-classic/s_pub"].preview, undefined);
  });
});

// --- the persistence regression --------------------------------------------

describe("resolveEasternNightSet", () => {
  const seasonData = { seasonUid: "s_test" };
  const dayEventData = { offSeasonDay: 41, shows: [EASTERN_SHOW] };

  test("day 41 persists the final split; day 42 scores the complement despite enrollment edits", async () => {
    const db = fakeDb();
    const before = snapshotWithCorps(
      Array.from({ length: 6 }, (_, i) => ({ uid: `u${i}`, score: 80 - i }))
    );
    const night41 = await resolveEasternNightSet(db, seasonData, before, dayEventData, 6, 41);
    assert.ok(night41 instanceof Set);
    assert.ok(db._docs["eastern-classic/s_test"].final, "final split must persist at day 41");

    // Between the nights, a NEW corps registers (this shifted the v0
    // alphabetical split point). Day 42 must still be the stored complement.
    const after = snapshotWithCorps([
      ...Array.from({ length: 6 }, (_, i) => ({ uid: `u${i}`, score: 80 - i })),
      { uid: "aaa_latecomer", score: 99 },
    ]);
    const night42 = await resolveEasternNightSet(
      db, seasonData, after, { offSeasonDay: 42, shows: [EASTERN_SHOW] }, 6, 42
    );

    const union = new Set([...night41, ...night42]);
    assert.equal(union.size, 6, "every original corps performs exactly once");
    for (const key of night41) {
      assert.ok(!night42.has(key), `${key} must not perform both nights`);
    }
    assert.ok(!union.has("aaa_latecomer_worldClass"), "post-lock registrant is not injected into night 2");
  });

  test("returns null when the day has no two-night show", async () => {
    const db = fakeDb();
    const snapshot = snapshotWithCorps([{ uid: "u1", score: 50 }]);
    const result = await resolveEasternNightSet(
      db, seasonData, snapshot, { shows: [{ eventName: "Normal Show" }] }, 6, 41
    );
    assert.equal(result, null);
  });
});
