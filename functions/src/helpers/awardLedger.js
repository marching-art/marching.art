/**
 * Per-user award idempotency ledger for the nightly scoring pipeline.
 *
 * The pipeline pays CorpsCoin / XP / league W-L records via
 * `FieldValue.increment` inside a {@link ChunkedWriter}, whose chunks commit
 * sequentially and NON-atomically. A run that fails mid-commit is marked
 * "failed" and re-claimed on the next delivery (scoringRunGuard), so it re-runs
 * the whole day — re-applying every increment for the users whose writes landed
 * in the already-committed chunks. The coarse `scoring_runs` lease prevents
 * re-running a *completed* day, but not a torn one; that residual risk is what
 * this ledger closes.
 *
 * Mechanism: stamp a token into the profile's `awardLedger` array field IN THE
 * SAME write operation as the increment. Because the token and the increment
 * live in one document write, they land together or not at all — so the token's
 * presence is a faithful witness that the increment was applied. Before building
 * a batch the caller reads the target profiles and skips any uid whose ledger
 * already carries the token (unless an admin passes `force` to deliberately
 * re-apply after a data fix, preserving the documented force-reprocess escape
 * hatch).
 *
 * Tokens embed the seasonUid and are cleared at season rollover
 * (`archiveAndResetProfiles`), so the array stays bounded to roughly one token
 * per award per user per season.
 */
const admin = require("firebase-admin");

/** Profile field holding the array of applied-award tokens. */
const LEDGER_FIELD = "awardLedger";

/** Token for a day's show-participation coin+XP award (one per uid per day). */
const showAwardToken = (seasonUid, scoredDay) => `${seasonUid}:show:d${scoredDay}`;

/** Token for a week's participation-XP award (one per uid per week). */
const weeklyXpToken = (seasonUid, week) => `${seasonUid}:weeklyXp:w${week}`;

/**
 * Token for a weekly matchup win bonus. Keyed by (week, league, class) so a
 * director in multiple leagues is paid once PER winning matchup, not once per
 * week.
 */
const weeklyWinToken = (seasonUid, week, leagueId, corpsClass) =>
  `${seasonUid}:win:w${week}:${leagueId}:${corpsClass}`;

/**
 * Token for a director's W-L-T record increment in a weekly matchup. The
 * winner's coin bonus and W-L record are two SEPARATE document writes, so each
 * needs its own token; this one rides the record-increment write and is keyed
 * additionally by uid so both participants' record writes are independently
 * idempotent.
 */
const matchupRecordToken = (seasonUid, week, leagueId, corpsClass, uid) =>
  `${seasonUid}:rec:w${week}:${leagueId}:${corpsClass}:${uid}`;

/** True if this profile snapshot's data already carries the token. */
function hasAwardToken(profileData, token) {
  const ledger = profileData && profileData[LEDGER_FIELD];
  return Array.isArray(ledger) && ledger.includes(token);
}

/**
 * The field fragment to merge into the profile write that also carries the
 * increment. `arrayUnion` is itself idempotent, so re-adding a token is a
 * harmless no-op; the whole point is that it commits atomically WITH the
 * increment beside it.
 */
function awardTokenWrite(token) {
  return { [LEDGER_FIELD]: admin.firestore.FieldValue.arrayUnion(token) };
}

module.exports = {
  LEDGER_FIELD,
  showAwardToken,
  weeklyXpToken,
  weeklyWinToken,
  matchupRecordToken,
  hasAwardToken,
  awardTokenWrite,
};
