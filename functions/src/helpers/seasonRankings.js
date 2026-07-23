// @ts-nocheck -- grandfathered when functions checkJs landed (functions/tsconfig.json); remove when this file is typed or cleaned up
// Pure helpers for the current-season global ranking snapshot.
//
// getUserRankings used to scan every active-season profile on EVERY call to
// compute one caller's rank — O(players) billed reads per dashboard load. The
// nightly lifetime-leaderboard job already scans all profiles, so it now also
// materializes these rankings into a single doc (paths.seasonRankings()) and
// getUserRankings reads that one doc. The score/sort/rank math lives here so it
// stays identical to the old inline computation and is unit-testable.

/**
 * Sum a profile's current-season score across all corps classes.
 *
 * Mirrors the historical getUserRankings computation exactly, including the
 * legacy fallback: a profile with a top-level corpsName but no worldClass corps
 * is treated as having a worldClass corps scored at its top-level
 * totalSeasonScore.
 *
 * @param {object} profileData - Raw profile document data.
 * @returns {number} Total season score.
 */
function sumSeasonScore(profileData) {
  const userCorps = { ...(profileData.corps || {}) };
  if (profileData.corpsName && !userCorps.worldClass) {
    userCorps.worldClass = { totalSeasonScore: profileData.totalSeasonScore || 0 };
  }
  return Object.values(userCorps).reduce(
    (sum, corps) => sum + ((corps && corps.totalSeasonScore) || 0),
    0
  );
}

/**
 * Build the ranking snapshot from a list of {uid, totalScore} entries.
 *
 * Rank is 1-based and tie-aware in the same way the old code was: all players
 * sharing a score receive the rank of the first player with that score
 * (findIndex semantics), so ties share a rank rather than being ordered
 * arbitrarily.
 *
 * @param {Array<{uid: string, totalScore: number}>} entries
 * @returns {{ ranks: Record<string, {rank: number, totalScore: number}>, totalPlayers: number }}
 */
function computeSeasonRankings(entries) {
  const sortedScores = entries.map((e) => e.totalScore).sort((a, b) => b - a);

  // Map each distinct score to the 1-based position of its FIRST occurrence in
  // the descending order, so tied scores share a rank. Building this once keeps
  // the whole pass O(n log n) instead of an O(n²) findIndex per player, while
  // producing exactly the rank the old inline `findIndex(...) + 1` did.
  const scoreToRank = new Map();
  sortedScores.forEach((score, index) => {
    if (!scoreToRank.has(score)) {
      scoreToRank.set(score, index + 1);
    }
  });

  const ranks = {};
  for (const { uid, totalScore } of entries) {
    ranks[uid] = { rank: scoreToRank.get(totalScore), totalScore };
  }
  return { ranks, totalPlayers: entries.length };
}

module.exports = { sumSeasonScore, computeSeasonRankings };
