/**
 * Retention instrumentation — the operator-side counterpart to the client
 * funnel events, and the sibling of helpers/economyStats.js.
 *
 * Four retention features shipped last cycle (nightly Discord score-drop embed,
 * morning FCM push, lineup-deadline reminders, matchup-result pushes) and
 * nothing measured whether any of them worked. GA4 answers "what did users do"
 * but it is sampled, ad-blocked for a meaningful slice of traffic, and cannot
 * see the roster — it cannot answer "of the directors who signed up last week,
 * how many are still here", which is the only number that says whether the
 * retention work paid off.
 *
 * That question is answerable from data already on every profile:
 *   engagement.lastLogin   - stamped by claimDailyLogin (auto-claimed on load)
 *   engagement.loginStreak - consecutive-day streak
 *   createdAt              - signup date, written by createUserProfile
 *
 * Written nightly to admin-stats/retention (admin-only per firestore.rules) and
 * rendered in Admin > Jobs beside the mint-vs-sink panel.
 *
 * Cost note: one projected collection-group scan of profile docs per night,
 * three fields wide. That is the same shape as the lifetime-leaderboard job and
 * deliberately does NOT read subcollections — unlike economyStats, which must
 * query per-user coin history and is therefore weekly.
 */

const { logger } = require("firebase-functions/v2");
const { paths } = require("./paths");
const { processAllInPages } = require("./firestorePaging");

const STATS_DOC = "admin-stats/retention";

/** Fields the rollup needs. Keep in sync with the reads in bucketProfiles. */
const PROJECTED_FIELDS = ["createdAt", "engagement.lastLogin", "engagement.loginStreak"];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Cohort ages reported, in days since signup. D1/D7/D30 are the industry
 * shorthand; D14 is included because a 49-day season means the two-week mark is
 * where a director has lived through a full change window and a league matchup.
 */
const COHORT_DAYS = [1, 7, 14, 30];

/**
 * Streak buckets. The boundaries are the streak-milestone days in
 * xpCalculations.js (3/7/14/30/60/100), so the distribution lines up with the
 * rewards that are supposed to be driving it.
 */
const STREAK_BUCKETS = [
  { label: "0", min: 0, max: 0 },
  { label: "1-2", min: 1, max: 2 },
  { label: "3-6", min: 3, max: 6 },
  { label: "7-13", min: 7, max: 13 },
  { label: "14-29", min: 14, max: 29 },
  { label: "30-59", min: 30, max: 59 },
  { label: "60-99", min: 60, max: 99 },
  { label: "100+", min: 100, max: Infinity },
];

/**
 * Coerce a Firestore Timestamp, Date, or ISO string to a Date.
 * Profiles carry all three shapes: createUserProfile writes `new Date()`,
 * claimDailyLogin writes a server timestamp, and imported/older docs carry
 * strings. Returns null for anything unusable.
 */
function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/** Whole days between two instants, floored. Negative clamps to 0. */
function daysBetween(later, earlier) {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / DAY_MS));
}

function bucketForStreak(streak) {
  const value = Number.isFinite(streak) && streak > 0 ? Math.floor(streak) : 0;
  const bucket = STREAK_BUCKETS.find((b) => value >= b.min && value <= b.max);
  return bucket ? bucket.label : "0";
}

/**
 * A projected profile record. Every field is optional on purpose: these come
 * straight from `doc.data()`, older/imported docs predate the engagement map,
 * and the timestamp fields carry three different shapes (see toDate). The
 * reducer is written to tolerate all of it rather than trusting a schema.
 *
 * @typedef {Object} ProfileRecord
 * @property {*} [createdAt]
 * @property {{lastLogin?: *, loginStreak?: *}} [engagement]
 */

/**
 * Reduce projected profile records into the retention rollup.
 *
 * Pure: takes the records and a clock, returns the stats object. Kept separate
 * from the Firestore read so it is unit-testable without an emulator.
 *
 * @param {ProfileRecord[]} profiles
 * @param {Date} now
 * @returns {Object} the admin-stats/retention payload (minus computedAt)
 */
