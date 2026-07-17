/**
 * Daily Challenges Helper
 *
 * Server-authoritative catalog and rotation for the dashboard's daily
 * challenges. The completeDailyChallenge callable validates against this
 * catalog so XP can only be earned for challenges actually offered today.
 *
 * MUST STAY IN SYNC with the client mirror in src/utils/dailyChallenges.js
 * (CHALLENGE_POOL and getChallengesForGameDay) — both sides pin the same
 * fixed-date expectations in their tests to catch drift.
 */

const { resetShiftHours } = require("./gameDay");

/**
 * The full pool of rotating challenges. Three are offered per game day.
 * XP values are intentionally small next to dailyLogin (25 XP) so the
 * challenge loop supplements rather than replaces the streak loop.
 *
 * Every challenge is a DECISION with a server-verifiable outcome — the
 * `verify(profileData, gameDay)` predicate is enforced by
 * completeDailyChallenge, so a challenge can only be claimed when the thing
 * was actually done. (The previous pool was six "visit page X" rows that
 * auto-completed on navigation — clicks, not choices; retired per
 * GAMIFICATION.md.)
 */
const CHALLENGE_POOL = [
  {
    id: "check-lineup",
    label: "Review your lineup",
    xp: 10,
    // Reviewing a lineup requires having one.
    verify: (profile) =>
      Object.values(profile.corps || {}).some(
        (c) => c && c.lineup && Object.keys(c.lineup).length > 0
      ),
  },
  {
    id: "make-prediction",
    label: "Make today's prediction",
    xp: 10,
    verify: (profile, gameDay) =>
      Object.keys(profile.predictions?.[gameDay]?.picks || {}).length > 0,
  },
  {
    id: "register-show",
    label: "Register for a show",
    xp: 10,
    verify: (profile) =>
      Object.values(profile.corps || {}).some(
        (c) => c && Object.keys(c.selectedShows || {}).length > 0
      ),
  },
  {
    id: "set-show-concept",
    label: "Set your show concept",
    xp: 10,
    verify: (profile) =>
      Object.values(profile.corps || {}).some((c) => c && c.showConcept?.theme),
  },
];

const CHALLENGES_PER_DAY = 3;

/**
 * Weekly arc: complete the full daily challenge set on
 * WEEKLY_LOOP_TARGET_DAYS distinct game days within one ET week (Mon-Sun)
 * to earn a bonus. State lives at profile.engagement.weeklyLoop
 * { weekKey, countedDays: [gameDay...], rewarded } — countedDays makes the
 * per-day increment idempotent; rewarded makes the payout idempotent.
 */
const WEEKLY_LOOP_TARGET_DAYS = 5;
const WEEKLY_LOOP_BONUS = { xp: 100, coin: 100 };

/**
 * ET-week identifier (the Monday of the week the game day belongs to, in the
 * same toDateString format as game days). Game-day strings parse cleanly
 * back into local-midnight Dates, and week grouping only needs calendar
 * arithmetic on them.
 *
 * @param {string} gameDay - Value from getGameDay()
 * @returns {string}
 */
function getWeekKey(gameDay) {
  const d = new Date(gameDay);
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday);
  return d.toDateString();
}

/**
 * Advance the weekly-arc state for a game day. Pure state machine so the
 * transaction in completeDailyChallenge stays thin and this stays testable:
 * a day is counted once (countedDays dedupes), a stale week resets, and the
 * bonus pays exactly once per week (`rewarded`).
 *
 * @param {{weekKey?: string, countedDays?: string[], rewarded?: boolean}|undefined} prevLoop
 *   - profile.engagement.weeklyLoop
 * @param {string} gameDay - Value from getGameDay()
 * @param {boolean} setComplete - Whether today's full challenge set is now done
 * @returns {{weeklyLoop: Object, bonus: {xp:number, coin:number}|null}}
 */
