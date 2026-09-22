// Podium staff names: canonicalisation + validation, the claim/block rule,
// the two-phase release/carry helpers (read refs, then apply against the
// snapshots), and the moderation privilege (strikes → auto-revoke).
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const names = require("./staffNames");

/** A fake db whose refs are just paths (enough for planRelease/applyRelease). */
const fakeDb = { doc: (path) => ({ path }) };

/** A snapshot for a registry doc (or a missing one). */
const snap = (data) => ({ exists: data != null, data: () => data });

/** Records the writes a transaction receives. */
function fakeTransaction() {
  const ops = [];
  return {
    ops,
    delete: (ref) => ops.push({ type: "delete", path: ref.path }),
    set: (ref, data, opts) => ops.push({ type: "set", path: ref.path, data, opts }),
  };
}

describe("staff names — canonical key", () => {
  test("case, accents, punctuation and spacing all fold to one key", () => {
    const key = names.keyFor("J.T. Smith");
    assert.equal(key, "jtsmith");
    assert.equal(names.keyFor("jt smith"), key);
    assert.equal(names.keyFor("  JT   SMÍTH "), key);
    assert.equal(names.keyFor("J-T Smith"), key);
  });

  test("normalizeStaffName keeps what was typed and derives the key", () => {
    const out = names.normalizeStaffName("  Dana   Whitfield ");
    assert.deepEqual(out, { display: "Dana Whitfield", key: "danawhitfield" });
  });

  test("length, character set, and profanity are refused with a reason", () => {
    for (const bad of ["", "A", "x".repeat(33), "Dana 🎺", "Dana/Whit", "a slash\\", "F*ck", "..", "shit head", 42]) {
      assert.throws(() => names.normalizeStaffName(bad), /must|allowed|only use|letters or digits/i, String(bad));
    }
    // Two chars of pure punctuation pass the length check but have no key.
    assert.throws(() => names.normalizeStaffName("--"), /two letters or digits/);
  });

  test("names in other scripts are fine", () => {
    assert.equal(names.normalizeStaffName("José Álvarez").key, "josealvarez");
    assert.equal(names.normalizeStaffName("山田 太郎").key, "山田太郎");
  });
});

describe("staff names — claims", () => {
  const owner = { uid: "u1", staffId: "brass_u1_abc" };

  test("a missing doc never blocks; the staffer's own claim never blocks", () => {
    assert.equal(names.blockingClaim(snap(null), owner), null);
    assert.equal(names.blockingClaim(null, owner), null);
    assert.equal(names.blockingClaim(snap({ uid: "u1", staffId: "brass_u1_abc" }), owner), null);
  });

  test("another staffer's claim blocks — even the same director's other staffer", () => {
    const other = names.blockingClaim(
      snap({ uid: "u2", staffId: "guard_u2_x", corpsName: "Blue Stars", name: "JT Smith" }),
      owner
    );
    assert.deepEqual(other, { uid: "u2", staffId: "guard_u2_x", corpsName: "Blue Stars", name: "JT Smith" });
    assert.match(names.takenError(other).message, /Blue Stars/);
    assert.equal(names.takenError(other).code, "already-exists");

    const sameDirector = names.blockingClaim(snap({ uid: "u1", staffId: "guard_u1_y" }), owner);
    assert.ok(sameDirector);
    assert.match(names.takenError({ corpsName: null }).message, /another corps/);
  });

  test("buildClaim records who holds the name", () => {
    const claim = names.buildClaim({
      uid: "u1",
      staffId: "brass_u1_abc",
      specialty: "brass",
      corpsName: "Phantom",
      name: "Dana Whitfield",
      key: "danawhitfield",
    });
    assert.equal(claim.uid, "u1");
    assert.equal(claim.staffId, "brass_u1_abc");
    assert.equal(claim.corpsName, "Phantom");
    assert.equal(claim.key, "danawhitfield");
    assert.ok(claim.claimedAt);
  });
});

