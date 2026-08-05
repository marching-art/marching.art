// Fan Favorite windows + tallies (decision 30).
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const fanFavorite = require("./fanFavorite");

const cfg = { fanFavorite: { voteWindowDays: 3, finalistsPerMajor: 3, finalsFromDay: 45 } };

describe("Fan Favorite ballot windows (decision 30)", () => {
  test("a prelims window opens the day after the major, when it has a field", () => {
    // The show day itself is NOT open: the day's recap — the only source of
    // candidates — is written by the run that scores that night, so a ballot
    // open on day 28 could only ever reject every vote cast in it.
    assert.equal(fanFavorite.openPrelimsMajor(28, cfg), null);
    assert.equal(fanFavorite.openPrelimsMajor(29, cfg), 28);
    assert.equal(fanFavorite.openPrelimsMajor(30, cfg), 28);
    assert.equal(fanFavorite.openPrelimsMajor(31, cfg), null);
    assert.equal(fanFavorite.openPrelimsMajor(35, cfg), null);
    assert.equal(fanFavorite.openPrelimsMajor(36, cfg), 35);
  });

  test("the Eastern window waits for BOTH nights, so neither gets a head start", () => {
    // The Eastern Classic is one major over two nights (41 and 42) and its
    // candidate list is the union of both. Opening on 41 or 42 would leave the
    // night-2 corps un-votable while the night-1 corps banked votes.
    assert.equal(fanFavorite.openPrelimsMajor(41, cfg), null);
    assert.equal(fanFavorite.openPrelimsMajor(42, cfg), null);
    assert.equal(fanFavorite.openPrelimsMajor(43, cfg), 41);
    assert.equal(fanFavorite.openPrelimsMajor(44, cfg), 41);
    assert.equal(fanFavorite.openPrelimsMajor(45, cfg), null);
  });

  test("every window opens after its major's last night", () => {
    for (const major of fanFavorite.MAJORS) {
      const opens = fanFavorite.prelimsOpensOn(major);
      assert.equal(fanFavorite.openPrelimsMajor(opens, cfg), major);
      assert.notEqual(fanFavorite.openPrelimsMajor(opens - 1, cfg), major);
    }
  });

  test("the closing day is the window's last day — the Eastern counts from night two", () => {
    assert.equal(fanFavorite.prelimsClosesOn(28, cfg), 30);
    assert.equal(fanFavorite.prelimsClosesOn(35, cfg), 37);
    assert.equal(fanFavorite.prelimsClosesOn(41, cfg), 44);
    // Whatever the window, the last open day is exactly the last day it closes.
    for (const major of fanFavorite.MAJORS) {
      const closes = fanFavorite.prelimsClosesOn(major, cfg);
      assert.equal(fanFavorite.openPrelimsMajor(closes, cfg), major);
      assert.notEqual(fanFavorite.openPrelimsMajor(closes + 1, cfg), major);
    }
  });

  test("the finals ballot runs championship week only", () => {
    assert.equal(fanFavorite.finalsOpen(44, cfg), false);
    assert.equal(fanFavorite.finalsOpen(45, cfg), true);
    assert.equal(fanFavorite.finalsOpen(49, cfg), true);
    assert.equal(fanFavorite.finalsOpen(50, cfg), false);
  });
});

// --- Ranking ---------------------------------------------------------------
//
// The ballot published on 2026-08-04 is the fixture throughout: three majors,
// a pile of one-vote ties, and two corps whose totals said one thing while the
// finalist list said another. Every case below is drawn from it.

const FIELD = ["altitude", "morensik", "houston", "shadow", "mendota", "blackgold", "fogwalkers"];
const NAMES = {
  altitude: "Altitude",
  morensik: "Morensik Minutemen",
  houston: "Houston Knights",
  shadow: "Shadow Regiment",
  mendota: "Mendota Cadets",
  blackgold: "Black Gold",
  fogwalkers: "The Fogwalkers",
};
const byUid = Object.fromEntries(
  FIELD.map((uid) => [uid, { uid, corpsName: NAMES[uid], division: "worldClass" }])
);

// The live ballot, keyed by major.
const BALLOT = {
  28: { morensik: 2, houston: 2, altitude: 2, blackgold: 1, fogwalkers: 1 },
  35: { altitude: 2, mendota: 1, shadow: 1, blackgold: 1, fogwalkers: 1 },
  41: { morensik: 2, altitude: 2, shadow: 1, wildcat: 1, fogwalkers: 1 },
};

