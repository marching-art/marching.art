// The single overall Podium regional champion per major (§5.11): only the three
// branded majors crown, day 41 defers, and day 42 combines both Eastern nights.
// Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { resolvePodiumRegionalChampion } = require("./regionalAward");
const store = require("./store");

// Minimal fake db + store shim: only store.recapDayRef(db, seasonUid, 41).get()
// is exercised (to read the day-41 recap for the Eastern combine). `docs` maps
// a recap-day path to its stored data.
function fakeDb(docs = new Map()) {
  return {
    doc: (path) => ({
      async get() {
        return { exists: docs.has(path), data: () => docs.get(path) };
      },
    }),
  };
}

const SW = "marching.art Southwestern Championship";
const EASTERN = "marching.art Eastern Classic";
const pRes = (uid, totalScore) => ({ uid, corpsClass: "podiumClass", totalScore });
const season = { seasonUid: "pods-1", name: "Podium 2026" };
const call = (db, day, label, shows) =>
  resolvePodiumRegionalChampion(db, store, season, day, label, shows);

describe("resolvePodiumRegionalChampion", () => {
  test("non-major days crown nobody", async () => {
    const shows = [{ eventName: "Some Pool Show", results: [pRes("u1", 99)] }];
    assert.equal(await call(fakeDb(), 30, undefined, shows), null);
  });

  test("day 28: top podiumClass corps at the major wins; pool shows ignored", async () => {
    const shows = [
      { eventName: "The Buccaneer Classic", results: [pRes("pool", 99)] },
      { eventName: SW, results: [pRes("second", 88), pRes("champ", 91), pRes("third", 80)] },
    ];
    const result = await call(fakeDb(), 28, SW, shows);
    assert.equal(result.uid, "champ");
    assert.deepEqual(result.trophy, {
      type: "regional",
      corpsClass: "podiumClass",
      seasonName: season.name,
      eventName: SW,
      score: 91,
      rank: 1,
    });
  });

  test("day 41 (Eastern night 1) defers — no champion from a half-field", async () => {
    const shows = [{ eventName: EASTERN, results: [pRes("friday", 95)] }];
    assert.equal(await call(fakeDb(), 41, EASTERN, shows), null);
  });

  test("day 42: champion comes from the COMBINED two-night field", async () => {
    // Night 1's star (95) outscores everyone on night 2 (max 90); the trophy
    // must go to the night-1 corps even though it isn't in the day-42 recap.
    const docs = new Map([
      [
        `podium-recaps/${season.seasonUid}/days/41`,
        { shows: [{ eventName: EASTERN, results: [pRes("fridayStar", 95)] }] },
      ],
    ]);
    const shows = [{ eventName: EASTERN, results: [pRes("saturdayBest", 90)] }];
    const result = await call(fakeDb(docs), 42, EASTERN, shows);
    assert.equal(result.uid, "fridayStar");
    assert.equal(result.trophy.score, 95);
    assert.equal(result.trophy.eventName, EASTERN);
  });

  test("day 42 with no day-41 recap crowns the night-2 leader (graceful)", async () => {
    const shows = [{ eventName: EASTERN, results: [pRes("sat1", 70), pRes("sat2", 85)] }];
    const result = await call(fakeDb(), 42, EASTERN, shows);
    assert.equal(result.uid, "sat2");
  });
});
