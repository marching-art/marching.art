// League teardown. Deleting a league used to delete two documents and leave
// everything underneath it — standings, matchups, chat, activity, recaps,
// pools, meta — in the database forever, along with any escrowed CorpsCoin.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  escrowedTotal,
  deleteLeagueSubcollections,
  planMemberDetachment,
  LEAGUE_SUBCOLLECTIONS,
} = require("./leagueLifecycle");

describe("escrowedTotal", () => {
  test("sums the prize pool and the carried-over pool", () => {
    assert.equal(escrowedTotal({ settings: { prizePool: 300 }, poolCarry: 75 }), 375);
  });

  test("treats missing or negative values as zero", () => {
    assert.equal(escrowedTotal({}), 0);
    assert.equal(escrowedTotal(null), 0);
    assert.equal(escrowedTotal({ settings: { prizePool: -50 }, poolCarry: 25 }), 25);
  });
});

/** Fake Firestore covering collection().limit().get() and batched deletes. */
function makeFakeDb(contents) {
  const store = new Map(Object.entries(contents));
  const deleted = [];

  const leagueRef = {
    id: "league-1",
    collection(name) {
      return {
        limit(n) {
          return {
            async get() {
              const docs = (store.get(name) || []).slice(0, n).map((id) => ({
                ref: { path: `leagues/league-1/${name}/${id}` },
              }));
              return { empty: docs.length === 0, size: docs.length, docs };
            },
          };
        },
      };
    },
  };

  const db = {
    batch() {
      const ops = [];
      return {
        delete(ref) {
          ops.push(ref.path);
        },
        async commit() {
          for (const path of ops) {
            const [, , name, id] = path.split("/");
            store.set(
              name,
              (store.get(name) || []).filter((docId) => docId !== id)
            );
            deleted.push(path);
          }
        },
      };
    },
  };

  return { db, leagueRef, deleted };
}

describe("deleteLeagueSubcollections", () => {
  test("clears every subcollection a league owns", async () => {
    const { db, leagueRef, deleted } = makeFakeDb({
      standings: ["current"],
      matchups: ["week-1", "week-2"],
      chat: ["m1", "m2", "m3"],
      activity: ["a1"],
      recaps: ["week-1"],
      pools: ["Mon Jul 27 2026"],
      meta: ["private", "rivalries"],
    });

    const count = await deleteLeagueSubcollections(db, leagueRef);

    assert.equal(count, 11);
    for (const name of LEAGUE_SUBCOLLECTIONS) {
      assert.ok(
        deleted.some((path) => path.includes(`/${name}/`)),
        `${name} should have been cleared`
      );
    }
  });

  test("is a no-op for a league with nothing under it", async () => {
    const { db, leagueRef } = makeFakeDb({});
    assert.equal(await deleteLeagueSubcollections(db, leagueRef), 0);
  });

  // Called after the league document is already gone, so a failure here must
  // leave orphans rather than fail the member's action.
  test("never throws when a subcollection read fails", async () => {
    const leagueRef = {
      id: "league-1",
      collection() {
        return {
          limit() {
            return {
              async get() {
                throw new Error("permission denied");
              },
            };
          },
        };
      },
    };
    assert.equal(await deleteLeagueSubcollections({ batch: () => {} }, leagueRef), 0);
  });
});

// A league's roster lives on the LEAGUE document, so deleting an account has to
// go and find every league the director was in. Getting this wrong is what left
// unremovable ghosts on rosters.
describe("planMemberDetachment", () => {
  test("does nothing for someone who is not on the roster", () => {
    assert.equal(planMemberDetachment({ members: ["a", "b"] }, "c"), null);
    assert.equal(planMemberDetachment({}, "a"), null);
    assert.equal(planMemberDetachment({ members: ["a"] }, ""), null);
  });

  test("dissolves a league whose last member is going", () => {
    const plan = planMemberDetachment({ members: ["a"], creatorId: "a" }, "a");
    assert.equal(plan.dissolve, true);
    assert.equal(plan.successorUid, null);
  });

  test("detaches a plain member without touching the commissioners", () => {
    const plan = planMemberDetachment(
      { members: ["owner", "b"], creatorId: "owner", commissioners: ["c"] },
      "b"
    );
    assert.deepEqual(plan, { dissolve: false, dropCommissioner: false, successorUid: null });
  });

  // Losing the seat means losing the job — `commissioners` is what every league
  // gate reads, so a uid left behind there is a non-member who can still run the
  // league.
  test("strips a departing co-commissioner of the job", () => {
    const plan = planMemberDetachment(
      { members: ["owner", "b"], creatorId: "owner", commissioners: ["b"] },
      "b"
    );
    assert.equal(plan.dropCommissioner, true);
    assert.equal(plan.successorUid, null);
  });

  // Every commissioner gate keys off the owner, so a league whose owner vanishes
  // without succession permanently loses the ability to run itself.
  test("hands an owner's league to a co-commissioner", () => {
    const plan = planMemberDetachment(
      { members: ["owner", "b", "c"], creatorId: "owner", commissioners: ["c"] },
      "owner"
    );
    assert.equal(plan.dissolve, false);
    assert.equal(plan.successorUid, "c");
  });

  test("falls back to any remaining member when there is no co-commissioner", () => {
    const plan = planMemberDetachment({ members: ["owner", "b"], creatorId: "owner" }, "owner");
    assert.equal(plan.successorUid, "b");
  });

  test("tolerates a league whose commissioners field is missing or malformed", () => {
    const plan = planMemberDetachment(
      { members: ["owner", "b"], creatorId: "owner", commissioners: { b: true } },
      "b"
    );
    assert.equal(plan.dropCommissioner, false);
  });
});
