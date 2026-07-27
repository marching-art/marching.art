// Buying an alternate scoring format. Exercises the REAL onCall handler via
// the v2 `.run()` hook with a fake Firestore (same harness as
// leaguePools.test.js).
//
// The rules being pinned here are product decisions, not implementation
// details: the commissioner pays, from their own balance, never from the prize
// pool, and never mid-season.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { setLeagueScoringFormat, seasonUnderway } = require("./leagueFormat");
const { SCORING_FORMATS, CAPTION_WARS_SEASON_COST } = require("../helpers/captionWars");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
const leaguePath = (id) => `artifacts/${NS}/leagues/${id}`;
const matchupsPath = (id) => `${leaguePath(id)}/matchups`;

function makeFakeDb(docs = new Map(), collections = new Map()) {
  const writes = [];
  let autoId = 0;

  const makeDocRef = (path) => ({
    path,
    id: path.split("/").pop(),
    collection(name) {
      return makeCollectionRef(`${path}/${name}`);
    },
    async get() {
      return { exists: docs.has(path), data: () => docs.get(path) };
    },
    async set(data) {
      docs.set(path, data);
      writes.push({ type: "docSet", path, data });
    },
  });

  const makeCollectionRef = (path) => ({
    path,
    doc(id) {
      return makeDocRef(`${path}/${id ?? `auto-${++autoId}`}`);
    },
    async get() {
      const entries = collections.get(path) || [];
      return {
        empty: entries.length === 0,
        size: entries.length,
        docs: entries.map(([id, data]) => ({ id, data: () => data })),
      };
    },
  });

  const db = {
    doc: (path) => makeDocRef(path),
    collection: (path) => makeCollectionRef(path),
    async runTransaction(fn) {
      return fn({
        async get(ref) {
          return { exists: docs.has(ref.path), data: () => docs.get(ref.path) };
        },
        update(ref, data) {
          docs.set(ref.path, { ...(docs.get(ref.path) || {}), ...data });
          writes.push({ type: "update", path: ref.path, data });
        },
        set(ref, data, options) {
          writes.push({ type: "set", path: ref.path, data, options });
        },
      });
    },
  };
  return { db, writes };
}

const authedRequest = (uid, data = {}) => ({ data, auth: { uid, token: {} } });

/** A league in preseason: season doc set, no matchups generated yet. */
const preseason = ({ balance = 10000, settings = {}, creatorId = "boss" } = {}) =>
  new Map([
    ["game-settings/season", { seasonUid: "season-2" }],
    [
      leaguePath("l1"),
      { name: "Test League", creatorId, members: [creatorId, "member"], settings },
    ],
    [profilePath(creatorId), { corpsCoin: balance }],
    [profilePath("member"), { corpsCoin: balance }],
  ]);

after(() => setDbForTesting(null));

describe("seasonUnderway", () => {
  const doc = (id, data = {}) => ({ id, data: () => data });

  test("an empty matchup collection is preseason", () => {
    assert.equal(seasonUnderway([], "season-2"), false);
  });

  test("a week generated for this season means the season has started", () => {
    assert.equal(seasonUnderway([doc("week-1", { seasonUid: "season-2" })], "season-2"), true);
  });

  // Rollover MOVES finished weeks out of the live collection, so a leftover
  // week belonging to another season is not this season's business.
  test("a week left behind from a previous season does not count", () => {
    assert.equal(seasonUnderway([doc("week-7", { seasonUid: "season-1" })], "season-2"), false);
  });

  // A document written before weeks carried a season stamp: rollover empties
  // the collection, so anything unstamped still here belongs to now. Same
  // reading the matchup generator uses.
  test("an unstamped week is treated as this season's", () => {
    assert.equal(seasonUnderway([doc("week-1")], "season-2"), true);
  });

  test("ignores documents that are not week-N", () => {
    assert.equal(seasonUnderway([doc("summary", { seasonUid: "season-2" })], "season-2"), false);
  });
});

