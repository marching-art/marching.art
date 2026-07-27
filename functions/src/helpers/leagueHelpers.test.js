// Tests for the shared league helpers (pure logic extracted from the
// league callables): invite-code generation, standings-based pairing, and
// invitation doc ids.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  generateUniqueInviteCode,
  smartPairMembers,
  buildPairingHistory,
  invitationId,
} = require("./leagueHelpers");

describe("generateUniqueInviteCode", () => {
  test("produces a 6-char uppercase hex code", () => {
    const code = generateUniqueInviteCode("user-123");
    assert.match(code, /^[0-9A-F]{6}$/);
  });

  test("codes differ across calls (timestamp/random salted)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateUniqueInviteCode("u")));
    assert.ok(codes.size > 1);
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
