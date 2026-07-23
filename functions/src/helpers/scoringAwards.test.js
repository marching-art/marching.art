// Behavior tests for the championship/trophy/coin award helpers in
// scoringAwards.js — the once-per-season path that writes permanent
// champion records and mints CorpsCoin.
//
// Covers buildChampionshipConfig (pure progression logic: cutoffs, tie
// handling at the cutoff, standings fallbacks), processCoinAwardsBatch
// (per-user aggregation, XP pairing, audit history), awardRegionalTrophies
// (trophy days, class gating, the Eastern Classic two-night combine),
// awardClassChampionshipTrophies (Day 46 medals + ribbons), and
// awardFinalsAndSaveChampions (Day 49 medals + the permanent
// season_champions document).
//
// Uses Node's built-in test runner (node:test) with a fake Firestore/batch
// in the same style as weeklyMatchups.test.js. Run with `npm test`.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || 'test-ns';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const admin = require('firebase-admin');
const {
  getTopCorpsFromSeasonStandings,
  buildChampionshipConfig,
  processCoinAwardsBatch,
  awardRegionalTrophies,
  awardClassChampionshipTrophies,
  awardFinalsAndSaveChampions,
} = require('./scoringAwards');
const { TRANSACTION_TYPES } = require('./economy');
const { XP_SOURCES } = require('./xpCalculations');

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;

/**
 * Fake Firestore + batch covering exactly what the award helpers use:
 * db.doc(path).get(), db.collection(path).doc() (coin history ids),
 * db.getAll() (champion profile fetch), and batch.set/update. Every batch
 * write is recorded for assertions. Doc refs expose parent.parent.id the
 * way awardFinalsAndSaveChampions reads the uid off a profile ref.
 */
