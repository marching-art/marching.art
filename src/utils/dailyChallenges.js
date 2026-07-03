// Daily challenge helpers, shared by the profile store.
// Extracted from the retired userStore so the challenge feature has one home.

/**
 * Get the "game day" string — resets at 2 AM Eastern (after nightly score
 * processing) so challenges roll over together with posted scores rather
 * than at local midnight.
 *
 * Uses Intl with the America/New_York zone (same approach as the backend
 * scoring scheduler) so DST is handled correctly and the result does not
 * depend on the viewer's local timezone. The previous hand-rolled offset
 * math had an inverted sign and rolled the day over ~10 hours late.
 */
export const getGameDay = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const v = {};
  for (const part of parts) v[part.type] = part.value;

  // Anchor the ET calendar date in UTC for safe day arithmetic
  const et = new Date(
    Date.UTC(
      parseInt(v.year, 10),
      parseInt(v.month, 10) - 1,
      parseInt(v.day, 10),
      parseInt(v.hour === '24' ? '0' : v.hour, 10)
    )
  );

  // Before 2 AM Eastern, the previous game day is still in progress
  if (et.getUTCHours() < 2) {
    et.setUTCDate(et.getUTCDate() - 1);
  }

  // Emit the same Date.toDateString() format the stored challenge buckets
  // have always used (e.g. "Wed Jan 14 2026")
  return new Date(et.getUTCFullYear(), et.getUTCMonth(), et.getUTCDate()).toDateString();
};

/**
 * The full pool of rotating challenges. Three are offered per game day.
 *
 * MUST STAY IN SYNC with the server catalog in
 * functions/src/helpers/dailyChallenges.js — the completeDailyChallenge
 * callable only awards XP for challenges in today's server-side rotation.
 * Both sides pin the same fixed-date expectations in their tests to catch
 * drift.
 */
export const CHALLENGE_POOL = [
  { id: 'check-lineup', label: 'Review your lineup', link: null, action: 'lineup', xp: 10 },
  { id: 'visit-scores', label: 'Check the leaderboard', link: '/scores', xp: 10 },
  { id: 'visit-schedule', label: 'View upcoming shows', link: '/schedule', xp: 10 },
  { id: 'visit-profile', label: 'Visit your profile', link: '/profile', xp: 5 },
  { id: 'read-news', label: 'Read the latest news', link: '/', xp: 5 },
  { id: 'visit-guide', label: 'Review game rules', link: '/guide', xp: 5 },
  { id: 'visit-hall', label: 'Visit Hall of Champions', link: '/hall-of-champions', xp: 5 },
];

export const CHALLENGES_PER_DAY = 3;

/**
 * 32-bit string hash (djb2-style, same as the server mirror).
 * @param {string} str
 * @returns {number}
 */
const hashString = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
};

/**
 * The three challenges offered on a given game day — deterministic from the
 * day string so this always matches the server's rotation without a round
 * trip.
 * @param {string} gameDay - Value from getGameDay()
 * @returns {Array<{id: string, label: string, link: string|null, action?: string, xp: number}>}
 */
export const getChallengesForGameDay = (gameDay) => {
  const seed = hashString(gameDay);
  return CHALLENGE_POOL.map((challenge) => ({
    challenge,
    order: hashString(`${seed}:${challenge.id}`) & 0x7fffffff,
  }))
    .sort((a, b) => a.order - b.order)
    .slice(0, CHALLENGES_PER_DAY)
    .map((entry) => entry.challenge);
};
