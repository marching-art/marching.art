// Behavior tests for awardRegionalTrophies in scoringAwards.js — the
// regional-major trophy path (§5.11). Only the three branded majors crown
// regional champions: the Southwestern Championship (day 28), the Southeastern
// Championship (day 35), and the two-night Eastern Classic (days 41/42). Pool
// shows sharing a major's calendar day in a live season must NOT be crowned.
//
// Split out of scoringAwards.test.js to keep each file under the max-lines
// budget. Uses Node's built-in test runner (node:test) with the same fake
// Firestore/batch. Run with `npm test`.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || 'test-ns';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const admin = require('firebase-admin');
const { awardRegionalTrophies } = require('./scoringAwards');

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;

/**
 * Fake Firestore + batch covering exactly what awardRegionalTrophies uses:
 * db.doc(path).get() (the day-41 recap read for the Eastern combine) and
 * batch.set/update. Every batch write is recorded for assertions.
 */
function makeFakeDb(docs = new Map()) {
  const writes = [];

  const makeDocRef = (path) => ({
    path,
    async get() {
      return { exists: docs.has(path), data: () => docs.get(path) };
    },
  });

  const db = {
    doc: (path) => makeDocRef(path),
  };

  const batch = {
    set(ref, data, options) {
      writes.push({ type: 'set', path: ref.path, data, options });
    },
    update(ref, data) {
      writes.push({ type: 'update', path: ref.path, data });
    },
  };

  return { db, batch, writes };
}

// A finals-style result row as found in recap shows[].results[].
const result = (uid, corpsClass, totalScore, corpsName = `Corps ${uid}`) => ({
  uid,
  corpsClass,
  totalScore,
  corpsName,
});

const recapWithShows = (shows) => ({ shows });

const seasonData = {
  seasonUid: 'season-1',
  name: 'Test Season 2026',
  status: 'off-season',
};

describe('awardRegionalTrophies', () => {
  test('non-trophy days write nothing', async () => {
    const { db, batch, writes } = makeFakeDb();
    const recap = recapWithShows([
      { eventName: 'Midweek Show', results: [result('u1', 'worldClass', 90)] },
    ]);
    await awardRegionalTrophies(batch, recap, 30, seasonData, db);
    assert.equal(writes.length, 0);
  });

  test('day 41 (Eastern night 1) defers — no trophies from a half-field', async () => {
    const { db, batch, writes } = makeFakeDb();
    const recap = recapWithShows([
      { eventName: 'Eastern Classic', results: [result('u1', 'worldClass', 90)] },
    ]);
    await awardRegionalTrophies(batch, recap, 41, seasonData, db);
    assert.equal(writes.length, 0);
  });

  test('day 28: each competitive class crowns its own champion; SoundSport gets Best in Show', async () => {
    const { db, batch, writes } = makeFakeDb();
    const recap = recapWithShows([
      {
        eventName: 'marching.art Southwestern Championship',
        results: [
          // Listed out of score order to prove per-class re-sorting.
          result('w2', 'worldClass', 85),
          result('w1', 'worldClass', 92),
          result('o1', 'openClass', 78),
          result('s2', 'soundSport', 60),
          result('s1', 'soundSport', 71),
          // no aClass corps attended — no aClass trophy minted
        ],
      },
    ]);

    await awardRegionalTrophies(batch, recap, 28, seasonData, db);

    const trophyWrites = writes.filter((w) => w.data['trophies.regionals']);
    assert.deepEqual(
      trophyWrites.map((w) => w.path).sort(),
      [profilePath('o1'), profilePath('w1')],
      'only the class WINNERS get a regional trophy — w2/s2 get nothing'
    );

    const w1Write = trophyWrites.find((w) => w.path === profilePath('w1'));
    assert.ok(
      w1Write.data['trophies.regionals'].isEqual(
        admin.firestore.FieldValue.arrayUnion({
          type: 'regional',
          corpsClass: 'worldClass',
          seasonName: seasonData.name,
          eventName: 'marching.art Southwestern Championship',
          score: 92,
          rank: 1,
        })
      )
    );

    const soundSportWrites = writes.filter((w) => w.data['trophies.soundSportAwards']);
    assert.deepEqual(
      soundSportWrites.map((w) => w.path),
      [profilePath('s1')]
    );
    assert.ok(
      soundSportWrites[0].data['trophies.soundSportAwards'].isEqual(
        admin.firestore.FieldValue.arrayUnion({
          type: 'regional_best_in_show',
          seasonName: seasonData.name,
          eventName: 'marching.art Southwestern Championship',
          score: 71,
        })
      )
    );
  });

  test('day 28: only the branded major is crowned — pool shows sharing the day get nothing', async () => {
    // Live seasons map every scraped DCI event to its calendar day, so ordinary
    // pool shows can land on day 28 alongside the Southwestern Championship.
    // Only the major crowns a regional champion.
    const { db, batch, writes } = makeFakeDb();
    const recap = recapWithShows([
      {
        eventName: 'The Buccaneer Classic',
        results: [result('pool1', 'worldClass', 99)],
      },
      {
        eventName: 'marching.art Southwestern Championship',
        results: [result('major1', 'worldClass', 88)],
      },
      {
        eventName: 'Music on the Mountain',
        results: [result('pool2', 'openClass', 95)],
      },
    ]);

    await awardRegionalTrophies(batch, recap, 28, seasonData, db);

    const trophyWrites = writes.filter((w) => w.data['trophies.regionals']);
    assert.deepEqual(
      trophyWrites.map((w) => w.path),
      [profilePath('major1')],
      'the pool shows (Buccaneer, Music on the Mountain) mint no regional trophies'
    );
  });

  test('day 35: a day with no branded major writes nothing', async () => {
    const { db, batch, writes } = makeFakeDb();
    const recap = recapWithShows([
      { eventName: 'Midwestern Championship', results: [result('u1', 'worldClass', 90)] },
      { eventName: 'marching.art Pittsburgh', results: [result('u2', 'openClass', 80)] },
    ]);
    await awardRegionalTrophies(batch, recap, 35, seasonData, db);
    assert.equal(writes.length, 0);
  });

  test('day 42: Eastern Classic champion comes from the COMBINED two-night field', async () => {
    // Night 1's top corps outscored everyone on night 2 — the trophy must go
    // to the night-1 corps even though it isn't in the day-42 recap.
    const docs = new Map([
      [
        `fantasy_recaps/${seasonData.seasonUid}/days/41`,
        {
          shows: [
            {
              eventName: 'Eastern Classic',
              results: [result('fridayStar', 'worldClass', 95)],
            },
          ],
        },
      ],
    ]);
    const { db, batch, writes } = makeFakeDb(docs);
    const recap = recapWithShows([
      // A pool show also scored on day 42 — must not be crowned.
      {
        eventName: 'Music on the Mountain',
        results: [result('poolWinner', 'worldClass', 99)],
      },
      {
        eventName: 'Eastern Classic',
        results: [result('saturdayBest', 'worldClass', 90)],
      },
    ]);

    await awardRegionalTrophies(batch, recap, 42, seasonData, db);

    const trophyWrites = writes.filter((w) => w.data['trophies.regionals']);
    assert.deepEqual(
      trophyWrites.map((w) => w.path),
      [profilePath('fridayStar')],
      'combined Eastern field crowns the night-1 star; the day-42 pool show gets nothing'
    );
  });
});