function makeFakeDb(docs = new Map()) {
  const writes = [];
  let autoId = 0;

  const makeDocRef = (path) => {
    const segments = path.split('/');
    return {
      path,
      id: segments[segments.length - 1],
      parent: { parent: { id: segments[segments.length - 3] } },
      async get() {
        return { exists: docs.has(path), data: () => docs.get(path) };
      },
    };
  };

  const db = {
    doc: (path) => makeDocRef(path),
    collection(path) {
      return {
        doc: (docId) => makeDocRef(`${path}/${docId ?? `auto-${++autoId}`}`),
      };
    },
    async getAll(...refs) {
      return refs.map((ref) => ({
        ref,
        exists: docs.has(ref.path),
        data: () => docs.get(ref.path),
      }));
    },
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

// =============================================================================
// getTopCorpsFromSeasonStandings
// =============================================================================

describe('getTopCorpsFromSeasonStandings', () => {
  const recapForDay = (day, results) => ({
    offSeasonDay: day,
    shows: [{ eventName: `Day ${day} Show`, results }],
  });

  test("uses each corps' MOST RECENT score, excludes championship days, includes cutoff ties", () => {
    const allRecaps = [
      // u1 peaked early at 95 but slid to 80 — the most recent day wins,
      // so u1 ranks BELOW u2's 85 despite the higher season best.
      recapForDay(20, [result('u1', 'worldClass', 95)]),
      recapForDay(40, [
        result('u1', 'worldClass', 80),
        result('u2', 'worldClass', 85),
        result('u3', 'openClass', 70),
        result('u4', 'aClass', 70), // tied with u3 at the cutoff
        result('u5', 'aClass', 60),
      ]),
      // Championship-day scores must never leak into the standings fallback.
      recapForDay(47, [result('u5', 'aClass', 99)]),
    ];

    const top3 = getTopCorpsFromSeasonStandings(allRecaps, 3, [
      'worldClass',
      'openClass',
      'aClass',
    ]);

    // Cutoff rank 3 with u3/u4 tied at 3rd place score => 4 advance.
    assert.deepEqual(top3, [
      { uid: 'u2', corpsClass: 'worldClass' },
      { uid: 'u1', corpsClass: 'worldClass' },
      { uid: 'u3', corpsClass: 'openClass' },
      { uid: 'u4', corpsClass: 'aClass' },
    ]);
  });

  test('filters by eligible classes and returns null with no standings data', () => {
    const allRecaps = [recapForDay(10, [result('s1', 'soundSport', 90)])];
    assert.equal(getTopCorpsFromSeasonStandings(allRecaps, 5, ['worldClass']), null);
  });

  test('returns everyone when fewer corps exist than the cutoff', () => {
    const allRecaps = [
      recapForDay(10, [result('u1', 'worldClass', 80), result('u2', 'worldClass', 70)]),
    ];
    const top25 = getTopCorpsFromSeasonStandings(allRecaps, 25, ['worldClass']);
    assert.equal(top25.length, 2);
  });
});

// =============================================================================
// buildChampionshipConfig — pure championship-day progression
// =============================================================================

describe('buildChampionshipConfig', () => {
  test('returns null outside championship days', () => {
    assert.equal(buildChampionshipConfig(44, new Map(), []), null);
    assert.equal(buildChampionshipConfig(1, new Map(), []), null);
    assert.equal(buildChampionshipConfig(50, new Map(), []), null);
  });

  test('day 45: auto-enrolls all Open and A Class corps in Prelims', () => {
    const config = buildChampionshipConfig(45, new Map(), []);
    assert.deepEqual(config, {
      'Open and A Class Prelims': {
        participants: null,
        classFilter: ['openClass', 'aClass'],
      },
    });
  });

  test('day 46: top 8 Open and top 4 A Class from Day 45 advance to Finals', () => {
    const day45Results = [];
    for (let i = 1; i <= 10; i++) {
      day45Results.push(result(`open${i}`, 'openClass', 100 - i));
    }
    for (let i = 1; i <= 6; i++) {
      day45Results.push(result(`a${i}`, 'aClass', 50 - i));
    }
    const recapsByDay = new Map([[45, { shows: [{ results: day45Results }] }]]);

    const config = buildChampionshipConfig(46, recapsByDay, []);
    const finals = config['Open and A Class Finals'];
    assert.deepEqual(finals.classFilter, ['openClass', 'aClass']);
    assert.deepEqual(
      finals.participants,
      [
        ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
          uid: `open${i}`,
          corpsClass: 'openClass',
        })),
        ...[1, 2, 3, 4].map((i) => ({ uid: `a${i}`, corpsClass: 'aClass' })),
      ],
      'exactly top 8 Open + top 4 A Class, in score order'
    );
  });

  test('day 46 with no Day 45 results: everyone advances (participants null)', () => {
    const config = buildChampionshipConfig(46, new Map(), []);
    assert.deepEqual(config, {
      'Open and A Class Finals': {
        participants: null,
        classFilter: ['openClass', 'aClass'],
      },
    });
  });

  test('day 47: all three competitive classes auto-enrolled in World Prelims', () => {
    const config = buildChampionshipConfig(47, new Map(), []);
    assert.deepEqual(config, {
      'marching.art World Championship Prelims': {
        participants: null,
        classFilter: ['worldClass', 'openClass', 'aClass'],
      },
    });
  });

  test('day 48: top 25 from Prelims advance, with everyone tied at 25th included', () => {
    // 27 corps: places 1-24 distinct, then THREE corps tied at the 25th score.
    const prelims = [];
    for (let i = 1; i <= 24; i++) {
      prelims.push(result(`u${i}`, 'worldClass', 100 - i));
    }
    prelims.push(result('tieA', 'worldClass', 50));
    prelims.push(result('tieB', 'openClass', 50));
    prelims.push(result('tieC', 'aClass', 50));
    const recapsByDay = new Map([[47, { shows: [{ results: prelims }] }]]);

    const config = buildChampionshipConfig(48, recapsByDay, []);
    const semis = config['marching.art World Championship Semifinals'];
    assert.equal(semis.participants.length, 27, 'all three tied corps advance');
    const uids = semis.participants.map((p) => p.uid);
    assert.ok(uids.includes('tieA') && uids.includes('tieB') && uids.includes('tieC'));
  });

  test('day 48 with no Prelims results: falls back to season-standings top 25', () => {
    const allRecaps = [
      {
        offSeasonDay: 40,
        shows: [
          {
            results: [result('u1', 'worldClass', 90), result('u2', 'openClass', 80)],
          },
        ],
      },
    ];
    const config = buildChampionshipConfig(48, new Map(), allRecaps);
    const semis = config['marching.art World Championship Semifinals'];
    assert.deepEqual(semis.participants, [
      { uid: 'u1', corpsClass: 'worldClass' },
      { uid: 'u2', corpsClass: 'openClass' },
    ]);
  });

  test('day 49: top 12 from Semis into Finals, all SoundSport into the Festival', () => {
    const semis = [];
    for (let i = 1; i <= 15; i++) {
      semis.push(result(`u${i}`, 'worldClass', 100 - i));
    }
    const recapsByDay = new Map([[48, { shows: [{ results: semis }] }]]);

    const config = buildChampionshipConfig(49, recapsByDay, []);
    const finals = config['marching.art World Championship Finals'];
    assert.deepEqual(
      finals.participants.map((p) => p.uid),
      Array.from({ length: 12 }, (_, i) => `u${i + 1}`)
    );

    const festival = config['SoundSport International Music & Food Festival'];
    assert.equal(festival.participants, null, 'all SoundSport corps enrolled');
    assert.deepEqual(festival.classFilter, ['soundSport']);
  });

  test('day 49 with no Semis results and no standings: Finals open to all eligible', () => {
    const config = buildChampionshipConfig(49, new Map(), []);
    assert.equal(config['marching.art World Championship Finals'].participants, null);
  });
});

