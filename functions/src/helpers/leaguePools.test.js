// Settlement behavior for league prediction pools: perfect-day winners split
// the pot, remainders and winnerless pots carry to the league's next pool,
// unresolved entrant buckets resolve read-only against the recaps, and an
// already-settled pool is never re-paid.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  POOL_ANTE,
  completedGameDayString,
  entrantHadPerfectDay,
  settleLeaguePoolsForDay,
} = require("./leaguePools");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
const leaguesPath = `artifacts/${NS}/leagues`;

// Fixed clock: 12:00 UTC on Jan 15 → the completed game day is Jan 14.
const NOW = new Date("2026-01-15T12:00:00Z");
const GAME_DAY = "Wed Jan 14 2026";

/** Fake Firestore covering what settlement touches. */
function makeFakeDb({ leagues = [], recapDays = [], docs = new Map() } = {}) {
  const writes = [];
  let autoId = 0;

  const makeDocRef = (path) => ({
    path,
    id: path.split("/").pop(),
    collection(name) {
      const subPath = `${path}/${name}`;
      return {
        doc(id) {
          return makeDocRef(`${subPath}/${id ?? `auto-${++autoId}`}`);
        },
      };
    },
    async get() {
      return { exists: docs.has(path), data: () => docs.get(path) };
    },
  });

  const makeQuery = (items) => ({
    async get() {
      return { empty: items.length === 0, size: items.length, docs: items };
    },
    where: () => makeQuery(items),
    limit: () => makeQuery(items),
    orderBy: () => makeQuery(items),
  });

  const db = {
    doc(path) {
      return makeDocRef(path);
    },
    collection(path) {
      if (path === leaguesPath) {
        return makeQuery(
          leagues.map((l) => ({
            id: l.id,
            ref: makeDocRef(`${leaguesPath}/${l.id}`),
            data: () => l.data,
          }))
        );
      }
      if (path.startsWith("fantasy_recaps/")) {
        return makeQuery(recapDays.map((d) => ({ data: () => d })));
      }
      return {
        ...makeQuery([]),
        doc(id) {
          return makeDocRef(`${path}/${id ?? `auto-${++autoId}`}`);
        },
      };
    },
    async getAll(...refs) {
      return refs.map((ref) => ({
        exists: docs.has(ref.path),
        data: () => docs.get(ref.path),
      }));
    },
    batch() {
      return {
        set(ref, data, options) {
          writes.push({ type: "set", path: ref.path, data, options });
        },
        update(ref, data) {
          writes.push({ type: "update", path: ref.path, data });
        },
        async commit() {},
      };
    },
  };

  return { db, writes };
}

const seasonData = { seasonUid: "season-1" };
const poolPath = (leagueId) => `${leaguesPath}/${leagueId}/pools/${GAME_DAY}`;

const perfectBucket = {
  corpsClass: "worldClass",
  resolved: true,
  results: { "over-under": { isCorrect: true }, podium: { isCorrect: true } },
  picks: { "over-under": { pick: "Over" }, podium: { pick: "Yes" } },
};

describe("completedGameDayString", () => {
  test("names the game day whose results this run posted", () => {
    assert.equal(completedGameDayString(NOW), GAME_DAY);
  });

  test("off-season: the 9 PM ET drop settles THAT evening's pool", () => {
    // 9:05 PM EST Jan 14 = 02:05 UTC Jan 15 — the drop scores Jan 14 itself,
    // so it settles Jan 14's pool (with the live 2 AM rule this instant would
    // still name Jan 13).
    const dropTime = new Date("2026-01-15T02:05:00Z");
    assert.equal(completedGameDayString(dropTime, "off-season"), GAME_DAY);
    assert.equal(completedGameDayString(dropTime), "Tue Jan 13 2026");
  });
});

