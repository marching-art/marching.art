// Daily challenge helpers, shared by the profile store.
// Extracted from the retired userStore so the challenge feature has one home.

/**
 * Get the "game day" string — resets at 2 AM Eastern (after nightly score
 * processing) so challenges roll over together with posted scores rather
 * than at local midnight.
 */
export const getGameDay = () => {
  const now = new Date();

  // Convert to EST (UTC-5) or EDT (UTC-4)
  const estOffset = -5 * 60; // EST is UTC-5
  const edtOffset = -4 * 60; // EDT is UTC-4

  // Determine if we're in EDT (roughly March-November)
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  const isDST = now.getTimezoneOffset() < Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());

  const offset = isDST ? edtOffset : estOffset;
  const localOffset = now.getTimezoneOffset();
  const estTime = new Date(now.getTime() + (localOffset - offset) * 60 * 1000);

  // If before 2 AM EST, use previous day
  if (estTime.getHours() < 2) {
    estTime.setDate(estTime.getDate() - 1);
  }

  return estTime.toDateString();
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