// =============================================================================
// processCoinAwardsBatch — the CorpsCoin mint
// =============================================================================

describe('processCoinAwardsBatch', () => {
  test('writes nothing for an empty award list', () => {
    const { db, batch, writes } = makeFakeDb();
    processCoinAwardsBatch([], batch, db);
    assert.equal(writes.length, 0);
  });

  test('aggregates awards per user: one balance increment, per-award history entries', () => {
    const { db, batch, writes } = makeFakeDb();
    processCoinAwardsBatch(
      [
        { uid: 'alice', corpsClass: 'worldClass', showName: 'Show A', amount: 200 },
        { uid: 'alice', corpsClass: 'aClass', showName: 'Show B', amount: 100 },
        { uid: 'bob', corpsClass: 'openClass', showName: 'Show A', amount: 150 },
      ],
      batch,
      db
    );

    // Exactly one profile update per user — the mint is aggregated.
    const aliceUpdates = writes.filter(
      (w) => w.type === 'update' && w.path === profilePath('alice')
    );
    assert.equal(aliceUpdates.length, 1);
    assert.ok(
      aliceUpdates[0].data.corpsCoin.isEqual(admin.firestore.FieldValue.increment(300)),
      "alice's balance increments by the SUM of her awards"
    );
    // Each attended show also pays participation XP alongside the CC.
    assert.ok(
      aliceUpdates[0].data.xp.isEqual(
        admin.firestore.FieldValue.increment(XP_SOURCES.showParticipation * 2)
      )
    );

    const bobUpdate = writes.find((w) => w.type === 'update' && w.path === profilePath('bob'));
    assert.ok(bobUpdate.data.corpsCoin.isEqual(admin.firestore.FieldValue.increment(150)));

    // One audit-trail entry PER award in the corpsCoinHistory subcollection.
    const aliceHistory = writes.filter(
      (w) => w.type === 'set' && w.path.startsWith(`artifacts/${NS}/users/alice/corpsCoinHistory/`)
    );
    assert.equal(aliceHistory.length, 2);
    assert.equal(aliceHistory[0].data.type, TRANSACTION_TYPES.SHOW_PARTICIPATION);
    assert.equal(aliceHistory[0].data.amount, 200);
    assert.equal(aliceHistory[0].data.description, 'Show performance at Show A');
    assert.equal(aliceHistory[0].data.corpsClass, 'worldClass');
    assert.equal(aliceHistory[1].data.amount, 100);
  });

  test('non-participation award types (design bonuses) mint CC but pay no XP', () => {
    const { db, batch, writes } = makeFakeDb();
    processCoinAwardsBatch(
      [
        {
          uid: 'carol',
          corpsClass: 'worldClass',
          showName: 'Show A',
          amount: 50,
          type: 'show_design',
          description: 'Design bonus',
        },
      ],
      batch,
      db
    );

    const update = writes.find((w) => w.type === 'update');
    assert.ok(update.data.corpsCoin.isEqual(admin.firestore.FieldValue.increment(50)));
    assert.ok(!('xp' in update.data), 'CC-only award must not increment xp');

    const history = writes.find((w) => w.type === 'set');
    assert.equal(history.data.type, 'show_design');
    assert.equal(history.data.description, 'Design bonus');
  });
});