function summarizeRetention(profiles, now) {
  let totalProfiles = 0;
  let neverLoggedIn = 0;
  let unknownSignup = 0;

  const active = { dau: 0, wau: 0, mau: 0 };
  const signups = { last1: 0, last7: 0, last30: 0 };
  const streaks = {};
  for (const bucket of STREAK_BUCKETS) streaks[bucket.label] = 0;

  // Cohort retention: of the accounts old enough to have reached day N, how
  // many logged in on or after day N. "Old enough" is the crucial qualifier —
  // counting an account created yesterday against D30 would drag every number
  // toward zero as the game grows, which is the classic way this metric lies.
  const cohorts = {};
  for (const day of COHORT_DAYS) cohorts[day] = { eligible: 0, retained: 0 };

  let longestStreak = 0;

  for (const profile of profiles) {
    totalProfiles += 1;

    const createdAt = toDate(profile.createdAt);
    const lastLogin = toDate(profile.engagement?.lastLogin);
    const streak = Number(profile.engagement?.loginStreak) || 0;

    streaks[bucketForStreak(streak)] += 1;
    if (streak > longestStreak) longestStreak = streak;

    if (lastLogin) {
      const daysSinceLogin = daysBetween(now, lastLogin);
      if (daysSinceLogin < 1) active.dau += 1;
      if (daysSinceLogin < 7) active.wau += 1;
      if (daysSinceLogin < 30) active.mau += 1;
    } else {
      neverLoggedIn += 1;
    }

    if (!createdAt) {
      unknownSignup += 1;
      continue;
    }

    const accountAgeDays = daysBetween(now, createdAt);
    if (accountAgeDays < 1) signups.last1 += 1;
    if (accountAgeDays < 7) signups.last7 += 1;
    if (accountAgeDays < 30) signups.last30 += 1;

    // Retained at day N == logged in at least N days after signing up. Using
    // the login-to-signup gap rather than "logged in during window N" means a
    // director who was active on day 9 still counts for D7 — retention is a
    // "did they come back at all by then" measure, not an attendance record.
    const lifespanDays = lastLogin ? daysBetween(lastLogin, createdAt) : 0;
    for (const day of COHORT_DAYS) {
      if (accountAgeDays < day) continue; // not yet old enough to answer
      cohorts[day].eligible += 1;
      if (lifespanDays >= day) cohorts[day].retained += 1;
    }
  }

  const retention = {};
  for (const day of COHORT_DAYS) {
    const { eligible, retained } = cohorts[day];
    retention[`d${day}`] = {
      eligible,
      retained,
      // null rather than 0 when nothing is eligible: "no data" and "nobody came
      // back" must not render as the same number on the dashboard.
      rate: eligible > 0 ? Number((retained / eligible).toFixed(4)) : null,
    };
  }

  return {
    totalProfiles,
    active,
    // DAU/MAU — the standard stickiness ratio. Above ~0.2 is healthy for a
    // daily-loop game; this one aspires higher because the score drop is nightly.
    stickiness: active.mau > 0 ? Number((active.dau / active.mau).toFixed(4)) : null,
    signups,
    retention,
    streaks,
    longestStreak,
    neverLoggedIn,
    unknownSignup,
    cohortDays: COHORT_DAYS,
  };
}

/**
 * Read every profile (projected) and summarize.
 *
 * The users/{uid} parent docs are missing ancestors — createUserProfile only
 * writes the subcollection docs — so a collection query over users/ sees
 * nothing and this must go through a collectionGroup("profile") query, then
 * filter by path prefix to drop other data namespaces. Same approach as
 * scheduled/lifetimeLeaderboard.js; see the long comment there.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{now?: Date}} [options]
 */
async function computeRetentionStats(db, { now = new Date() } = {}) {
  const query = db.collectionGroup("profile").select(...PROJECTED_FIELDS);
  const docs = await processAllInPages(query, 1000, async (doc) => doc);

  const usersPrefix = `${paths.users()}/`;
  const profiles = docs
    .filter((doc) => doc.ref.path.startsWith(usersPrefix))
    .map((doc) => doc.data());

  return summarizeRetention(profiles, now);
}

/**
 * Compute and persist the doc the admin page reads.
 */
async function updateRetentionStats(db, options = {}) {
  const stats = await computeRetentionStats(db, options);
  await db.doc(STATS_DOC).set({ ...stats, computedAt: new Date() }, { merge: false });

  const d7 = stats.retention.d7;
  logger.info(
    `Retention stats: ${stats.totalProfiles} profiles, ` +
      `DAU ${stats.active.dau} / WAU ${stats.active.wau} / MAU ${stats.active.mau}, ` +
      `stickiness ${stats.stickiness ?? "n/a"}, ` +
      `D7 ${d7.retained}/${d7.eligible} (${d7.rate ?? "n/a"}).`
  );
  return stats;
}

module.exports = {
  STATS_DOC,
  COHORT_DAYS,
  STREAK_BUCKETS,
  PROJECTED_FIELDS,
  summarizeRetention,
  computeRetentionStats,
  updateRetentionStats,
};