/** The `totals` shape `readPrelimsBallots` returns, derived from BALLOT. */
function totalsFor(ballot) {
  const totals = {};
  for (const [major, counts] of Object.entries(ballot)) {
    for (const [uid, votes] of Object.entries(counts)) {
      if (!totals[uid]) totals[uid] = { votes: 0, majors: new Set() };
      totals[uid].votes += votes;
      totals[uid].majors.add(Number(major));
    }
  }
  return totals;
}

const totals = totalsFor(BALLOT);
const rankMajor = (major) =>
  fanFavorite.rankBallot(BALLOT[major], byUid, totals).filter((row) => row.votes > 0);

describe("Fan Favorite ranking (decision 30)", () => {
  test("votes cast at one major break a tie at another", () => {
    // Southwestern: Morensik, Houston and Altitude all took two votes, and the
    // embed printed 🥇🥈🥉 down that tie in Firestore-document-ID order. The
    // three are separated now, but by something the room actually did —
    // Altitude polled 6 votes across all three majors, Houston 2 at this one.
    assert.deepEqual(
      rankMajor(28).map((r) => r.uid),
      ["altitude", "morensik", "houston", "fogwalkers", "blackgold"]
    );
    // Southeastern: four corps on one vote each. The Fogwalkers polled at all
    // three majors, so they lead a group that used to be ordered by document
    // ID; Mendota's single vote was its whole season, so it trails.
    assert.deepEqual(
      rankMajor(35).map((r) => r.uid),
      ["altitude", "fogwalkers", "blackgold", "shadow", "mendota"]
    );
  });

  test("a real tie is a shared place, not a podium invented by array order", () => {
    // Black Gold and Shadow Regiment are dead even at the Southeastern: one
    // vote there, two on the season, from two majors. Nothing in the ballot
    // separates them, so they share third and Mendota takes fifth (1224).
    const places = Object.fromEntries(rankMajor(35).map((r) => [r.uid, r.place]));
    assert.equal(places.blackgold, 3);
    assert.equal(places.shadow, 3);
    assert.equal(places.mendota, 5);
    const rows = Object.fromEntries(rankMajor(35).map((r) => [r.uid, r]));
    assert.deepEqual(rows.blackgold.tiedWith, ["shadow"]);
    assert.deepEqual(rows.shadow.tiedWith, ["blackgold"]);
    assert.deepEqual(rows.altitude.tiedWith, [], "a clear winner is tied with nobody");
  });

  test("no corps outranks another on document ID alone", () => {
    // Every pair that shares a place must be tied on everything measurable;
    // anything the comparator separates must differ on a real quantity.
    for (const major of [28, 35, 41]) {
      const rows = rankMajor(major);
      for (let i = 0; i < rows.length - 1; i += 1) {
        const [a, b] = [rows[i], rows[i + 1]];
        const measurablyDifferent =
          a.votes !== b.votes ||
          a.totalVotes !== b.totalVotes ||
          a.majorsPolled !== b.majorsPolled;
        assert.equal(a.place === b.place, !measurablyDifferent);
      }
    }
  });

  test("a tie on the cut line advances everyone tied, rather than picking one", () => {
    // Southeastern, three slots: the third falls on the Black Gold / Shadow
    // tie. Both advance — cutting one is a coin flip, not a result. This is
    // the exact call the old code made on document ID.
    assert.deepEqual(
      fanFavorite.advancingRows(rankMajor(35), 3).map((r) => r.uid),
      ["altitude", "fogwalkers", "blackgold", "shadow"]
    );
    // A cut line that falls on a clean break takes exactly its slots.
    assert.deepEqual(
      fanFavorite.advancingRows(rankMajor(28), 3).map((r) => r.uid),
      ["altitude", "morensik", "houston"]
    );
  });

  test("a corps that polled everywhere isn't beaten by one that polled once", () => {
    // The regression in one line: the Fogwalkers drew a vote at all three
    // majors — more than any other finalist bar Altitude and Morensik — and
    // made no final at all, while Mendota's single vote made one.
    const finalists = new Set(
      [28, 35, 41].flatMap((major) =>
        fanFavorite.advancingRows(rankMajor(major), 3).map((r) => r.uid)
      )
    );
    assert.ok(finalists.has("fogwalkers"), "3 votes across 3 majors advances");
    assert.ok(!finalists.has("mendota"), "1 vote at 1 major does not");
    // Nobody with more season votes than a finalist is left out.
    const worstFinalist = Math.min(...[...finalists].map((uid) => totals[uid].votes));
    for (const uid of FIELD.filter((u) => !finalists.has(u))) {
      assert.ok(
        totals[uid].votes <= worstFinalist,
        `${NAMES[uid]} polled more than the weakest finalist and still missed`
      );
    }
  });

  test("published results never split a tie group, and stay bounded", () => {
    const wide = Object.fromEntries(FIELD.map((uid) => [uid, 1]));
    const flatTotals = totalsFor({ 28: wide });
    const rows = fanFavorite.rankBallot(wide, byUid, flatTotals);
    // All seven are tied on everything, so publishing five would cut the tie.
    const published = fanFavorite.publishedDepth(rows);
    assert.equal(published.length, FIELD.length);
    assert.ok(published.length > fanFavorite.RESULTS_PER_MAJOR);
    assert.ok(published.length <= fanFavorite.RESULTS_MAX);
    assert.ok(rows.every((r) => r.place === 1));
  });

  test("a finals field with no votes falls back to the prelims record", () => {
    // Documented behaviour of crownWinner: an empty finals ballot is decided
    // by the prelims, and every finalist still appears in the results.
    const finalists = Object.fromEntries(
      ["altitude", "morensik", "shadow"].map((uid) => [uid, byUid[uid]])
    );
    const rows = fanFavorite.rankBallot({}, finalists, totals);
    assert.deepEqual(rows.map((r) => r.uid), ["altitude", "morensik", "shadow"]);
    assert.equal(rows.length, 3, "a finalist with no finals votes still places");
    assert.ok(rows.every((r) => r.votes === 0));
  });
});