// =============================================================================
// processCoinAwardsBatch — idempotency (awardLedger)
//
// The nightly ChunkedWriter commits chunks non-atomically, so a mid-commit
// failure re-runs the whole day. With season context the mint must apply at
// most once per (uid, day): the increment carries a per-day token, and a
// re-run skips users who already carry it.
// =============================================================================

const { showAwardToken, LEDGER_FIELD } = require('./awardLedger');

describe('processCoinAwardsBatch — idempotency', () => {
  const awards = [{ uid: 'alice', corpsClass: 'worldClass', showName: 'Show A', amount: 200 }];
  const ctx = { seasonUid: 'season-1', scoredDay: 7 };
  const token = showAwardToken('season-1', 7);

  test('first run mints AND stamps the day token in the same update op', async () => {
    const { db, batch, writes } = makeFakeDb();
    await processCoinAwardsBatch(awards, batch, db, ctx);

    const update = writes.find((w) => w.type === 'update' && w.path === profilePath('alice'));
    assert.ok(update, 'alice is paid on the first run');
    assert.ok(update.data.corpsCoin.isEqual(admin.firestore.FieldValue.increment(200)));
    // The token rides the SAME write as the increment — atomic witness.
    assert.ok(
      update.data[LEDGER_FIELD].isEqual(admin.firestore.FieldValue.arrayUnion(token)),
      "the day token is written alongside the increment"
    );
  });

  test('re-run skips a user who already carries the day token (no double-pay)', async () => {
    // Simulate the state after a torn commit: alice's mint landed, so her
    // profile already has the token. The retry must not pay her again.
    const docs = new Map([[profilePath('alice'), { [LEDGER_FIELD]: [token] }]]);
    const { db, batch, writes } = makeFakeDb(docs);
    await processCoinAwardsBatch(awards, batch, db, ctx);

    assert.equal(
      writes.filter((w) => w.path === profilePath('alice')).length,
      0,
      'no profile update and no history write for an already-awarded user'
    );
  });

  test('force re-applies even when the token is present (admin reprocess)', async () => {
    const docs = new Map([[profilePath('alice'), { [LEDGER_FIELD]: [token] }]]);
    const { db, batch, writes } = makeFakeDb(docs);
    await processCoinAwardsBatch(awards, batch, db, { ...ctx, force: true });

    const update = writes.find((w) => w.type === 'update' && w.path === profilePath('alice'));
    assert.ok(update, 'force bypasses the idempotency skip');
    assert.ok(update.data.corpsCoin.isEqual(admin.firestore.FieldValue.increment(200)));
  });

  test('without season context it stays non-idempotent (unmarked, back-compat)', async () => {
    const { db, batch, writes } = makeFakeDb();
    await processCoinAwardsBatch(awards, batch, db);
    const update = writes.find((w) => w.type === 'update' && w.path === profilePath('alice'));
    assert.ok(update);
    assert.ok(!(LEDGER_FIELD in update.data), 'no token when no season context supplied');
  });

  test('captionStats increments ride the SAME tokened write as the coin mint', async () => {
    const { db, batch, writes } = makeFakeDb();
    const captionPoints = new Map([['alice', { GE1: 2.35, MB: 0 }]]);
    await processCoinAwardsBatch(awards, batch, db, { ...ctx, captionPoints });

    const updates = writes.filter((w) => w.type === 'update' && w.path === profilePath('alice'));
    assert.equal(updates.length, 1, 'coins, captionStats, and the token land in ONE write op');
    const { data } = updates[0];
    assert.ok(data.corpsCoin.isEqual(admin.firestore.FieldValue.increment(200)));
    assert.ok(
      data['captionStats.GE1'].isEqual(admin.firestore.FieldValue.increment(2.4)),
      'caption points banked (rounded to one decimal) in the same op'
    );
    assert.ok(!('captionStats.MB' in data), 'zero-point captions are not written');
    assert.ok(data[LEDGER_FIELD].isEqual(admin.firestore.FieldValue.arrayUnion(token)));
  });

  test('torn-commit retry cannot double-bank captionStats (the token skips them too)', async () => {
    // After a torn commit, alice's write (coins + captionStats + token)
    // landed. The retry re-runs the whole day; her token must now skip the
    // caption increments as well — this was the pre-ledger double-count bug.
    const docs = new Map([[profilePath('alice'), { [LEDGER_FIELD]: [token] }]]);
    const { db, batch, writes } = makeFakeDb(docs);
    const captionPoints = new Map([['alice', { GE1: 2.35 }]]);
    await processCoinAwardsBatch(awards, batch, db, { ...ctx, captionPoints });

    assert.equal(
      writes.filter((w) => w.path === profilePath('alice')).length,
      0,
      'no coin AND no captionStats writes for an already-awarded user'
    );
  });

  test('caption points without a coin award still land, tokened, with no coin fields', async () => {
    const { db, batch, writes } = makeFakeDb();
    const captionPoints = new Map([['bob', { B: 1.2 }]]);
    await processCoinAwardsBatch([], batch, db, { ...ctx, captionPoints });

    const update = writes.find((w) => w.type === 'update' && w.path === profilePath('bob'));
    assert.ok(update, 'caption-only user still gets the guarded write');
    assert.ok(!('corpsCoin' in update.data), 'no zero coin increment is fabricated');
    assert.ok(update.data['captionStats.B'].isEqual(admin.firestore.FieldValue.increment(1.2)));
    assert.ok(update.data[LEDGER_FIELD].isEqual(admin.firestore.FieldValue.arrayUnion(token)));
  });
});

