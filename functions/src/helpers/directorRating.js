/**
 * Director Rating (Phase 7.5, PODIUM_CLASS_DESIGN.md §7) — lifetime,
 * placements-only, cross-class.
 *
 * DCI-style placement points per archived season: 1st = 25, 2nd = 24, …
 * 25th = 1, summed over every corps and season on the profile's résumé
 * (corps.{class}.seasonHistory — the display copies every class archives,
 * Podium included). SoundSport is ratings-only and never contributes.
 *
 * Nothing else moves it: not XP, not CorpsCoin, not streaks, not account
 * age — placements are the only input, mirroring the corps-reputation
 * philosophy (§5.13) at the director level. Computed nightly by the
 * lifetime-leaderboard job; never persisted to profiles (it is always
 * derivable, so it can never go stale or be forged).
 */

const PLACEMENT_POINT_BASE = 26; // 1st place = 25 points, 25th = 1

/**
 * @param {object} profileData profile/data document
 * @returns {number} lifetime Director Rating (0 when no placed seasons)
 */
function computeDirectorRating(profileData) {
  let rating = 0;
  for (const [classKey, corps] of Object.entries((profileData && profileData.corps) || {})) {
    if (!corps || classKey === "soundSport") continue;
    for (const row of corps.seasonHistory || []) {
      const placement = row && row.placement;
      if (Number.isInteger(placement) && placement >= 1) {
        rating += Math.max(0, PLACEMENT_POINT_BASE - placement);
      }
    }
  }
  return rating;
}

module.exports = { computeDirectorRating, PLACEMENT_POINT_BASE };
