const { describe, test } = require("node:test");
const assert = require("node:assert/strict");

const {
  PODIUM_HALL_CLASSES,
  PODIUM_HALL_CLASS_KEYS,
  HALL_CLASS_KEYS,
  HALL_CLASS_LABELS,
  HALL_DIVISION_OF,
  isHallClassKey,
  isPodiumHallClassKey,
  buildPodiumHallPodiums,
  withDirectorIdentity,
  carryBanners,
} = require("./hallOfChampions");

// A frozen Podium season record: ranked on the whole field, each corps
// carrying the division it competed in. An Open Class corps sits 2nd overall.
const RECORD = [
  { uid: "w1", corpsName: "Crimson", lastTotal: 95.1, division: "worldClass", place: 1 },
  { uid: "o1", corpsName: "Onyx", lastTotal: 94.2, division: "openClass", place: 2 },
  { uid: "w2", corpsName: "Cobalt", lastTotal: 93.9, division: "worldClass", place: 3 },
  { uid: "w3", corpsName: "Verdant", lastTotal: 92.0, division: "worldClass", place: 4 },
  { uid: "a1", corpsName: "Amber", lastTotal: 88.4, division: "aClass", place: 5 },
  { uid: "o2", corpsName: "Opal", lastTotal: 87.0, division: "openClass", place: 6 },
  { uid: "a2", corpsName: "Ash", lastTotal: 80.5, division: "aClass", place: 7 },
  { uid: "o3", corpsName: "Ochre", lastTotal: 79.0, division: "openClass", place: 8 },
  { uid: "o4", corpsName: "Olive", lastTotal: 70.0, division: "openClass", place: 9 },
];

describe("Hall class keys", () => {
  test("both divisions' classes are Hall keys, labelled and assigned to a division", () => {
    assert.deepEqual(
      [...HALL_CLASS_KEYS],
      ["worldClass", "openClass", "aClass", "soundSport", "podiumClass", "podiumOpenClass", "podiumAClass"]
    );
    for (const key of HALL_CLASS_KEYS) {
      assert.ok(isHallClassKey(key), key);
      assert.equal(typeof HALL_CLASS_LABELS[key], "string", key);
      assert.ok(["fantasy", "podium"].includes(HALL_DIVISION_OF[key]), key);
    }
    assert.ok(!isHallClassKey("megaClass"));
    assert.ok(!isHallClassKey("worldChampionship"));
  });

  test("the Podium keys map from the three divisions, World first", () => {
    assert.deepEqual([...PODIUM_HALL_CLASS_KEYS], ["podiumClass", "podiumOpenClass", "podiumAClass"]);
    assert.equal(PODIUM_HALL_CLASSES.worldClass, "podiumClass");
    for (const key of PODIUM_HALL_CLASS_KEYS) {
      assert.ok(isPodiumHallClassKey(key));
      assert.equal(HALL_DIVISION_OF[key], "podium");
    }
    assert.ok(!isPodiumHallClassKey("worldClass"));
    // Both World keys are billed as championships, never as a class.
    assert.equal(HALL_CLASS_LABELS.worldClass, "World Championship");
    assert.equal(HALL_CLASS_LABELS.podiumClass, "Podium World Championship");
  });
});

