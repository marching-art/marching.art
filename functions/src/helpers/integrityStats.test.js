// Unit tests for the account-integrity rollup (helpers/integrityStats.js).
// Run with `npm test` from functions/.
//
// This job produces a watchlist a human will act on by looking at real
// directors' accounts, so the tests target the ways it could mislead: missing
// an alias that IS the same inbox, inventing a cluster out of a common handle,
// leaking a raw email into the stored doc, or letting one signal masquerade as
// the high-confidence multi-signal watchlist.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeEmail,
  redactEmail,
  usernameStem,
  findEmailClusters,
  findSignupBursts,
  findAttributeClusters,
  buildWatchlist,
  computeIntegritySignals,
} = require("./integrityStats");

const MIN = 60 * 1000;
const T0 = new Date("2026-08-01T00:00:00Z").getTime();
const at = (ms) => new Date(T0 + ms);

describe("normalizeEmail", () => {
  test("collapses Gmail dot and +tag aliases onto one inbox", () => {
    const canonical = "johndoe@gmail.com";
    assert.equal(normalizeEmail("john.doe@gmail.com"), canonical);
    assert.equal(normalizeEmail("j.o.h.n.d.o.e@gmail.com"), canonical);
    assert.equal(normalizeEmail("johndoe+alt1@gmail.com"), canonical);
    assert.equal(normalizeEmail("John.Doe+throwaway@GMail.com"), canonical);
    assert.equal(normalizeEmail("johndoe@googlemail.com"), canonical);
  });

  test("keeps dots for non-Gmail providers but still drops +tag", () => {
    assert.equal(normalizeEmail("john.doe@fastmail.com"), "john.doe@fastmail.com");
    assert.equal(normalizeEmail("john.doe+x@fastmail.com"), "john.doe@fastmail.com");
  });

  test("returns null for non-email input", () => {
    for (const bad of [null, undefined, 42, "", "nope", "no@domain", "@gmail.com", "a@b"]) {
      assert.equal(normalizeEmail(bad), null);
    }
  });
});

describe("redactEmail", () => {
  test("shows a two-char head and the domain, never the full local part", () => {
    assert.equal(redactEmail("johndoe@gmail.com"), "jo…@gmail.com");
    assert.equal(redactEmail("a@gmail.com"), "a…@gmail.com");
    assert.equal(redactEmail("ab@x.io"), "a…@x.io");
  });
  test("null for junk", () => {
    assert.equal(redactEmail("nope"), null);
    assert.equal(redactEmail(null), null);
  });
});

describe("usernameStem", () => {
  test("flags a shared alpha stem with a trailing digit", () => {
    assert.equal(usernameStem("smith1"), "smith");
    assert.equal(usernameStem("smith_2"), "smith");
    assert.equal(usernameStem("Smith3 "), "smith");
  });
  test("ignores bare handles and too-short stems", () => {
    assert.equal(usernameStem("smith"), null); // no trailing digit
    assert.equal(usernameStem("ab7"), null); // stem too short
    assert.equal(usernameStem("2pac"), null); // no leading alpha
    assert.equal(usernameStem(null), null);
  });
});

describe("findEmailClusters", () => {
  test("groups alias variants, ignores singletons, redacts, and hashes the key", () => {
    const accounts = [
      { uid: "a", username: "ann", email: "shared@gmail.com", createdAt: at(0) },
      { uid: "b", username: "bob", email: "sh.ared+2@gmail.com", createdAt: at(MIN) },
      { uid: "c", username: "cid", email: "s.h.a.r.e.d+x@googlemail.com", createdAt: at(2 * MIN) },
      { uid: "d", username: "dot", email: "unique@gmail.com", createdAt: at(0) },
    ];
    const clusters = findEmailClusters(accounts);
    assert.equal(clusters.length, 1);
    const c = clusters[0];
    assert.equal(c.size, 3);
    assert.equal(c.sample, "sh…@gmail.com");
    assert.match(c.key, /^[0-9a-f]{16}$/);
    // No raw email survives into the stored shape.
    assert.equal(JSON.stringify(c).includes("shared@gmail.com"), false);
    assert.deepEqual(
      c.members.map((m) => m.uid),
      ["a", "b", "c"]
    );
  });

  test("no cluster when every inbox is distinct", () => {
    const accounts = [
      { uid: "a", username: "ann", email: "one@gmail.com" },
      { uid: "b", username: "bob", email: "two@gmail.com" },
    ];
    assert.deepEqual(findEmailClusters(accounts), []);
  });
});

describe("findSignupBursts", () => {
  const opts = { windowMs: 15 * MIN, minSize: 4 };

  test("reports a tight cluster of signups and excludes stragglers", () => {
    const accounts = [
      { uid: "a", username: "a", createdAt: at(0) },
      { uid: "b", username: "b", createdAt: at(2 * MIN) },
      { uid: "c", username: "c", createdAt: at(4 * MIN) },
      { uid: "d", username: "d", createdAt: at(6 * MIN) },
      // Far away in time — its own island, below minSize.
      { uid: "z", username: "z", createdAt: at(10 * 60 * MIN) },
    ];
    const bursts = findSignupBursts(accounts, opts);
    assert.equal(bursts.length, 1);
    assert.equal(bursts[0].size, 4);
    assert.deepEqual(
      bursts[0].members.map((m) => m.uid),
      ["a", "b", "c", "d"]
    );
  });

  test("a spread-out signup history yields no burst", () => {
    const accounts = Array.from({ length: 6 }, (_, i) => ({
      uid: `u${i}`,
      username: `u${i}`,
      createdAt: at(i * 60 * MIN), // one per hour
    }));
    assert.deepEqual(findSignupBursts(accounts, opts), []);
  });

  test("accounts without a createdAt are ignored", () => {
    const accounts = [
      { uid: "a", createdAt: null },
      { uid: "b" },
      { uid: "c", createdAt: at(0) },
    ];
    assert.deepEqual(findSignupBursts(accounts, opts), []);
  });
});

