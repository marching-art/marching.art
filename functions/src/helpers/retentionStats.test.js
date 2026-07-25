// Unit tests for the retention rollup (helpers/retentionStats.js).
// Run with `npm test` from functions/.
//
// The whole point of this job is to produce numbers an operator will act on, so
// these target the ways a retention metric quietly lies: counting accounts too
// young to answer a D30 question, reporting "0%" when it means "no data", and
// treating the three timestamp shapes on profiles as if they were one.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || 'test-ns';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { summarizeRetention, STREAK_BUCKETS, COHORT_DAYS } = require('./retentionStats');

const NOW = new Date('2026-07-25T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

/** A date N days before NOW. */
const daysAgo = (n) => new Date(NOW.getTime() - n * DAY_MS);

/** A profile record in the projected shape the job reads. */
const profile = ({ createdAt = null, lastLogin = null, loginStreak = 0 } = {}) => ({
  createdAt,
  engagement: { lastLogin, loginStreak },
});

describe('summarizeRetention — active counts', () => {
  test('buckets DAU/WAU/MAU by days since last login', () => {
    const stats = summarizeRetention(
      [
        profile({ lastLogin: daysAgo(0) }), // today
        profile({ lastLogin: daysAgo(3) }), // this week
        profile({ lastLogin: daysAgo(20) }), // this month
        profile({ lastLogin: daysAgo(200) }), // lapsed
      ],
      NOW
    );

    // The windows nest: today's login is also in the week and the month.
    assert.deepEqual(stats.active, { dau: 1, wau: 2, mau: 3 });
    assert.equal(stats.totalProfiles, 4);
  });

  test('reports stickiness as DAU/MAU', () => {
    const stats = summarizeRetention(
      [
        profile({ lastLogin: daysAgo(0) }),
        profile({ lastLogin: daysAgo(0) }),
        profile({ lastLogin: daysAgo(10) }),
        profile({ lastLogin: daysAgo(10) }),
      ],
      NOW
    );
    assert.equal(stats.stickiness, 0.5);
  });

  test('reports stickiness as null, not 0, when nobody is active', () => {
    // 0 would read as "terrible engagement" on the dashboard; the truth is
    // "there is nothing to divide".
    const stats = summarizeRetention([profile({ lastLogin: daysAgo(500) })], NOW);
    assert.equal(stats.stickiness, null);
    assert.equal(stats.active.mau, 0);
  });

  test('treats the activity windows as strictly-less-than day boundaries', () => {
    // A login exactly 24h old is yesterday's, not today's. Pinned because the
    // off-by-one here would silently inflate DAU by a full day's logins, and
    // DAU feeds the stickiness ratio the dashboard leads with.
    const stats = summarizeRetention(
      [
        profile({ lastLogin: daysAgo(0.99) }),
        profile({ lastLogin: daysAgo(1) }),
        profile({ lastLogin: daysAgo(6.99) }),
        profile({ lastLogin: daysAgo(7) }),
      ],
      NOW
    );
    assert.equal(stats.active.dau, 1);
    assert.equal(stats.active.wau, 3);
    assert.equal(stats.active.mau, 4);
  });

  test('counts profiles that have never logged in', () => {
    const stats = summarizeRetention(
      [profile({ createdAt: daysAgo(2) }), profile({ lastLogin: daysAgo(0.5) })],
      NOW
    );
    assert.equal(stats.neverLoggedIn, 1);
    assert.equal(stats.active.dau, 1);
  });
});

describe('summarizeRetention — cohort retention', () => {
  test('only counts accounts old enough to answer the question', () => {
    const stats = summarizeRetention(
      [
        // 40 days old — answers every cohort.
        profile({ createdAt: daysAgo(40), lastLogin: daysAgo(5) }),
        // 3 days old — can answer D1 but not D7/D14/D30.
        profile({ createdAt: daysAgo(3), lastLogin: daysAgo(0) }),
      ],
      NOW
    );

    assert.equal(stats.retention.d1.eligible, 2);
    assert.equal(stats.retention.d7.eligible, 1);
    assert.equal(stats.retention.d14.eligible, 1);
    assert.equal(stats.retention.d30.eligible, 1);
  });

  test('counts a director as retained at day N when they returned any time after it', () => {
    // Retention asks "did they come back by then", not "were they present on
    // that exact day". Active on day 9 counts for D7 but not D14.
    const createdAt = daysAgo(30);
    const lastLogin = new Date(createdAt.getTime() + 9 * DAY_MS);
    const stats = summarizeRetention([profile({ createdAt, lastLogin })], NOW);

    assert.equal(stats.retention.d1.retained, 1);
    assert.equal(stats.retention.d7.retained, 1);
    assert.equal(stats.retention.d14.retained, 0);
    assert.equal(stats.retention.d30.retained, 0);
  });

  test('does not count a one-session account as retained', () => {
    // Signed up, never came back: last login == signup.
    const createdAt = daysAgo(60);
    const stats = summarizeRetention([profile({ createdAt, lastLogin: createdAt })], NOW);

    for (const day of COHORT_DAYS) {
      const cohort = stats.retention[`d${day}`];
      assert.equal(cohort.eligible, 1, `d${day} eligible`);
      assert.equal(cohort.retained, 0, `d${day} retained`);
      assert.equal(cohort.rate, 0, `d${day} rate`);
    }
  });

  test('reports rate null when no account is eligible', () => {
    const stats = summarizeRetention(
      [profile({ createdAt: daysAgo(0), lastLogin: daysAgo(0) })],
      NOW
    );
    assert.equal(stats.retention.d30.eligible, 0);
    assert.equal(stats.retention.d30.rate, null);
  });

  test('computes the rate to four decimals', () => {
    const built = [];
    for (let i = 0; i < 3; i++) {
      built.push(profile({ createdAt: daysAgo(40), lastLogin: daysAgo(1) })); // retained
    }
    // Last login 1 day after signup: retained at d1, not at d7.
    built.push(profile({ createdAt: daysAgo(40), lastLogin: daysAgo(39) }));
    const stats = summarizeRetention(built, NOW);
    assert.equal(stats.retention.d7.eligible, 4);
    assert.equal(stats.retention.d7.retained, 3);
    assert.equal(stats.retention.d7.rate, 0.75);
  });

  test('skips profiles with no usable signup date instead of miscounting them', () => {
    const stats = summarizeRetention(
      [profile({ createdAt: 'not a date', lastLogin: daysAgo(0.5) }), profile({ createdAt: null })],
      NOW
    );
    assert.equal(stats.unknownSignup, 2);
    assert.equal(stats.retention.d1.eligible, 0);
    // Still counted in the roster and activity totals — only the cohort math
    // is unanswerable for them.
    assert.equal(stats.totalProfiles, 2);
    assert.equal(stats.active.dau, 1);
  });
});

describe('summarizeRetention — signups', () => {
  test('counts signups in nested trailing windows', () => {
    const stats = summarizeRetention(
      [
        profile({ createdAt: daysAgo(0) }),
        profile({ createdAt: daysAgo(4) }),
        profile({ createdAt: daysAgo(25) }),
        profile({ createdAt: daysAgo(90) }),
      ],
      NOW
    );
    assert.deepEqual(stats.signups, { last1: 1, last7: 2, last30: 3 });
  });
});

describe('summarizeRetention — streak distribution', () => {
  test('buckets streaks on the milestone boundaries', () => {
    const stats = summarizeRetention(
      [
        profile({ loginStreak: 0 }),
        profile({ loginStreak: 1 }),
        profile({ loginStreak: 3 }),
        profile({ loginStreak: 13 }),
        profile({ loginStreak: 14 }),
        profile({ loginStreak: 100 }),
        profile({ loginStreak: 365 }),
      ],
      NOW
    );

    assert.equal(stats.streaks['0'], 1);
    assert.equal(stats.streaks['1-2'], 1);
    assert.equal(stats.streaks['3-6'], 1);
    assert.equal(stats.streaks['7-13'], 1);
    assert.equal(stats.streaks['14-29'], 1);
    assert.equal(stats.streaks['100+'], 2);
    assert.equal(stats.longestStreak, 365);
  });

  test('reports every bucket even when empty, so the chart has a stable shape', () => {
    const stats = summarizeRetention([], NOW);
    for (const bucket of STREAK_BUCKETS) {
      assert.equal(stats.streaks[bucket.label], 0, `bucket ${bucket.label}`);
    }
  });

  test('treats a missing or nonsense streak as zero', () => {
    const stats = summarizeRetention(
      [
        { createdAt: daysAgo(1), engagement: {} },
        { createdAt: daysAgo(1) }, // no engagement map at all
        profile({ loginStreak: -5 }),
        profile({ loginStreak: Number.NaN }),
      ],
      NOW
    );
    assert.equal(stats.streaks['0'], 4);
    assert.equal(stats.longestStreak, 0);
  });
});

describe('summarizeRetention — timestamp shapes', () => {
  test('accepts Firestore Timestamps, Dates and ISO strings alike', () => {
    // Profiles carry all three: createUserProfile writes `new Date()`,
    // claimDailyLogin writes a server Timestamp, older/imported docs strings.
    const asTimestamp = (date) => ({ toDate: () => date });
    const stats = summarizeRetention(
      [
        profile({ createdAt: asTimestamp(daysAgo(40)), lastLogin: asTimestamp(daysAgo(0.5)) }),
        profile({ createdAt: daysAgo(40), lastLogin: daysAgo(0.5) }),
        profile({ createdAt: daysAgo(40).toISOString(), lastLogin: daysAgo(0.5).toISOString() }),
      ],
      NOW
    );

    assert.equal(stats.active.dau, 3);
    assert.equal(stats.retention.d30.eligible, 3);
    assert.equal(stats.retention.d30.retained, 3);
    assert.equal(stats.retention.d30.rate, 1);
    assert.equal(stats.unknownSignup, 0);
  });

  test('survives a Timestamp whose toDate throws', () => {
    const hostile = {
      toDate: () => {
        throw new Error('corrupt');
      },
    };
    const stats = summarizeRetention([profile({ createdAt: hostile, lastLogin: hostile })], NOW);
    assert.equal(stats.unknownSignup, 1);
    assert.equal(stats.neverLoggedIn, 1);
  });

  test('clamps a future timestamp rather than reporting negative days', () => {
    // Clock skew on a client-written createdAt would otherwise produce a
    // negative account age and silently drop the profile from every cohort.
    const stats = summarizeRetention(
      [profile({ createdAt: new Date(NOW.getTime() + 5 * DAY_MS), lastLogin: daysAgo(0) })],
      NOW
    );
    assert.equal(stats.active.dau, 1);
    assert.equal(stats.signups.last1, 1);
    assert.equal(stats.retention.d1.eligible, 0);
  });
});

describe('summarizeRetention — empty roster', () => {
  test('returns a well-formed zero payload', () => {
    const stats = summarizeRetention([], NOW);
    assert.equal(stats.totalProfiles, 0);
    assert.deepEqual(stats.active, { dau: 0, wau: 0, mau: 0 });
    assert.equal(stats.stickiness, null);
    assert.deepEqual(stats.signups, { last1: 0, last7: 0, last30: 0 });
    for (const day of COHORT_DAYS) {
      assert.deepEqual(stats.retention[`d${day}`], { eligible: 0, retained: 0, rate: null });
    }
  });
});