describe("entrantHadPerfectDay", () => {
  test("no picks is never a perfect day", () => {
    assert.equal(entrantHadPerfectDay("u", {}, GAME_DAY, {}), false);
    assert.equal(
      entrantHadPerfectDay("u", { predictions: { [GAME_DAY]: { picks: {} } } }, GAME_DAY, {}),
      false
    );
  });

  test("uses the already-resolved bucket when present", () => {
    const profile = { predictions: { [GAME_DAY]: perfectBucket } };
    assert.equal(entrantHadPerfectDay("u", profile, GAME_DAY, {}), true);

    const missed = {
      predictions: {
        [GAME_DAY]: {
          ...perfectBucket,
          results: { podium: { isCorrect: false } },
        },
      },
    };
    assert.equal(entrantHadPerfectDay("u", missed, GAME_DAY, {}), false);
  });

  test("resolves an unresolved bucket read-only against the recaps", () => {
    const profile = {
      predictions: {
        [GAME_DAY]: {
          corpsClass: "worldClass",
          resolved: false,
          snapshotEvent: "Show A",
          picks: {
            podium: { pick: "Yes", threshold: 3 },
            "over-under": { pick: "Over", threshold: 70 },
          },
        },
      },
    };
    const recapDays = [
      {
        offSeasonDay: 10,
        shows: [
          {
            eventName: "Show B",
            results: [{ uid: "u", corpsClass: "worldClass", totalScore: 80, placement: 2 }],
          },
        ],
      },
    ];
    assert.equal(entrantHadPerfectDay("u", profile, GAME_DAY, { fantasy: recapDays }), true);
  });

  test("resolves an unresolved Podium bucket against podium-recaps", () => {
    // Podium picks store their threshold from podium-recaps; settlement must
    // resolve them against the SAME source (result.place / totalScore, keyed
    // by uid) or a podium entrant's perfect day is never counted.
    const profile = {
      predictions: {
        [GAME_DAY]: {
          corpsClass: "podiumClass",
          resolved: false,
          snapshotEvent: "Show A",
          picks: {
            podium: { pick: "Yes", threshold: 3 },
            "over-under": { pick: "Over", threshold: 70 },
          },
        },
      },
    };
    const podiumDays = [
      {
        competitionDay: 10,
        shows: [
          {
            eventName: "Show B",
            results: [{ uid: "u", totalScore: 80, place: 2 }],
          },
        ],
      },
    ];
    // Fantasy recaps hold nothing for this director — the old code read only
    // these and missed the win.
    assert.equal(entrantHadPerfectDay("u", profile, GAME_DAY, { fantasy: [] }), false);
    assert.equal(
      entrantHadPerfectDay("u", profile, GAME_DAY, { podium: podiumDays }),
      true
    );
  });

  test("a single-pick perfect day never wins the pool (min 2 answered)", () => {
    // Personal perfect-day bonus accepts one pick; pool wins take other
    // members' antes, so a one-question coin-flip is excluded.
    const onePickResolved = {
      predictions: {
        [GAME_DAY]: {
          corpsClass: "worldClass",
          resolved: true,
          results: { podium: { isCorrect: true } },
          picks: { podium: { pick: "Yes" } },
        },
      },
    };
    assert.equal(entrantHadPerfectDay("u", onePickResolved, GAME_DAY, {}), false);

    const onePickUnresolved = {
      predictions: {
        [GAME_DAY]: {
          corpsClass: "worldClass",
          resolved: false,
          snapshotEvent: "Show A",
          picks: { podium: { pick: "Yes", threshold: 3 } },
        },
      },
    };
    const recapDays = [
      {
        offSeasonDay: 10,
        shows: [
          {
            eventName: "Show B",
            results: [{ uid: "u", corpsClass: "worldClass", totalScore: 80, placement: 2 }],
          },
        ],
      },
    ];
    assert.equal(
      entrantHadPerfectDay("u", onePickUnresolved, GAME_DAY, { fantasy: recapDays }),
      false
    );
  });
});

