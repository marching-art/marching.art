// Tests for the shared league helpers (pure logic extracted from the
// league callables): invite-code generation, standings-based pairing, and
// invitation doc ids.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  generateUniqueInviteCode,
  smartPairMembers,
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

describe("invitationId", () => {
  test("is deterministic per league+invitee", () => {
    assert.equal(invitationId("league1", "userA"), "league1_userA");
    assert.equal(invitationId("league1", "userA"), invitationId("league1", "userA"));
    assert.notEqual(invitationId("league1", "userA"), invitationId("league1", "userB"));
  });
});
