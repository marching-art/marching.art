/**
 * Shared eligibility checks for retire/transfer/unretire flows.
 *
 * A corps may be retired, transferred, or replaced via unretire as long as it
 * has not competed yet this season — i.e. it has no `totalSeasonScore` and no
 * entries in `weeklyScores`. Lineups and selected shows do not block the
 * action, but calling code is expected to surface a warning that those
 * selections will be wiped.
 *
 * Keep this file in sync with src/utils/corps.ts (hasCorpsCompeted, etc).
 */

function hasCorpsCompeted(corps) {
  if (!corps) return false;
  if ((corps.totalSeasonScore || 0) > 0) return true;
  const weekly = corps.weeklyScores;
  if (weekly && typeof weekly === 'object' && Object.keys(weekly).length > 0) {
    return true;
  }
  return false;
}

function canEditCorpsThisSeason(corps) {
  return !hasCorpsCompeted(corps);
}

module.exports = {
  hasCorpsCompeted,
  canEditCorpsThisSeason,
};