describe("buildPodiumHallPodiums", () => {
  test("the World podium is the top three of the whole field, whatever their division", () => {
    const podiums = buildPodiumHallPodiums(RECORD);
    assert.deepEqual(
      podiums.podiumClass.map((e) => [e.rank, e.uid, e.corpsClass, e.score]),
      [
        [1, "w1", "worldClass", 95.1],
        [2, "o1", "openClass", 94.2],
        [3, "w2", "worldClass", 93.9],
      ]
    );
  });

  test("Open and A Class podiums are the top three within that division, re-ranked 1..3", () => {
    const podiums = buildPodiumHallPodiums(RECORD);
    assert.deepEqual(
      podiums.podiumOpenClass.map((e) => [e.rank, e.uid]),
      [
        [1, "o1"],
        [2, "o2"],
        [3, "o3"],
      ]
    );
    assert.deepEqual(
      podiums.podiumAClass.map((e) => [e.rank, e.uid]),
      [
        [1, "a1"],
        [2, "a2"],
      ]
    );
    for (const entry of podiums.podiumOpenClass) assert.equal(entry.corpsClass, "openClass");
    for (const entry of podiums.podiumAClass) assert.equal(entry.corpsClass, "aClass");
  });

  test("the Open champion can also stand on the World podium", () => {
    const podiums = buildPodiumHallPodiums(RECORD);
    assert.equal(podiums.podiumClass[1].uid, "o1");
    assert.equal(podiums.podiumOpenClass[0].uid, "o1");
  });

  test("a division nobody competed in is omitted, not written empty", () => {
    const podiums = buildPodiumHallPodiums(RECORD.filter((e) => e.division !== "aClass"));
    assert.ok(!("podiumAClass" in podiums));
    assert.equal(podiums.podiumOpenClass.length, 3);
  });

  test("a corps with no division recorded is an A Class corps (a first season is always A)", () => {
    const podiums = buildPodiumHallPodiums([
      { uid: "x", corpsName: "Nameless", lastTotal: 60 },
      { uid: "y", corpsName: "Also", lastTotal: 50, division: "notADivision" },
    ]);
    assert.deepEqual(
      podiums.podiumAClass.map((e) => [e.rank, e.uid, e.corpsClass]),
      [
        [1, "x", "aClass"],
        [2, "y", "aClass"],
      ]
    );
    assert.ok(!("podiumOpenClass" in podiums));
  });

  test("accepts entries that carry `score` instead of `lastTotal` (already-archived Hall rows)", () => {
    const podiums = buildPodiumHallPodiums([{ uid: "x", corpsName: "N", score: 61.5, division: "worldClass" }]);
    assert.equal(podiums.podiumClass[0].score, 61.5);
  });

  test("an empty or missing record produces no podiums", () => {
    assert.deepEqual(buildPodiumHallPodiums([]), {});
    assert.deepEqual(buildPodiumHallPodiums(null), {});
  });
});

describe("withDirectorIdentity", () => {
  test("resolves each director once and stamps username + avatar on every entry", async () => {
    const podiums = buildPodiumHallPodiums(RECORD);
    const seen = [];
    const resolved = await withDirectorIdentity(podiums, async (uid) => {
      seen.push(uid);
      if (uid === "o1") return { username: "opal_dir", avatarUrl: "https://cdn/o1.png" };
      if (uid === "w1") throw new Error("profile read failed");
      return null;
    });
    // o1 sits on two podiums but is looked up once.
    assert.equal(seen.filter((u) => u === "o1").length, 1);
    assert.equal(resolved.podiumClass[1].username, "opal_dir");
    assert.equal(resolved.podiumOpenClass[0].avatarUrl, "https://cdn/o1.png");
    // A failed or empty lookup never breaks the podium.
    assert.equal(resolved.podiumClass[0].username, "Unknown");
    assert.equal(resolved.podiumClass[0].avatarUrl, null);
    assert.equal(resolved.podiumAClass[0].username, "Unknown");
  });
});

describe("carryBanners", () => {
  test("a banner on the same champion's entry survives a rewrite; nothing else is touched", () => {
    const existing = {
      podiumClass: [
        { rank: 1, uid: "w1", banner: { message: "Ours", purchasedAt: "2026-01-01" } },
        { rank: 2, uid: "o1" },
      ],
      podiumAClass: [{ rank: 1, uid: "a9", banner: { message: "Old A champ" } }],
    };
    const next = buildPodiumHallPodiums(RECORD);
    const carried = carryBanners(existing, next);
    assert.deepEqual(carried.podiumClass[0].banner, { message: "Ours", purchasedAt: "2026-01-01" });
    assert.equal(carried.podiumClass[1].banner, undefined);
    // A different director now holds A Class rank 1 — the old banner does not move to them.
    assert.equal(carried.podiumAClass[0].banner, undefined);
    // Pure: the rebuilt map was not mutated.
    assert.equal(next.podiumClass[0].banner, undefined);
    assert.deepEqual(carryBanners(undefined, next), next);
  });
});
