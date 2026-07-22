// Tests for the paged nightly profile fetch (scoring.fetchAllActiveProfiles).
// The old `.limit(5000)` fetch silently never scored profile 5,001+; these
// assert that the paged fetch covers every matching profile and preserves the
// query filter, projection, and snapshot shape the scoring core relies on.
//
// Fake query modeled on firestorePaging.test.js, extended with the
// where/select chain fetchAllActiveProfiles builds before paging begins.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { fetchAllActiveProfiles } = require("./scoring");

// A fake collection-group query over in-memory profile docs. Records the
// where/select calls; cursor paging slices the array by id order, exactly like
// the fake in firestorePaging.test.js.
function fakeDb(items, calls) {
  const makeQuery = (afterId, lim) => ({
    where: (field, op, value) => {
      calls.wheres.push([field, op, value]);
      return makeQuery(afterId, lim);
    },
    select: (...fields) => {
      calls.selects.push(fields);
      return makeQuery(afterId, lim);
    },
    orderBy: () => makeQuery(afterId, lim),
    limit: (n) => makeQuery(afterId, n),
    startAfter: (docSnap) => makeQuery(docSnap.id, lim),
    get: async () => {
      calls.pages++;
      let start = 0;
      if (afterId != null) start = items.findIndex((d) => d.id === afterId) + 1;
      const slice = items.slice(start, lim != null ? start + lim : undefined);
      return {
        empty: slice.length === 0,
        docs: slice.map((d) => ({
          id: d.id,
          data: () => ({ corps: d.corps }),
          ref: { parent: { parent: { id: d.uid } } },
        })),
      };
    },
  });
  return {
    collectionGroup: (name) => {
      calls.collectionGroups.push(name);
      return makeQuery(null, null);
    },
  };
}

const mkCalls = () => ({ collectionGroups: [], wheres: [], selects: [], pages: 0 });
const mkProfiles = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${String(i).padStart(5, "0")}`,
    uid: `user${i}`,
    corps: { worldClass: { corpsName: `Corps ${i}` } },
  }));

describe("fetchAllActiveProfiles", () => {
  test("fetches every profile past the old 5000 cap", async () => {
    const calls = mkCalls();
    const snapshot = await fetchAllActiveProfiles(fakeDb(mkProfiles(5750), calls), "s2026");

    assert.equal(snapshot.size, 5750, "profile 5,001+ must be scored too");
    assert.equal(snapshot.empty, false);
    assert.equal(snapshot.docs.length, 5750);
    // Pages of 1000: five full pages + one short page, no trailing empty read.
    assert.equal(calls.pages, 6);
  });

  test("preserves the season filter and field projection", async () => {
    const calls = mkCalls();
    await fetchAllActiveProfiles(fakeDb(mkProfiles(3), calls), "s2026");

    assert.deepEqual(calls.collectionGroups, ["profile"]);
    assert.deepEqual(calls.wheres, [["activeSeasonId", "==", "s2026"]]);
    assert.deepEqual(calls.selects, [["corps", "username", "displayName"]]);
  });

  test("returns snapshot-shaped docs the scoring core can consume", async () => {
    const calls = mkCalls();
    const snapshot = await fetchAllActiveProfiles(fakeDb(mkProfiles(2), calls), "s2026");

    // The scoring loop reads doc.data().corps and doc.ref.parent.parent.id.
    assert.equal(snapshot.docs[0].data().corps.worldClass.corpsName, "Corps 0");
    assert.equal(snapshot.docs[0].ref.parent.parent.id, "user0");
    assert.equal(snapshot.docs[1].ref.parent.parent.id, "user1");
  });

  test("reports empty when no profiles match", async () => {
    const calls = mkCalls();
    const snapshot = await fetchAllActiveProfiles(fakeDb([], calls), "s2026");

    assert.equal(snapshot.empty, true);
    assert.equal(snapshot.size, 0);
    assert.deepEqual(snapshot.docs, []);
  });
});