// --- The crown cascade -----------------------------------------------------
//
// Everywhere else a tie stands. The crown can't — one corps gets the trophy —
// so the finals ballot keeps asking questions after the three ranking
// measures run out: who led at the most recent major, who reached the total
// first, and finally a declared draw. Every case here also checks the REASON
// recorded on the decision, because that reason is what the crowning
// announcement prints.

const SEASON = "s-crown";

/** rankBallot rows for a finals tally over `uids`, given a prelims record. */
function finalsRows(finalsCounts, uids, ballot) {
  const field = Object.fromEntries(uids.map((uid) => [uid, byUid[uid]]));
  return fanFavorite.rankBallot(finalsCounts, field, totalsFor(ballot));
}

/** perMajor, the shape readBallots returns, from a {major: {uid: votes}} map. */
function perMajorOf(ballot) {
  return Object.fromEntries(
    fanFavorite.MAJORS.map((major) => [String(major), ballot[major] || {}])
  );
}

function crown(ballot, finalsCounts, uids, { finalsTimes = {}, seasonUid = SEASON } = {}) {
  return fanFavorite.decideCrown(finalsRows(finalsCounts, uids, ballot), {
    seasonUid,
    perMajor: perMajorOf(ballot),
    finalsTimes,
  });
}

describe("Fan Favorite crown cascade (decision 30)", () => {
  test("an outright winner is crowned with no tiebreak to explain", () => {
    const ballot = { 28: { altitude: 2, houston: 1 } };
    const { winner, tiebreak } = crown(ballot, { altitude: 5, houston: 3 }, [
      "altitude",
      "houston",
    ]);
    assert.equal(winner.uid, "altitude");
    assert.equal(tiebreak, null, "nobody else was on the winner's count");
  });

  test("a crown level on finals votes is decided by the season, and says so", () => {
    // Both took 4 in the finals; Altitude drew 5 votes across the majors to
    // Houston's 2. A reader seeing two corps on 4 votes in different places
    // gets the number that separated them.
    const ballot = { 28: { altitude: 3, houston: 2 }, 35: { altitude: 2 } };
    const { winner, tiebreak } = crown(ballot, { altitude: 4, houston: 4 }, [
      "altitude",
      "houston",
    ]);
    assert.equal(winner.uid, "altitude");
    assert.equal(tiebreak.rule, "seasonVotes");
    assert.equal(tiebreak.winnerValue, 5);
    assert.equal(tiebreak.rivalValue, 2);
    assert.equal(tiebreak.rival, "Houston Knights");
    assert.deepEqual(tiebreak.tiedWith, ["Houston Knights"]);
  });

  test("level on the season too, the widest-polling corps takes it", () => {
    // Three season votes each: Altitude from two majors, Houston from one.
    const ballot = { 28: { altitude: 2, houston: 3 }, 35: { altitude: 1 } };
    const { winner, tiebreak } = crown(ballot, { altitude: 2, houston: 2 }, [
      "altitude",
      "houston",
    ]);
    assert.equal(winner.uid, "altitude");
    assert.equal(tiebreak.rule, "majorsPolled");
    assert.equal(tiebreak.winnerValue, 2);
    assert.equal(tiebreak.rivalValue, 1);
  });

  test("still level, the most recent major to separate them decides", () => {
    // Identical on every total (3 votes, 2 majors each). Houston led the
    // Southwestern; Altitude led the Eastern — the last room to see them both,
    // and the one that counts.
    const ballot = {
      28: { altitude: 1, houston: 2 },
      41: { altitude: 2, houston: 1 },
    };
    const { winner, tiebreak } = crown(ballot, { altitude: 3, houston: 3 }, [
      "altitude",
      "houston",
    ]);
    assert.equal(winner.uid, "altitude", "the Eastern outranks the Southwestern");
    assert.equal(tiebreak.rule, "majorLead");
    assert.equal(tiebreak.major, 41);
    assert.equal(tiebreak.winnerValue, 2);
    assert.equal(tiebreak.rivalValue, 1);
  });

  test("level at every major, the corps that got to the total first takes it", () => {
    const ballot = {
      35: { altitude: 1, houston: 1 },
      41: { altitude: 1, houston: 1 },
    };
    const finalsTimes = {
      altitude: ["2026-08-01T10:00:00.000Z", "2026-08-02T09:00:00.000Z"],
      houston: ["2026-08-01T09:00:00.000Z", "2026-08-02T11:00:00.000Z"],
    };
    const { winner, tiebreak } = crown(
      ballot,
      { altitude: 2, houston: 2 },
      ["altitude", "houston"],
      { finalsTimes }
    );
    // Houston's FIRST vote came in earlier; Altitude reached two votes first,
    // and reaching the total is the race.
    assert.equal(winner.uid, "altitude");
    assert.equal(tiebreak.rule, "firstToCount");
    assert.equal(tiebreak.winnerValue, "2026-08-02T09:00:00.000Z");
  });

  test("an unstamped ballot is never read as an early one", () => {
    // Ballots cast before votes were stamped carry no time. Treating a missing
    // stamp as "very early" would crown a corps on the absence of data, so the
    // measure goes silent and the cascade falls to the draw.
    const ballot = { 41: { altitude: 1, houston: 1 } };
    const { tiebreak } = crown(
      ballot,
      { altitude: 2, houston: 2 },
      ["altitude", "houston"],
      {
        finalsTimes: {
          altitude: ["2026-08-01T10:00:00.000Z", null],
          houston: ["2026-08-02T10:00:00.000Z", "2026-08-02T11:00:00.000Z"],
        },
      }
    );
    assert.equal(tiebreak.rule, "draw");
  });

  test("a crown nothing separated is a declared draw — and a repeatable one", () => {
    // Identical everywhere the ballot measured. Something has to go on the
    // plaque, so a seeded draw picks; crownWinner is idempotent, so the same
    // season must always draw the same corps.
    const ballot = { 41: { altitude: 1, houston: 1 } };
    const args = [ballot, { altitude: 2, houston: 2 }, ["altitude", "houston"]];
    const first = crown(...args);
    const second = crown(...args);
    assert.equal(first.tiebreak.rule, "draw");
    assert.equal(first.winner.uid, second.winner.uid, "a re-run crowns the same corps");
    assert.ok(["altitude", "houston"].includes(first.winner.uid));
    // Seeded on the SEASON, so a uid is not permanently lucky.
    assert.notEqual(
      fanFavorite.drawTicket("s-1", "altitude"),
      fanFavorite.drawTicket("s-2", "altitude")
    );
  });

  test("every corps on the winner's count is named, however many there are", () => {
    const ballot = { 41: { altitude: 3, houston: 2, shadow: 1 } };
    const { winner, tiebreak } = crown(ballot, { altitude: 2, houston: 2, shadow: 2 }, [
      "altitude",
      "houston",
      "shadow",
    ]);
    assert.equal(winner.uid, "altitude");
    assert.deepEqual(tiebreak.tiedWith, ["Houston Knights", "Shadow Regiment"]);
    assert.equal(tiebreak.rival, "Houston Knights", "decided against the closest corps");
  });

  test("the cascade decides on ballots alone — it cannot reach a score", () => {
    // The Fan Favorite is the one trophy the field can't score for, so the
    // cascade is pure over the BALLOTS: no db handle, and synchronous, which a
    // recap read could not be. Wiring in a score would break this signature.
    const ballot = { 41: { altitude: 1, houston: 1 } };
    const decision = fanFavorite.decideCrown(
      finalsRows({ altitude: 2, houston: 2 }, ["altitude", "houston"], ballot),
      { seasonUid: SEASON, perMajor: perMajorOf(ballot), finalsTimes: {} }
    );
    assert.equal(fanFavorite.decideCrown.length, 2, "(ranked, context) — no db");
    assert.ok(!(decision instanceof Promise), "a recap read would have to be async");
    assert.equal(decision.tiebreak.rule, "draw");
  });
});

