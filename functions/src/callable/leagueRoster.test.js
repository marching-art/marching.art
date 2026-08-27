// Guard + refund rules for removeLeagueMember.
//
// FMA's #1 historical bug cluster (docs/FMA_LESSONS.md §7) is league
// management — and "remove from league" specifically. These pin who may remove
// whom and exactly how much CorpsCoin a removal refunds, the two places a
// commissioner could otherwise either purge rivals they shouldn't touch or farm
// the escrowed prize pool. The guard and the refund are pure, so the rules pin
// without a Firestore mock (same pattern as leagueAdmin.test.js).
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { assertCanRemoveMember, computeRemovalRefund } = require("./leagueRoster");

// owner "o", co-commissioner "c", plain members "m1"/"m2".
const league = (over = {}) => ({
  name: "Test League",
  creatorId: "o",
  commissioners: ["c"],
  members: ["o", "c", "m1", "m2"],
  settings: { entryFee: 100, prizePool: 400 },
  ...over,
});

describe("assertCanRemoveMember — who may remove whom", () => {
  test("a plain member cannot remove anyone", () => {
    assert.throws(
      () => assertCanRemoveMember({ league: league(), actorUid: "m1", memberId: "m2" }),
      /Only a commissioner/
    );
  });

  test("a commissioner can remove a plain member", () => {
    assert.doesNotThrow(() =>
      assertCanRemoveMember({ league: league(), actorUid: "c", memberId: "m1" })
    );
    assert.doesNotThrow(() =>
      assertCanRemoveMember({ league: league(), actorUid: "o", memberId: "m1" })
    );
  });

  test("the owner is never removable — not by a co-commissioner, not by an admin", () => {
    assert.throws(
      () => assertCanRemoveMember({ league: league(), actorUid: "c", memberId: "o" }),
      /owner cannot be removed/
    );
    assert.throws(
      () =>
        assertCanRemoveMember({ league: league(), actorUid: "c", memberId: "o", isAdmin: true }),
      /owner cannot be removed/
    );
  });

  test("a co-commissioner cannot remove a peer commissioner", () => {
    // Two co-commissioners must not be able to race to remove each other.
    const l = league({ commissioners: ["c", "c2"], members: ["o", "c", "c2", "m1"] });
    assert.throws(
      () => assertCanRemoveMember({ league: l, actorUid: "c", memberId: "c2" }),
      /Only the league owner can remove another commissioner/
    );
  });

  test("only the owner (or an admin) can remove a co-commissioner", () => {
    assert.doesNotThrow(() =>
      assertCanRemoveMember({ league: league(), actorUid: "o", memberId: "c" })
    );
    assert.doesNotThrow(() =>
      assertCanRemoveMember({ league: league(), actorUid: "c", memberId: "c", isAdmin: true })
    );
  });

  test("a co-commissioner may remove themselves", () => {
    assert.doesNotThrow(() =>
      assertCanRemoveMember({ league: league(), actorUid: "c", memberId: "c" })
    );
  });

  test("an admin can remove a plain member even without commissioner rights", () => {
    assert.doesNotThrow(() =>
      assertCanRemoveMember({ league: league(), actorUid: "outsider", memberId: "m1", isAdmin: true })
    );
  });

  test("removing a non-member fails with not-found", () => {
    assert.throws(
      () => assertCanRemoveMember({ league: league(), actorUid: "o", memberId: "ghost" }),
      /not a member/
    );
  });

  test("tolerates a league with no commissioners[] array", () => {
    const l = league({ commissioners: undefined, members: ["o", "m1"] });
    assert.doesNotThrow(() => assertCanRemoveMember({ league: l, actorUid: "o", memberId: "m1" }));
    assert.throws(
      () => assertCanRemoveMember({ league: l, actorUid: "m1", memberId: "o" }),
      /Only a commissioner/
    );
  });
});

describe("computeRemovalRefund — the pool is escrow, never a mint", () => {
  test("refunds the full entry fee when the pool covers it", () => {
    assert.equal(computeRemovalRefund(league(), true), 100);
  });

  test("clamps the refund to what the pool actually holds", () => {
    // A drained pool can never pay out more than it has — no minting.
    assert.equal(
      computeRemovalRefund(league({ settings: { entryFee: 100, prizePool: 40 } }), true),
      40
    );
    assert.equal(
      computeRemovalRefund(league({ settings: { entryFee: 100, prizePool: 0 } }), true),
      0
    );
  });

  test("a deleted account (no profile) is refunded nothing", () => {
    // There is no account to pay; the fee stays in the pool for the directors
    // still playing for it.
    assert.equal(computeRemovalRefund(league(), false), 0);
  });

  test("a free league (no entry fee) refunds nothing", () => {
    assert.equal(computeRemovalRefund(league({ settings: {} }), true), 0);
    assert.equal(computeRemovalRefund(league({ settings: undefined }), true), 0);
  });
});