function advanceWeeklyLoop(prevLoop, gameDay, setComplete) {
  const weekKey = getWeekKey(gameDay);
  const loop =
    prevLoop?.weekKey === weekKey
      ? { weekKey, countedDays: prevLoop.countedDays || [], rewarded: !!prevLoop.rewarded }
      : { weekKey, countedDays: [], rewarded: false };

  if (!setComplete || loop.countedDays.includes(gameDay)) {
    return { weeklyLoop: loop, bonus: null };
  }

  const countedDays = [...loop.countedDays, gameDay];
  const earnedBonus = countedDays.length >= WEEKLY_LOOP_TARGET_DAYS && !loop.rewarded;
  return {
    weeklyLoop: { weekKey, countedDays, rewarded: loop.rewarded || earnedBonus },
    bonus: earnedBonus ? WEEKLY_LOOP_BONUS : null,
  };
}

/** Day-buckets of completion history kept on the profile document. */
const MAX_CHALLENGE_DAYS_KEPT = 30;

/**
 * Get the "game day" string — the ACTIVE game day, rolling together with the
 * nightly score processing (helpers/gameDay.js boundary): 2 AM ET in live
 * season, 9 PM ET in the off-season (the prime-time score drop — a fresh
 * challenge/prediction day opens the moment the reveal lands). Port of the
 * client getGameDay in src/utils/dailyChallenges.js; both emit
 * Date.toDateString() format (e.g. "Wed Jan 14 2026").
 *
 * @param {Date} [now]
 * @param {string} [seasonStatus] - game-settings/season `status`; anything
 *   other than "off-season" uses the live 2 AM ET boundary.
 * @returns {string}
 */
function getGameDay(now = new Date(), seasonStatus = undefined) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const v = {};
  for (const part of parts) v[part.type] = part.value;

  const et = new Date(
    Date.UTC(
      parseInt(v.year, 10),
      parseInt(v.month, 10) - 1,
      parseInt(v.day, 10),
      parseInt(v.hour === "24" ? "0" : v.hour, 10)
    )
  );

  // The active game day's calendar date is the ET wall clock shifted by the
  // season's reset offset (gameDay.resetShiftHours): back 2h live (before
  // 2 AM the previous day is still in progress), forward 3h off-season
  // (at/after 9 PM the NEXT day has begun — scores just dropped).
  et.setUTCHours(et.getUTCHours() - resetShiftHours(seasonStatus));

  return new Date(et.getUTCFullYear(), et.getUTCMonth(), et.getUTCDate()).toDateString();
}

/**
 * 32-bit string hash (djb2-style, same as the client mirror).
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * The three challenges offered on a given game day, deterministic from the
 * day string so client and server always agree without a round trip.
 * @param {string} gameDay - Value from getGameDay()
 * @returns {Array<{id: string, label: string, xp: number}>}
 */
function getChallengesForGameDay(gameDay) {
  const seed = hashString(gameDay);
  return CHALLENGE_POOL.map((challenge) => ({
    challenge,
    order: hashString(`${seed}:${challenge.id}`) & 0x7fffffff,
  }))
    .sort((a, b) => a.order - b.order)
    .slice(0, CHALLENGES_PER_DAY)
    .map((entry) => entry.challenge);
}

/**
 * Prune old day-buckets so the profile document doesn't grow unbounded.
 * Keeps the most recent MAX_CHALLENGE_DAYS_KEPT buckets.
 * @param {Object} challenges - Map keyed by game-day string
 * @returns {Object}
 */
function pruneOldChallenges(challenges) {
  if (!challenges || typeof challenges !== "object") return challenges;

  const entries = Object.entries(challenges);
  if (entries.length <= MAX_CHALLENGE_DAYS_KEPT) return challenges;

  const sorted = entries.sort(
    ([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime()
  );
  return Object.fromEntries(sorted.slice(-MAX_CHALLENGE_DAYS_KEPT));
}

module.exports = {
  CHALLENGE_POOL,
  CHALLENGES_PER_DAY,
  MAX_CHALLENGE_DAYS_KEPT,
  WEEKLY_LOOP_TARGET_DAYS,
  WEEKLY_LOOP_BONUS,
  getGameDay,
  getWeekKey,
  advanceWeeklyLoop,
  getChallengesForGameDay,
  pruneOldChallenges,
};