// --- Crowning --------------------------------------------------------------

/** Fake Firestore: the ballots collection, the fan doc, and profile writes. */
function fakeDb(docs, ballots) {
  const writes = {};
  const makeDocRef = (path) => ({
    path,
    get: async () => ({
      exists: Object.prototype.hasOwnProperty.call(docs, path),
      data: () => docs[path],
    }),
    set: async (data, options) => {
      writes[path] = options && options.merge ? { ...(writes[path] || {}), ...data } : data;
      docs[path] = { ...(docs[path] || {}), ...data };
    },
  });
  return {
    writes,
    doc: makeDocRef,
    collection: (path) => ({
      doc: (id) => makeDocRef(`${path}/${id}`),
      get: async () => ({
        docs: (ballots[path] || []).map((data) => ({ data: () => data })),
      }),
    }),
  };
}

describe("Fan Favorite crowning (decision 30)", () => {
  const finalists = [
    { uid: "altitude", corpsName: "Altitude", division: "worldClass" },
    { uid: "houston", corpsName: "Houston Knights", division: "worldClass" },
  ];

  test("a tied crown records what decided it, and leads its own results", async () => {
    // Two votes each in the finals; Altitude polled 2 across the majors to
    // Houston's 1, so the season breaks it.
    const db = fakeDb(
      { "podium-fan/s1": { seasonUid: "s1", finalists } },
      {
        "podium-fan/s1/ballots": [
          { prelims: { 28: "altitude", 35: "altitude" }, finals: "altitude" },
          { prelims: { 28: "houston" }, finals: "altitude" },
          { finals: "houston" },
          { finals: "houston" },
        ],
      }
    );

    const winner = await fanFavorite.crownWinner(db, "s1");
    assert.equal(winner.corpsName, "Altitude");
    assert.equal(winner.finalsVotes, 2);
    assert.equal(winner.tiebreak.rule, "seasonVotes");
    assert.equal(winner.tiebreak.winnerValue, 2);
    assert.equal(winner.tiebreak.rivalValue, 1);
    assert.deepEqual(winner.tiedWith, ["Houston Knights"]);

    const published = db.writes["podium-fan/s1"];
    // Two corps, the same printed count, different places — the exact sight
    // that reads as a coin flip, which is why `tiebreak` above says what it
    // actually turned on. The crowned corps leads its own tally.
    assert.deepEqual(
      published.finalsResults.map((row) => [row.corpsName, row.votes, row.place]),
      [
        ["Altitude", 2, 1],
        ["Houston Knights", 2, 2],
      ]
    );
    assert.equal(published.finalsResults[0].seasonVotes, 2, "the reason is published too");
    // Cosmetic hardware, unchanged by any of this.
    const profilePath = Object.keys(db.writes).find((path) =>
      path.includes("users/altitude/profile")
    );
    assert.equal(db.writes[profilePath].trophies.fanFavorites[0].type, "fanFavorite");
  });

  test("an outright crown carries no tiebreak at all", async () => {
    const db = fakeDb(
      { "podium-fan/s2": { seasonUid: "s2", finalists } },
      {
        "podium-fan/s2/ballots": [
          { finals: "altitude", finalsAt: "2026-08-01T10:00:00.000Z" },
          { finals: "altitude", finalsAt: "2026-08-01T11:00:00.000Z" },
          { finals: "houston", finalsAt: "2026-08-01T12:00:00.000Z" },
        ],
      }
    );

    const winner = await fanFavorite.crownWinner(db, "s2");
    assert.equal(winner.corpsName, "Altitude");
    assert.equal(winner.tiebreak, undefined, "nobody was on its count");
    assert.equal(winner.tiedWith, undefined);
  });
});
