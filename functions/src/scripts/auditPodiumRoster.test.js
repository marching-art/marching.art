// The pure half of the roster audit: classifying roster entries against their
// state docs, and stripping stray corps out of recaps and standings sheets.
// Firestore traversal is exercised by running the script itself (--dry-run).
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  classifyRoster,
  stripRecapStrays,
  stripSheetStrays,
  parseArgs,
} = require("./auditPodiumRoster");

const SEASON = "overture_2026-27";
const cfg = { minFieldSize: 4 };

describe("classifyRoster", () => {
  test("a corps whose state agrees with the roster's season is active", () => {
    const { active, orphans } = classifyRoster(
      [{ uid: "a", roster: { corpsName: "Alpha", createdAt: "2026-08-10" }, state: { seasonUid: SEASON, corpsName: "Alpha" } }],
      SEASON
    );
    assert.deepEqual(active, [{ uid: "a", corpsName: "Alpha", createdAt: "2026-08-10" }]);
    assert.deepEqual(orphans, []);
  });

  test("a stale-season state or a missing state is an orphan, with the reason", () => {
    const { active, orphans } = classifyRoster(
      [
        { uid: "old", roster: { corpsName: "Old", createdAt: "2026-06-01" }, state: { seasonUid: "live_2026-26", corpsName: "Old" } },
        { uid: "ghost", roster: { corpsName: "Ghost" }, state: null },
      ],
      SEASON
    );
    assert.deepEqual(active, []);
    assert.deepEqual(
      orphans.map((o) => [o.uid, o.reason]),
      [
        ["old", "state holds live_2026-26"],
        ["ghost", "no state doc"],
      ]
    );
  });
});

describe("stripRecapStrays", () => {
  const recap = () => ({
    shows: [
      {
        eventName: "marching.art Southwestern Championship",
        results: [
          { uid: "w1", division: "worldClass", totalScore: 90, place: 1, fieldSize: 3, medal: "gold" },
          { uid: "stray", division: "worldClass", totalScore: 89, place: 2, fieldSize: 3, medal: "silver" },
          { uid: "w2", division: "worldClass", totalScore: 88, place: 3, fieldSize: 3, medal: "bronze" },
          { uid: "a1", division: "aClass", totalScore: 80, place: 1, fieldSize: 1, medal: null },
        ],
      },
    ],
  });

  test("drops the stray rows and re-ranks the show within division", () => {
    const doc = recap();
    const { changed, removed } = stripRecapStrays(doc, new Set(["w1", "w2", "a1"]), cfg);
    assert.equal(changed, true);
    assert.deepEqual(removed, [{ uid: "stray", eventName: "marching.art Southwestern Championship" }]);
    const rows = doc.shows[0].results;
    assert.deepEqual(rows.map((r) => r.uid), ["w1", "w2", "a1"]);
    const w2 = rows.find((r) => r.uid === "w2");
    assert.equal(w2.place, 2);
    assert.equal(w2.fieldSize, 2);
    // Three corps at the show is under the medal floor, so no medals remain.
    assert.ok(rows.every((r) => r.medal === null));
  });

  test("a recap with no strays is untouched", () => {
    const doc = recap();
    const before = JSON.stringify(doc);
    const { changed } = stripRecapStrays(doc, new Set(["w1", "stray", "w2", "a1"]), cfg);
    assert.equal(changed, false);
    assert.equal(JSON.stringify(doc), before);
  });

  test("a legacy flat recap keeps its flat shape", () => {
    const doc = { results: [{ uid: "keep", totalScore: 80 }, { uid: "stray", totalScore: 70 }] };
    const { changed } = stripRecapStrays(doc, new Set(["keep"]), cfg);
    assert.equal(changed, true);
    assert.deepEqual(doc.results.map((r) => r.uid), ["keep"]);
    assert.equal(doc.shows, undefined);
  });
});

describe("stripSheetStrays", () => {
  test("drops strays from a standings sheet and re-numbers ranks", () => {
    const sheet = {
      day: 28,
      fieldSize: 3,
      entries: [
        { uid: "a", rank: 1, movement: 0 },
        { uid: "stray", rank: 2, movement: 1 },
        { uid: "b", rank: 3, movement: -1 },
      ],
    };
    const { changed, removed } = stripSheetStrays(sheet, new Set(["a", "b"]));
    assert.equal(changed, true);
    assert.deepEqual(removed, ["stray"]);
    assert.deepEqual(sheet.entries.map((e) => [e.uid, e.rank]), [["a", 1], ["b", 2]]);
    assert.equal(sheet.fieldSize, 2);
  });

  test("a clean sheet is untouched", () => {
    const sheet = { fieldSize: 1, entries: [{ uid: "a", rank: 1 }] };
    assert.equal(stripSheetStrays(sheet, new Set(["a"])).changed, false);
  });
});

describe("parseArgs", () => {
  test("defaults to a dry run and reads --commit / --season", () => {
    assert.deepEqual(parseArgs([]), { commit: false, season: null });
    assert.deepEqual(parseArgs(["--commit", "--season", "x"]), { commit: true, season: "x" });
    assert.deepEqual(parseArgs(["--dry-run"]), { commit: false, season: null });
  });
});