describe("staff names — release + carry", () => {
  const named = { id: "brass_u1_abc", specialty: "brass", name: "Dana Whitfield", nameKey: "danawhitfield" };
  const unnamed = { id: "guard_u1_def", specialty: "guard" };

  test("planRelease lists one ref per NAMED member", () => {
    const plan = names.planRelease(fakeDb, [named, unnamed, null, undefined]);
    assert.equal(plan.length, 1);
    assert.equal(plan[0].ref.path, `${names.COLLECTION}/danawhitfield`);
    assert.equal(plan[0].member, named);
    // A legacy member with a name but no stored key derives it.
    const legacy = names.planRelease(fakeDb, [{ id: "x", name: "J.T. Smith" }]);
    assert.equal(legacy[0].ref.path, `${names.COLLECTION}/jtsmith`);
  });

  test("applyRelease deletes only the doc the member still owns", () => {
    const plan = names.planRelease(fakeDb, [named]);
    let txn = fakeTransaction();
    assert.equal(names.applyRelease(txn, plan, [snap({ staffId: "brass_u1_abc" })]), 1);
    assert.deepEqual(txn.ops, [{ type: "delete", path: `${names.COLLECTION}/danawhitfield` }]);

    // Someone else legitimately holds the name now (stale name on the member).
    txn = fakeTransaction();
    assert.equal(names.applyRelease(txn, plan, [snap({ staffId: "other" })]), 0);
    assert.deepEqual(txn.ops, []);

    // Already gone.
    txn = fakeTransaction();
    assert.equal(names.applyRelease(txn, plan, [snap(null)]), 0);
    assert.deepEqual(txn.ops, []);
  });

  test("applyCarry merges the patch onto an owned doc and never creates one", () => {
    const plan = names.planRelease(fakeDb, [named]);
    let txn = fakeTransaction();
    names.applyCarry(txn, plan, [snap({ staffId: "brass_u1_abc" })], { corpsName: "New Name" });
    assert.deepEqual(txn.ops, [
      { type: "set", path: `${names.COLLECTION}/danawhitfield`, data: { corpsName: "New Name" }, opts: { merge: true } },
    ]);
    txn = fakeTransaction();
    names.applyCarry(txn, plan, [snap(null)], { corpsName: "New Name" });
    assert.deepEqual(txn.ops, []);
  });
});

describe("staff names — moderation privilege", () => {
  test("a fresh profile may name; a revoked one is refused with the reason", () => {
    assert.deepEqual(names.namingPrivilege(null), { revoked: false, strikes: 0, reason: null, history: [] });
    assert.doesNotThrow(() => names.assertMayName({}));
    assert.throws(
      () => names.assertMayName({ moderation: { staffNaming: { revoked: true, reason: "slurs" } } }),
      (err) => err.code === "permission-denied" && /slurs/.test(err.message)
    );
  });

  test("strikes accumulate and the threshold revokes automatically", () => {
    let profile = {};
    for (let i = 1; i < names.STRIKES_TO_REVOKE; i++) {
      const next = names.strike(profile, { name: `Bad ${i}`, staffId: `s${i}`, reason: null, by: "admin" });
      assert.equal(next.strikes, i);
      assert.equal(next.revoked, false);
      assert.equal(next.history.length, i);
      profile = { moderation: { staffNaming: next } };
    }
    const last = names.strike(profile, { name: "Bad last", staffId: "sN", reason: "again", by: "admin" });
    assert.equal(last.strikes, names.STRIKES_TO_REVOKE);
    assert.equal(last.revoked, true);
    assert.match(last.reason, /repeated/);
    assert.equal(last.history[last.history.length - 1].reason, "again");
  });

  test("explicit revoke/restore keep the strike record; history is capped", () => {
    const struck = { moderation: { staffNaming: { strikes: 2, history: new Array(10).fill({ action: "cleared" }) } } };
    const revoked = names.setRevoked(struck, { revoked: true, reason: "abuse", by: "admin" });
    assert.equal(revoked.revoked, true);
    assert.equal(revoked.strikes, 2);
    assert.equal(revoked.reason, "abuse");
    assert.equal(revoked.history.length, 10);
    assert.equal(revoked.history[9].action, "revoked");
    const restored = names.setRevoked({ moderation: { staffNaming: revoked } }, { revoked: false, reason: null, by: "admin" });
    assert.equal(restored.revoked, false);
    assert.equal(restored.strikes, 2);
    assert.equal(restored.reason, null);
    assert.doesNotThrow(() => names.assertMayName({ moderation: { staffNaming: restored } }));
  });
});
