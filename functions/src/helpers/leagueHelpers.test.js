// Tests for the shared league helpers (pure logic extracted from the
// league callables): invite-code generation, standings-based pairing, and
// invitation doc ids.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  generateUniqueInviteCode,
  smartPairMembers,
  pairLeagueWeek,
  buildPairingHistory,
  recordPairingsInHistory,
  invitationId,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
} = require("./leagueHelpers");

describe("generateUniqueInviteCode", () => {
  test("produces an 8-char code from the look-alike-free alphabet", () => {
    const code = generateUniqueInviteCode("user-123");
    assert.equal(code.length, INVITE_CODE_LENGTH);
    assert.match(code, new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`));
    // 0/O and 1/I/L are never minted — a code read aloud survives.
    assert.doesNotMatch(INVITE_CODE_ALPHABET, /[01OIL]/);
  });

  test("codes are random: no repeats across a large sample", () => {
    const codes = new Set(Array.from({ length: 2000 }, () => generateUniqueInviteCode("u")));
    assert.equal(codes.size, 2000);
  });
});

describe("smartPairMembers", () => {
  const standingsFor = (winsByUid) => {
    const s = {};
    for (const [uid, wins] of Object.entries(winsByUid)) {
      s[uid] = { wins, totalPoints: wins * 100 };
    }
    return s;
  };

  test("returns [] for an empty league", () => {
    assert.deepEqual(smartPairMembers([], {}), []);
  });

  test("gives a solo member a completed bye", () => {
    const result = smartPairMembers(["a"], {});
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].pair, ["a", null]);
    assert.equal(result[0].winner, "a");
    assert.equal(result[0].isBye, true);
    assert.equal(result[0].completed, true);
  });

  test("pairs adjacent standings (1v2, 3v4) for an even field", () => {
    const members = ["a", "b", "c", "d"];
    const standings = standingsFor({ a: 3, b: 2, c: 1, d: 0 });
    const result = smartPairMembers(members, standings);

    assert.equal(result.length, 2);
    // Home/away is randomized, so compare as unordered pairs.
    const pairs = result.map((m) => [...m.pair].sort());
    assert.deepEqual(pairs[0], ["a", "b"]); // top two
    assert.deepEqual(pairs[1], ["c", "d"]); // bottom two
    for (const m of result) {
      assert.equal(m.isBye, false);
      assert.equal(m.completed, false);
      assert.equal(m.winner, null);
    }
  });

  test("gives the odd member out a bye", () => {
    const members = ["a", "b", "c"];
    const standings = standingsFor({ a: 2, b: 1, c: 0 });
    const result = smartPairMembers(members, standings);

    assert.equal(result.length, 2);
    const bye = result.find((m) => m.isBye);
    assert.ok(bye);
    assert.deepEqual(bye.pair, ["c", null]); // lowest-ranked gets the bye
    assert.equal(bye.winner, "c");
    assert.equal(bye.completed, true);
  });

  test("every member appears exactly once", () => {
    const members = ["a", "b", "c", "d", "e", "f", "g"];
    const result = smartPairMembers(members, standingsFor({ a: 6, b: 5, c: 4, d: 3, e: 2, f: 1, g: 0 }));
    const seen = result.flatMap((m) => m.pair).filter(Boolean);
    assert.deepEqual([...seen].sort(), [...members].sort());
    assert.equal(seen.length, members.length);
  });

  test("treats members missing from standings as 0-0", () => {
    // No standings at all -> still pairs everyone without throwing.
    const result = smartPairMembers(["a", "b"], {});
    assert.equal(result.length, 1);
    assert.deepEqual([...result[0].pair].sort(), ["a", "b"]);
  });

  test("ties on wins break by totalPoints", () => {
    const standings = {
      a: { wins: 1, totalPoints: 50 },
      b: { wins: 1, totalPoints: 200 }, // higher points -> ranked above a
      c: { wins: 0, totalPoints: 0 },
      d: { wins: 2, totalPoints: 10 },
    };
    const result = smartPairMembers(["a", "b", "c", "d"], standings);
    const pairs = result.map((m) => [...m.pair].sort());
    // Order: d (2 wins), b (1 win/200), a (1 win/50), c -> pairs d+b, a+c
    assert.deepEqual(pairs[0], ["b", "d"]);
    assert.deepEqual(pairs[1], ["a", "c"]);
  });
});

describe("smartPairMembers rematch avoidance", () => {
  const standingsFor = (winsByUid) => {
    const s = {};
    for (const [uid, wins] of Object.entries(winsByUid)) {
      s[uid] = { wins, totalPoints: wins * 100 };
    }
    return s;
  };
  const unorderedPairs = (result) =>
    result.filter((m) => !m.isBye).map((m) => [...m.pair].sort().join("+"));

  // Pairing strictly adjacent against a table that barely moves reproduces the
  // SAME duels every week — a ten-person league would run a whole season as
  // five repeated matchups.
  test("avoids an immediate rematch with the adjacent seed", () => {
    const standings = standingsFor({ a: 3, b: 3, c: 1, d: 1 });
    const history = { meetings: { a: { b: 1 }, b: { a: 1 }, c: { d: 1 }, d: { c: 1 } } };

    const result = smartPairMembers(["a", "b", "c", "d"], standings, history);

    assert.deepEqual(unorderedPairs(result).sort(), ["a+c", "b+d"]);
  });

  test("takes the least-played opponent once everyone has been played", () => {
    const standings = standingsFor({ a: 2, b: 2, c: 2, d: 2 });
    const history = {
      meetings: {
        a: { b: 2, c: 2, d: 1 },
        b: { a: 2 },
        c: { a: 2 },
        d: { a: 1 },
      },
    };

    const result = smartPairMembers(["a", "b", "c", "d"], standings, history);

    assert.ok(unorderedPairs(result).includes("a+d"));
  });

  // The odd director out used to be whoever sorted last, so the
  // worst-performing member collected a free win every single week, forever.
  test("rotates the bye to whoever has had it least", () => {
    const standings = standingsFor({ a: 2, b: 1, c: 0 });
    const result = smartPairMembers(["a", "b", "c"], standings, { byes: { c: 2, b: 1, a: 0 } });

    const bye = result.find((m) => m.isBye);
    assert.deepEqual(bye.pair, ["a", null]);
  });

  test("is deterministic — same inputs, same pairings", () => {
    const standings = standingsFor({ a: 3, b: 2, c: 1, d: 0 });
    const first = smartPairMembers(["a", "b", "c", "d"], standings);
    const second = smartPairMembers(["d", "c", "b", "a"], standings);
    assert.deepEqual(first, second);
  });
});

describe("buildPairingHistory", () => {
  const classes = ["worldClass", "aClass"];

  test("counts meetings symmetrically and byes per director", () => {
    const history = buildPairingHistory(
      [
        {
          worldClassMatchups: [
            { pair: ["a", "b"], completed: true },
            { pair: ["c", null], isBye: true },
          ],
        },
        { worldClassMatchups: [{ pair: ["a", "b"], completed: false }] },
        { aClassMatchups: [{ pair: ["c", null], isBye: true }] },
      ],
      classes
    );

    // Counted even when not yet resolved: a generated-but-unplayed week still
    // has to steer the next one away from an immediate rematch.
    assert.equal(history.meetings.a.b, 2);
    assert.equal(history.meetings.b.a, 2);
    assert.equal(history.byes.c, 2);
  });

  test("tolerates empty and malformed documents", () => {
    const history = buildPairingHistory(
      [null, {}, { worldClassMatchups: [{}, { pair: [] }, { pair: [null, "b"] }] }],
      classes
    );
    assert.deepEqual(history.meetings, {});
    assert.deepEqual(history.byes, {});
  });
});

describe("invitationId", () => {
  test("is deterministic per league+invitee", () => {
    assert.equal(invitationId("league1", "userA"), "league1_userA");
    assert.equal(invitationId("league1", "userA"), invitationId("league1", "userA"));
    assert.notEqual(invitationId("league1", "userA"), invitationId("league1", "userB"));
  });
});

// The daily generator ensures both the current and the next week in one pass.
// Pairing from identical history twice would produce the same matchups for
// both weeks — the exact repetition the history exists to prevent.
describe('recordPairingsInHistory', () => {
  const classes = ['worldClass'];

  test('folds a generated week into an existing history in place', () => {
    const history = { meetings: { a: { b: 1 }, b: { a: 1 } }, byes: { c: 1 } };
    const week = {
      worldClassMatchups: [
        { pair: ['a', 'b'] },
        { pair: ['c', null], isBye: true },
      ],
    };

    const returned = recordPairingsInHistory(history, week, classes);

    assert.equal(returned, history, 'mutates and returns the same object');
    assert.equal(history.meetings.a.b, 2);
    assert.equal(history.meetings.b.a, 2);
    assert.equal(history.byes.c, 2);
  });

  test('seeds entries that the prior history did not have', () => {
    const history = { meetings: {}, byes: {} };
    recordPairingsInHistory(history, { worldClassMatchups: [{ pair: ['x', 'y'] }] }, classes);

    assert.equal(history.meetings.x.y, 1);
    assert.equal(history.meetings.y.x, 1);
  });

  test('a second week generated from the folded history avoids the rematch', () => {
    const members = ['a', 'b', 'c', 'd'];
    const standings = {
      a: { wins: 0, totalPoints: 0 },
      b: { wins: 0, totalPoints: 0 },
      c: { wins: 0, totalPoints: 0 },
      d: { wins: 0, totalPoints: 0 },
    };
    const history = { meetings: {}, byes: {} };

    const week1 = { worldClassMatchups: smartPairMembers(members, standings, history) };
    recordPairingsInHistory(history, week1, classes);
    const week2 = smartPairMembers(members, standings, history);

    const key = (m) => [...m.pair].sort().join('+');
    const week1Pairs = new Set(week1.worldClassMatchups.map(key));
    for (const matchup of week2) {
      assert.ok(!week1Pairs.has(key(matchup)), `${key(matchup)} repeated in week 2`);
    }
  });
});

describe("pairLeagueWeek (cross-class round)", () => {
  const CLASSES = ["worldClass", "openClass", "aClass", "soundSport"];

  test("a single-class league is exactly smartPairMembers' output", () => {
    const membersByClass = { worldClass: ["a", "b", "c", "d"] };
    const paired = pairLeagueWeek(membersByClass, {}, {}, CLASSES);
    assert.deepEqual(paired.worldClass, smartPairMembers(["a", "b", "c", "d"], {}, {}));
    for (const cls of CLASSES.slice(1)) assert.deepEqual(paired[cls], []);
  });

  test("two singleton classes play each other instead of collecting bye wins", () => {
    const paired = pairLeagueWeek(
      { worldClass: ["wc-solo"], soundSport: ["ss-solo"] },
      {},
      {},
      CLASSES
    );
    const all = CLASSES.flatMap((c) => paired[c]);
    assert.equal(all.length, 1);
    const [matchup] = all;
    assert.deepEqual([...matchup.pair].sort(), ["ss-solo", "wc-solo"]);
    assert.equal(matchup.crossClass, true);
    assert.equal(matchup.completed, false);
    assert.equal(matchup.classes["wc-solo"], "worldClass");
    assert.equal(matchup.classes["ss-solo"], "soundSport");
    // Stored under the first (higher-seeded) director's class array only.
    assert.equal(
      CLASSES.filter((c) => paired[c].length > 0).length,
      1
    );
  });

  test("odd classes send their leftover to the cross round; a true odd total still byes", () => {
    // 3 worldClass (one leftover) + 1 aClass (leftover) + 1 soundSport
    // (leftover): two of the three leftovers pair, one gets the bye.
    const paired = pairLeagueWeek(
      { worldClass: ["w1", "w2", "w3"], aClass: ["a1"], soundSport: ["s1"] },
      {},
      {},
      CLASSES
    );
    const all = CLASSES.flatMap((c) => paired[c]);
    const cross = all.filter((m) => m.crossClass);
    const byes = all.filter((m) => m.isBye);
    const sameClass = all.filter((m) => !m.crossClass && !m.isBye);
    assert.equal(sameClass.length, 1); // w-vs-w
    assert.equal(cross.length, 1);
    assert.equal(byes.length, 1);
    // The bye is a completed win, exactly as before.
    assert.equal(byes[0].completed, true);
    assert.equal(byes[0].winner, byes[0].pair[0]);
  });

  test("a director leftover in two classes is never paired against themself", () => {
    // "dual" fields two singleton classes; "solo" fields one. dual must play
    // solo once, and the remaining dual leftover takes the bye.
    const paired = pairLeagueWeek(
      { worldClass: ["dual"], openClass: ["dual"], aClass: ["solo"] },
      {},
      {},
      CLASSES
    );
    const all = CLASSES.flatMap((c) => paired[c]);
    const cross = all.filter((m) => m.crossClass);
    const byes = all.filter((m) => m.isBye);
    assert.equal(cross.length, 1);
    assert.notEqual(cross[0].pair[0], cross[0].pair[1]);
    assert.ok(cross[0].pair.includes("solo"));
    assert.equal(byes.length, 1);
    assert.deepEqual(byes[0].pair, ["dual", null]);
  });

  test("cross pairing avoids last week's cross opponent when it can", () => {
    const membersByClass = { worldClass: ["w"], aClass: ["a"], soundSport: ["s"] };
    const history = { meetings: { w: { a: 1 }, a: { w: 1 } }, byes: { s: 1 } };
    const paired = pairLeagueWeek(membersByClass, {}, history, CLASSES);
    const cross = CLASSES.flatMap((c) => paired[c]).filter((m) => m.crossClass);
    assert.equal(cross.length, 1);
    // w and a already met, so whatever pairs this week, it is not that rematch.
    assert.notDeepEqual([...cross[0].pair].sort(), ["a", "w"]);
    assert.ok(cross[0].pair.includes("s"));
  });
});