// =============================================================================
// awardRegionalTrophies
// =============================================================================

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
        eventName: 'Southern Regional',
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
          eventName: 'Southern Regional',
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
          eventName: 'Southern Regional',
          score: 71,
        })
      )
    );
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
      {
        eventName: 'Eastern Classic',
        results: [result('saturdayBest', 'worldClass', 90)],
      },
    ]);

    await awardRegionalTrophies(batch, recap, 42, seasonData, db);

    const trophyWrites = writes.filter((w) => w.data['trophies.regionals']);
    assert.deepEqual(
      trophyWrites.map((w) => w.path),
      [profilePath('fridayStar')]
    );
  });
});

// =============================================================================
// awardClassChampionshipTrophies (Day 46 Open/A Class Finals)
// =============================================================================

describe('awardClassChampionshipTrophies', () => {
  test('gold/silver/bronze per class in score order, finalist ribbons for all', () => {
    const { db, batch, writes } = makeFakeDb();
    const recap = recapWithShows([
      {
        eventName: 'Open and A Class Finals',
        results: [
          result('o3', 'openClass', 80),
          result('o1', 'openClass', 90),
          result('o4', 'openClass', 75),
          result('o2', 'openClass', 85),
          result('a1', 'aClass', 70),
          result('a2', 'aClass', 65),
        ],
      },
    ]);

    awardClassChampionshipTrophies(batch, recap, seasonData, db);

    const medalWrites = writes.filter((w) => w.data['trophies.classChampionships']);
    // Top 3 Open + both A Class corps (fewer than podium places => 2 medals).
    assert.equal(medalWrites.length, 5);

    const medalFor = (uid) => medalWrites.find((w) => w.path === profilePath(uid));
    assert.ok(
      medalFor('o1').data['trophies.classChampionships'].isEqual(
        admin.firestore.FieldValue.arrayUnion({
          type: 'class_championship',
          classType: 'openClass',
          metal: 'gold',
          seasonName: seasonData.name,
          eventName: 'Open and A Class Finals',
          score: 90,
          rank: 1,
        })
      ),
      'highest Open score takes gold even when listed out of order'
    );
    assert.ok(
      medalFor('o3').data['trophies.classChampionships'].isEqual(
        admin.firestore.FieldValue.arrayUnion({
          type: 'class_championship',
          classType: 'openClass',
          metal: 'bronze',
          seasonName: seasonData.name,
          eventName: 'Open and A Class Finals',
          score: 80,
          rank: 3,
        })
      )
    );
    assert.equal(medalFor('o4'), undefined, '4th place gets no medal');
    assert.ok(
      medalFor('a1').data['trophies.classChampionships'].isEqual(
        admin.firestore.FieldValue.arrayUnion({
          type: 'class_championship',
          classType: 'aClass',
          metal: 'gold',
          seasonName: seasonData.name,
          eventName: 'Open and A Class Finals',
          score: 70,
          rank: 1,
        })
      ),
      'A Class podium is independent of Open Class'
    );

    // Every participant — medalist or not — gets a finalist ribbon.
    const ribbonWrites = writes.filter((w) => w.data['trophies.classFinalistRibbons']);
    assert.deepEqual(
      ribbonWrites.map((w) => w.path).sort(),
      ['a1', 'a2', 'o1', 'o2', 'o3', 'o4'].map(profilePath).sort()
    );
  });

  test('an empty finals show writes nothing', () => {
    const { db, batch, writes } = makeFakeDb();
    awardClassChampionshipTrophies(
      batch,
      recapWithShows([{ eventName: 'Open and A Class Finals', results: [] }]),
      seasonData,
      db
    );
    assert.equal(writes.length, 0);
  });
});