describe("findAttributeClusters", () => {
  test("clusters identical location+corps pairs above the threshold", () => {
    const shared = { location: "Dayton, OH", favoriteCorps: "Blue Devils" };
    const accounts = [
      { uid: "a", username: "a", ...shared },
      { uid: "b", username: "b", ...shared },
      { uid: "c", username: "c", ...shared },
      { uid: "d", username: "d", location: "Dayton, OH", favoriteCorps: "Cadets" },
    ];
    const clusters = findAttributeClusters(accounts, { minSize: 3 });
    const lc = clusters.find((c) => c.kind === "location+corps");
    assert.ok(lc);
    assert.equal(lc.size, 3);
  });

  test("clusters a shared username stem", () => {
    const accounts = [
      { uid: "a", username: "ghost1" },
      { uid: "b", username: "ghost2" },
      { uid: "c", username: "ghost3" },
    ];
    const clusters = findAttributeClusters(accounts, { minSize: 3 });
    const stem = clusters.find((c) => c.kind === "username-stem");
    assert.ok(stem);
    assert.equal(stem.size, 3);
  });

  test("does not cluster on a partial or missing attribute", () => {
    const accounts = [
      { uid: "a", username: "a", location: "Dayton, OH" }, // no corps
      { uid: "b", username: "b", location: "Dayton, OH" },
      { uid: "c", username: "c", location: "Dayton, OH" },
    ];
    assert.deepEqual(findAttributeClusters(accounts, { minSize: 3 }), []);
  });
});

describe("buildWatchlist", () => {
  test("lists only accounts flagged by two or more distinct signals", () => {
    const emailClusters = [{ members: [{ uid: "a" }, { uid: "b" }] }];
    const signupBursts = [{ members: [{ uid: "a" }, { uid: "c" }] }];
    const attributeClusters = [{ kind: "username-stem", members: [{ uid: "a" }, { uid: "d" }] }];
    const names = new Map([["a", "ann"]]);
    const watch = buildWatchlist({ emailClusters, signupBursts, attributeClusters }, names);
    assert.equal(watch.length, 1);
    assert.equal(watch[0].uid, "a");
    assert.equal(watch[0].username, "ann");
    assert.deepEqual(watch[0].signals, ["attr:username-stem", "email", "signup-burst"]);
  });
});

describe("computeIntegritySignals", () => {
  test("assembles the full payload with an exact summary", () => {
    const accounts = [
      // An alias pair created in a burst with a shared stem — the model alt ring.
      { uid: "a", username: "ring1", email: "ring@gmail.com", createdAt: at(0) },
      { uid: "b", username: "ring2", email: "r.i.n.g+2@gmail.com", createdAt: at(MIN) },
      { uid: "c", username: "ring3", email: "ring+3@googlemail.com", createdAt: at(2 * MIN) },
      { uid: "d", username: "ring4", email: "ring+4@gmail.com", createdAt: at(3 * MIN) },
      // A normal, unrelated director.
      { uid: "z", username: "realdirector", email: "someone@fastmail.com", createdAt: at(9e6) },
    ];
    const stats = computeIntegritySignals(accounts, {
      burstWindowMs: 15 * MIN,
      burstMinSize: 4,
      attrMinSize: 3,
    });

    assert.equal(stats.totalAccounts, 5);
    assert.equal(stats.withEmail, 5);
    assert.equal(stats.summary.emailClusterCount, 1);
    assert.equal(stats.summary.largestEmailCluster, 4);
    assert.equal(stats.summary.signupBurstCount, 1);
    assert.equal(stats.summary.attributeClusterCount, 1); // ring# stem
    // All four ring accounts are hit by email + burst + stem → all watchlisted.
    assert.equal(stats.summary.watchlistCount, 4);
    assert.ok(stats.watchlist.every((w) => w.signals.length >= 2));
    assert.ok(!stats.watchlist.some((w) => w.uid === "z"));
    assert.equal(stats.thresholds.burstWindowMinutes, 15);
  });

  test("a clean roster produces empty signals, not errors", () => {
    const accounts = [
      { uid: "a", username: "alpha", email: "alpha@example.com", createdAt: at(0) },
      { uid: "b", username: "bravo", email: "bravo@example.net", createdAt: at(5 * 60 * MIN) },
    ];
    const stats = computeIntegritySignals(accounts);
    assert.equal(stats.summary.emailClusterCount, 0);
    assert.equal(stats.summary.signupBurstCount, 0);
    assert.equal(stats.summary.attributeClusterCount, 0);
    assert.equal(stats.summary.watchlistCount, 0);
  });
});
