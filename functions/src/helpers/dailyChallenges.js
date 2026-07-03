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

/**
 * The full pool of rotating challenges. Three are offered per game day.
 * XP values are intentionally small next to dailyLogin (25 XP) so the
 * challenge loop supplements rather than replaces the streak loop.
 */
const CHALLENGE_POOL = [
  { id: "check-lineup", label: "Review your lineup", xp: 10 },
  { id: "visit-scores", label: "Check the leaderboard", xp: 10 },
  { id: "visit-schedule", label: "View upcoming shows", xp: 10 },
  { id: "visit-profile", label: "Visit your profile", xp: 5 },
  { id: "read-news", label: "Read the latest news", xp: 5 },
  { id: "visit-guide", label: "Review game rules", xp: 5 },
  { id: "visit-hall", label: "Visit Hall of Champions", xp: 5 },
];

const CHALLENGES_PER_DAY = 3;

/** Day-buckets of completion history kept on the profile document. */
const MAX_CHALLENGE_DAYS_KEPT = 30;

/**
 * Get the "game day" string — resets at 2 AM Eastern, together with the
 * nightly score processing. Port of the client getGameDay in
 * src/utils/dailyChallenges.js; both emit Date.toDateString() format
 * (e.g. "Wed Jan 14 2026").
 *
 * @param {Date} [now]
 * @returns {string}
 */
function getGameDay(now = new Date()) {
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

  // Before 2 AM Eastern, the previous game day is still in progress
  if (et.getUTCHours() < 2) {
    et.setUTCDate(et.getUTCDate() - 1);
  }

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
  getGameDay,
  getChallengesForGameDay,
  pruneOldChallenges,
};