// =============================================================================
// awardFinalsAndSaveChampions (Day 49) — the permanent record
// =============================================================================

describe('awardFinalsAndSaveChampions', () => {
  test('medals top 3, finalist medals for all, and saves the season_champions doc', async () => {
    const docs = new Map([
      [profilePath('w1'), { username: 'DirectorOne' }],
      [profilePath('w2'), { username: 'DirectorTwo' }],
      [profilePath('w3'), { username: 'DirectorThree' }],
      [profilePath('o1'), { username: 'OpenDirector' }],
      // w4 has no profile doc — username falls back to "Unknown" if podiumed.
    ]);
    const { db, batch, writes } = makeFakeDb(docs);
    const recap = recapWithShows([
      {
        eventName: 'marching.art World Championship Finals',
        results: [
          // Unsorted on purpose: the function must rank by totalScore.
          result('w3', 'worldClass', 88, 'Third Corps'),
          result('w1', 'worldClass', 97, 'Champion Corps'),
          result('w4', 'worldClass', 80, 'Fourth Corps'),
          result('w2', 'worldClass', 93, 'Second Corps'),
          result('o1', 'openClass', 75, 'Open Star'),
        ],
      },
    ]);

    const champions = await awardFinalsAndSaveChampions(batch, recap, seasonData, db);

    // --- Championship medals: top 3 overall in the Finals show ---
    const medalWrites = writes.filter((w) => w.data['trophies.championships']);
    assert.deepEqual(
      medalWrites.map((w) => w.path),
      [profilePath('w1'), profilePath('w2'), profilePath('w3')],
      'medals go to the top 3 by score, in rank order'
    );
    assert.ok(
      medalWrites[0].data['trophies.championships'].isEqual(
        admin.firestore.FieldValue.arrayUnion({
          type: 'championship',
          metal: 'gold',
          corpsClass: 'worldClass',
          seasonName: seasonData.name,
          eventName: 'marching.art World Championship Finals',
          score: 97,
          rank: 1,
        })
      )
    );

    // --- Finalist medals: every participant, with their finish rank ---
    const finalistWrites = writes.filter((w) => w.data['trophies.finalistMedals']);
    assert.equal(finalistWrites.length, 5);
    const o1Finalist = finalistWrites.find((w) => w.path === profilePath('o1'));
    assert.ok(
      o1Finalist.data['trophies.finalistMedals'].isEqual(
        admin.firestore.FieldValue.arrayUnion({
          type: 'finalist',
          seasonName: seasonData.name,
          eventName: 'marching.art World Championship Finals',
          rank: 5,
        })
      )
    );

    // --- The permanent season_champions document ---
    const championsWrite = writes.find(
      (w) => w.type === 'set' && w.path === `season_champions/${seasonData.seasonUid}`
    );
    assert.ok(championsWrite, 'champions doc saved keyed by seasonUid');
    const saved = championsWrite.data;
    assert.equal(saved.seasonId, 'season-1');
    assert.equal(saved.seasonName, 'Test Season 2026');
    assert.equal(saved.seasonType, 'off-season');
    assert.ok(saved.archivedAt instanceof Date);
    // Per-class podiums, with usernames resolved from profiles.
    assert.deepEqual(saved.classes.worldClass, [
      { rank: 1, uid: 'w1', username: 'DirectorOne', corpsName: 'Champion Corps', score: 97 },
      { rank: 2, uid: 'w2', username: 'DirectorTwo', corpsName: 'Second Corps', score: 93 },
      { rank: 3, uid: 'w3', username: 'DirectorThree', corpsName: 'Third Corps', score: 88 },
    ]);
    assert.deepEqual(saved.classes.openClass, [
      { rank: 1, uid: 'o1', username: 'OpenDirector', corpsName: 'Open Star', score: 75 },
    ]);
    // The function returns exactly what it saved.
    assert.deepEqual(champions, saved);
  });

  test("falls back to 'Unknown' when a champion's profile is missing", async () => {
    const { db, batch, writes } = makeFakeDb(); // no profiles at all
    const recap = recapWithShows([
      {
        eventName: 'marching.art World Championship Finals',
        results: [result('ghost', 'worldClass', 90, 'Ghost Corps')],
      },
    ]);

    await awardFinalsAndSaveChampions(batch, recap, seasonData, db);

    const championsWrite = writes.find(
      (w) => w.path === `season_champions/${seasonData.seasonUid}`
    );
    assert.equal(championsWrite.data.classes.worldClass[0].username, 'Unknown');
  });

  test('SoundSport Festival: single Best in Show, no medals or finalist ribbons', async () => {
    const docs = new Map([[profilePath('s1'), { username: 'FestivalFan' }]]);
    const { db, batch, writes } = makeFakeDb(docs);
    const recap = recapWithShows([
      {
        eventName: 'SoundSport International Music & Food Festival',
        results: [result('s2', 'soundSport', 60), result('s1', 'soundSport', 72)],
      },
    ]);

    await awardFinalsAndSaveChampions(batch, recap, seasonData, db);

    const bestInShow = writes.filter((w) => w.data['trophies.soundSportAwards']);
    assert.deepEqual(
      bestInShow.map((w) => w.path),
      [profilePath('s1')]
    );
    assert.ok(
      bestInShow[0].data['trophies.soundSportAwards'].isEqual(
        admin.firestore.FieldValue.arrayUnion({
          type: 'international_festival',
          seasonName: seasonData.name,
          eventName: 'SoundSport International Music & Food Festival',
          score: 72,
        })
      )
    );
    // Non-competitive: no championship medals, no finalist medals.
    assert.equal(writes.filter((w) => w.data['trophies.championships']).length, 0);
    assert.equal(writes.filter((w) => w.data['trophies.finalistMedals']).length, 0);
  });

  test('an empty finals day still archives an (empty) champions doc', async () => {
    const { db, batch, writes } = makeFakeDb();
    const recap = recapWithShows([
      { eventName: 'marching.art World Championship Finals', results: [] },
    ]);

    const champions = await awardFinalsAndSaveChampions(batch, recap, seasonData, db);

    assert.deepEqual(champions.classes, {});
    const championsWrite = writes.find(
      (w) => w.path === `season_champions/${seasonData.seasonUid}`
    );
    assert.ok(championsWrite, 'the season is archived even with no finalists');
    // No trophies minted from thin air.
    assert.equal(writes.filter((w) => w.type === 'update').length, 0);
  });
});