describe("settleLeaguePoolsForDay", () => {
  test("winners split the pot; remainder carries to the league", async () => {
    const docs = new Map([
      [
        poolPath("league-1"),
        { gameDay: GAME_DAY, pot: 75, entrants: { alice: true, bob: true, carol: true } },
      ],
      [profilePath("alice"), { predictions: { [GAME_DAY]: perfectBucket } }],
      [profilePath("bob"), { predictions: { [GAME_DAY]: perfectBucket } }],
      [profilePath("carol"), {}], // never picked — not a winner
    ]);
    const { db, writes } = makeFakeDb({
      leagues: [{ id: "league-1", data: { name: "Test League" } }],
      docs,
    });

    await settleLeaguePoolsForDay(db, seasonData, NOW);

    const poolWrite = writes.find((w) => w.path === poolPath("league-1"));
    assert.equal(poolWrite.data.resolved, true);
    assert.deepEqual(poolWrite.data.winners.sort(), ["alice", "bob"]);
    assert.equal(poolWrite.data.paidPerWinner, 37); // floor(75/2)

    for (const uid of ["alice", "bob"]) {
      assert.ok(
        writes.find((w) => w.path === profilePath(uid) && w.data.corpsCoin),
        `${uid} should be paid`
      );
      assert.ok(
        writes.find(
          (w) =>
            w.path.startsWith(`artifacts/${NS}/users/${uid}/corpsCoinHistory/`) &&
            w.data.type === "league_pool_win" &&
            w.data.amount === 37
        ),
        `${uid} should get a history entry`
      );
    }
    assert.equal(
      writes.find((w) => w.path === profilePath("carol") && w.data.corpsCoin),
      undefined
    );

    // 75 - 2*37 = 1 CC carries to the league's next pool
    const carryWrite = writes.find((w) => w.path === `${leaguesPath}/league-1` && w.data.poolCarry);
    assert.ok(carryWrite, "remainder should carry");

    const activity = writes.find((w) => w.path.includes("/activity/"));
    assert.equal(activity.data.type, "pool_result");
    assert.equal(activity.data.metadata.pot, 75);
  });

  test("a winnerless pot carries over whole", async () => {
    const docs = new Map([
      [poolPath("league-1"), { gameDay: GAME_DAY, pot: 50, entrants: { carol: true } }],
      [profilePath("carol"), {}],
    ]);
    const { db, writes } = makeFakeDb({
      leagues: [{ id: "league-1", data: { name: "Test League" } }],
      docs,
    });

    await settleLeaguePoolsForDay(db, seasonData, NOW);

    const poolWrite = writes.find((w) => w.path === poolPath("league-1"));
    assert.deepEqual(poolWrite.data.winners, []);
    const carryWrite = writes.find((w) => w.path === `${leaguesPath}/league-1` && w.data.poolCarry);
    assert.ok(carryWrite, "the whole pot should carry");
    assert.equal(writes.filter((w) => w.path.includes("/corpsCoinHistory/")).length, 0);
  });

  test("an already-settled pool is never re-paid", async () => {
    const docs = new Map([
      [
        poolPath("league-1"),
        { gameDay: GAME_DAY, pot: 50, entrants: { alice: true }, resolved: true },
      ],
      [profilePath("alice"), { predictions: { [GAME_DAY]: perfectBucket } }],
    ]);
    const { db, writes } = makeFakeDb({
      leagues: [{ id: "league-1", data: { name: "Test League" } }],
      docs,
    });

    await settleLeaguePoolsForDay(db, seasonData, NOW);
    assert.equal(writes.length, 0);
  });

  test("leagues without a pool for the day are skipped", async () => {
    const { db, writes } = makeFakeDb({
      leagues: [{ id: "league-1", data: { name: "Test League" } }],
    });
    await settleLeaguePoolsForDay(db, seasonData, NOW);
    assert.equal(writes.length, 0);
  });

  test("the ante is a sane fraction of a day's earnings", () => {
    assert.ok(POOL_ANTE > 0 && POOL_ANTE <= 100);
  });
});