describe("setLeagueScoringFormat", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects unauthenticated calls", async () => {
    await assert.rejects(
      setLeagueScoringFormat.run({ data: { leagueId: "l1" }, auth: null }),
      /logged in/i
    );
  });

  test("rejects an unknown format", async () => {
    const { db } = makeFakeDb(preseason());
    setDbForTesting(db);
    await assert.rejects(
      setLeagueScoringFormat.run(authedRequest("boss", { leagueId: "l1", format: "dartboard" })),
      /must be one of/i
    );
  });

  test("rejects a member who is not the commissioner", async () => {
    const { db } = makeFakeDb(preseason());
    setDbForTesting(db);
    await assert.rejects(
      setLeagueScoringFormat.run(
        authedRequest("member", { leagueId: "l1", format: SCORING_FORMATS.CAPTION_WARS })
      ),
      /Only a commissioner/i
    );
  });

  test("charges the commissioner and pins the format to the live season", async () => {
    const { db, writes } = makeFakeDb(preseason());
    setDbForTesting(db);

    const result = await setLeagueScoringFormat.run(
      authedRequest("boss", { leagueId: "l1", format: SCORING_FORMATS.CAPTION_WARS })
    );

    assert.equal(result.charged, CAPTION_WARS_SEASON_COST);

    const leagueWrite = writes.find((w) => w.path === leaguePath("l1"));
    assert.equal(leagueWrite.data["settings.scoringFormat"], SCORING_FORMATS.CAPTION_WARS);
    // Pinned to the season it was bought for — resolution requires both, so a
    // stale format can never switch a league into a format nobody bought.
    assert.equal(leagueWrite.data["settings.scoringFormatSeasonUid"], "season-2");

    const debit = writes.find((w) => w.path === profilePath("boss") && w.data.corpsCoin);
    assert.ok(debit, "the commissioner's own balance is debited");

    const history = writes.find((w) => w.data?.type === "league_format");
    assert.equal(history.data.amount, -CAPTION_WARS_SEASON_COST);
  });

  // The prize pool is members' escrow. The same reasoning that makes entryFee
  // uneditable makes the pool unspendable by the commissioner.
  test("never touches the prize pool", async () => {
    const { db, writes } = makeFakeDb(
      preseason({ settings: { entryFee: 500, prizePool: 1500 } })
    );
    setDbForTesting(db);

    await setLeagueScoringFormat.run(
      authedRequest("boss", { leagueId: "l1", format: SCORING_FORMATS.CAPTION_WARS })
    );

    const leagueWrite = writes.find((w) => w.path === leaguePath("l1"));
    assert.equal(leagueWrite.data["settings.prizePool"], undefined);
  });

  test("an insufficient balance writes nothing at all", async () => {
    const { db, writes } = makeFakeDb(preseason({ balance: CAPTION_WARS_SEASON_COST - 1 }));
    setDbForTesting(db);

    await assert.rejects(
      setLeagueScoringFormat.run(
        authedRequest("boss", { leagueId: "l1", format: SCORING_FORMATS.CAPTION_WARS })
      ),
      /You have/i
    );

    assert.equal(
      writes.filter((w) => w.path === leaguePath("l1")).length,
      0,
      "the format must not land when the charge cannot"
    );
  });

  // Switching mid-season would mix two formats inside one standings table, and
  // the standings rebuild would then produce a number that never existed.
  test("refuses once the season's first week has been generated", async () => {
    const { db, writes } = makeFakeDb(
      preseason(),
      new Map([[matchupsPath("l1"), [["week-1", { seasonUid: "season-2" }]]]])
    );
    setDbForTesting(db);

    await assert.rejects(
      setLeagueScoringFormat.run(
        authedRequest("boss", { leagueId: "l1", format: SCORING_FORMATS.CAPTION_WARS })
      ),
      /already under way/i
    );
    assert.equal(writes.filter((w) => w.path === leaguePath("l1")).length, 0);
  });

  test("a league still carrying last season's weeks is still in preseason", async () => {
    const { db } = makeFakeDb(
      preseason(),
      new Map([[matchupsPath("l1"), [["week-7", { seasonUid: "season-1" }]]]])
    );
    setDbForTesting(db);

    const result = await setLeagueScoringFormat.run(
      authedRequest("boss", { leagueId: "l1", format: SCORING_FORMATS.CAPTION_WARS })
    );
    assert.equal(result.charged, CAPTION_WARS_SEASON_COST);
  });

  test("turning the format off is free", async () => {
    const { db, writes } = makeFakeDb(
      preseason({
        settings: {
          scoringFormat: SCORING_FORMATS.CAPTION_WARS,
          scoringFormatSeasonUid: "season-2",
        },
      })
    );
    setDbForTesting(db);

    const result = await setLeagueScoringFormat.run(
      authedRequest("boss", { leagueId: "l1", format: SCORING_FORMATS.TOTAL })
    );

    assert.equal(result.charged, 0);
    assert.equal(writes.filter((w) => w.data?.type === "league_format").length, 0);
  });

  test("buying the format twice in one season only charges once", async () => {
    const { db, writes } = makeFakeDb(
      preseason({
        settings: {
          scoringFormat: SCORING_FORMATS.CAPTION_WARS,
          scoringFormatSeasonUid: "season-2",
        },
      })
    );
    setDbForTesting(db);

    const result = await setLeagueScoringFormat.run(
      authedRequest("boss", { leagueId: "l1", format: SCORING_FORMATS.CAPTION_WARS })
    );

    assert.equal(result.charged, 0);
    assert.equal(writes.filter((w) => w.path === profilePath("boss")).length, 0);
  });

  // Last season's unlock is spent. Charging again is the point — the format is
  // a recurring sink, not a one-time purchase.
  test("last season's unlock does not carry, so it is charged again", async () => {
    const { db } = makeFakeDb(
      preseason({
        settings: {
          scoringFormat: SCORING_FORMATS.CAPTION_WARS,
          scoringFormatSeasonUid: "season-1",
        },
      })
    );
    setDbForTesting(db);

    const result = await setLeagueScoringFormat.run(
      authedRequest("boss", { leagueId: "l1", format: SCORING_FORMATS.CAPTION_WARS })
    );
    assert.equal(result.charged, CAPTION_WARS_SEASON_COST);
  });

  test("tells the league its rules changed", async () => {
    const { db, writes } = makeFakeDb(preseason());
    setDbForTesting(db);

    await setLeagueScoringFormat.run(
      authedRequest("boss", { leagueId: "l1", format: SCORING_FORMATS.CAPTION_WARS })
    );

    const activity = writes.find((w) => w.path.includes("/activity/"));
    assert.ok(activity, "members are told before the season starts");
    assert.equal(activity.data.type, "settings_changed");
  });

  test("refuses when there is no active season", async () => {
    const docs = preseason();
    docs.delete("game-settings/season");
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      setLeagueScoringFormat.run(
        authedRequest("boss", { leagueId: "l1", format: SCORING_FORMATS.CAPTION_WARS })
      ),
      /No active season/i
    );
  });
});
