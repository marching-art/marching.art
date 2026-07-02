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
 * Prune old challenge entries to prevent unbounded document growth.
 * Keeps only the most recent 30 day-buckets.
 *
 * @param {Object} challenges - Current challenges object keyed by date string
 * @returns {Object} - Pruned challenges object
 */
export const pruneOldChallenges = (challenges) => {
  if (!challenges || typeof challenges !== 'object') return challenges;

  const entries = Object.entries(challenges);
  if (entries.length <= 30) return challenges;

  // Date-string keys sort chronologically once parsed
  const sorted = entries.sort(
    ([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime()
  );
  return Object.fromEntries(sorted.slice(-30));
};

/**
 * Challenges that can be created on-the-fly when a page marks them complete
 * before the day's challenge list was seeded.
 */
export const CHALLENGE_DEFINITIONS = {
  check_leaderboard: {
    id: 'check_leaderboard',
    title: 'Scout the Competition',
    description: 'Visit the leaderboard page',
    progress: 1,
    target: 1,
    reward: '25 XP',
    icon: 'trophy',
    completed: true,
  },
  maintain_equipment: {
    id: 'maintain_equipment',
    title: 'Equipment Care',
    description: 'Check your equipment status',
    progress: 1,
    target: 1,
    reward: '30 XP',
    icon: 'wrench',
    completed: true,
  },
};
