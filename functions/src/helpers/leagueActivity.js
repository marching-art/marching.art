/**
 * Season-scoped league activity.
 *
 * A league's roster (`members`) is permanent, but participation is not: season
 * rollover deliberately PRESERVES `corps.{class}.corpsName` across seasons
 * (helpers/season.js) so directors keep their corps identity, while resetting
 * the season-specific fields. That means "this profile has a corps named X" is
 * NOT evidence the director is playing the current season — it only proves they
 * played at some point.
 *
 * The season-scoped marker is `activeSeasonId`. It is set when a director
 * registers a corps (callable/registerCorps.js), saves a lineup
 * (callable/lineups.js), or works through the new-season setup wizard
 * (callable/corps.js), and rollover deliberately does NOT advance it — a
 * returning director's profile sits at the OLD season id until they come back
 * and set their corps up. So `activeSeasonId === currentSeasonUid` is exactly
 * "has been here since the season reset", and pairing it with "still holds a
 * named corps" gives the participation test the league system needs:
 *
 *     registered for the current season
 *       = activeSeasonId matches the live season
 *       AND at least one corps survived their setup decisions
 *
 * The second clause matters because the setup wizard lets a director retire
 * everything; acknowledging the season without fielding a corps is not
 * participation.
 *
 * The materialized `seasonActivity` block this module builds is what league
 * discovery filters on and what the matchup generators pair from, so a league
 * whose members have not come back yet reads as empty until they do.
 */

const { logger } = require("firebase-functions/v2");
const { paths } = require("./paths");

/** Does this corps carry an identity (i.e. was it registered / continued)? */
function hasNamedCorps(corps) {
  return Boolean(corps && corps.corpsName);
}

/**
 * Is this director registered for `seasonUid`?
 *
 * @param {object|undefined} profileData - the user's profile document data
 * @param {string} seasonUid - the LIVE season uid (game-settings/season)
 * @returns {boolean}
 */
function isActiveThisSeason(profileData, seasonUid) {
  if (!profileData || !seasonUid) return false;
  if (profileData.activeSeasonId !== seasonUid) return false;
  return Object.values(profileData.corps || {}).some(hasNamedCorps);
}

/**
 * Is this director fielding a corps in `corpsClass` this season?
 *
 * The per-class form the matchup generators need: a director active in World
 * Class must not be paired into the Open Class bracket, and — the bug this
 * replaces — a director whose corpsName merely survived rollover must not be
 * paired at all.
 *
 * @param {object|undefined} profileData - the user's profile document data
 * @param {string} corpsClass - canonical class id
 * @param {string} seasonUid - the LIVE season uid
 * @returns {boolean}
 */
function isClassActiveThisSeason(profileData, corpsClass, seasonUid) {
  if (!profileData || !seasonUid) return false;
  if (profileData.activeSeasonId !== seasonUid) return false;
  return hasNamedCorps((profileData.corps || {})[corpsClass]);
}

/**
 * Build the `seasonActivity` block from a roster and its profile documents.
 *
 * Pure (no reads/writes) so both the incremental writers and the nightly
 * refresh agree on one definition.
 *
 * `memberUids` and `profileDocs` must be index-aligned — pass the array handed
 * to `db.getAll(...)` and the snapshots it returned.
 *
 * @param {string[]} memberUids
 * @param {Array<{exists: boolean, data: function}>} profileDocs
 * @param {string} seasonUid
 * @returns {{seasonUid: string, activeMembers: string[], activeMemberCount: number,
 *   totalMemberCount: number, updatedAt: Date}}
 */
function computeSeasonActivity(memberUids, profileDocs, seasonUid) {
  const activeMembers = [];
  memberUids.forEach((uid, index) => {
    const doc = profileDocs[index];
    if (doc && doc.exists && isActiveThisSeason(doc.data(), seasonUid)) {
      activeMembers.push(uid);
    }
  });

  return {
    seasonUid,
    activeMembers,
    activeMemberCount: activeMembers.length,
    totalMemberCount: memberUids.length,
    updatedAt: new Date(),
  };
}

/**
 * The block a league carries when nobody has come back yet.
 *
 * Written at season rollover so a league goes dark the instant the season
 * resets, rather than advertising last season's roster until the nightly
 * refresh catches up.
 *
 * @param {string} seasonUid - the NEW season uid
 * @param {number} totalMemberCount
 */
function emptySeasonActivity(seasonUid, totalMemberCount = 0) {
  return {
    seasonUid,
    activeMembers: [],
    activeMemberCount: 0,
    totalMemberCount,
    updatedAt: new Date(),
  };
}

/** Read the live season uid, or null when no season document exists. */
async function getActiveSeasonUid(db) {
  const seasonDoc = await db.doc("game-settings/season").get();
  return seasonDoc.exists ? seasonDoc.data().seasonUid || null : null;
}

/**
 * Recompute and persist one league's `seasonActivity`.
 *
 * Called after any roster change (join / leave / commissioner removal) and by
 * the nightly refresh. Costs one read per member (≤ maxMembers, capped at 50),
 * which is why it is safe to run inline on these comparatively rare writes
 * instead of trying to patch the block incrementally — an incremental update
 * cannot tell an active member from a stale one without reading their profile
 * anyway.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} leagueId
 * @param {string} [seasonUid] - live season uid; read from game-settings when omitted
 * @returns {Promise<object|null>} the written block, or null if there was nothing to write
 */
async function refreshLeagueActivity(db, leagueId, seasonUid = null) {
  const activeSeasonUid = seasonUid || (await getActiveSeasonUid(db));
  if (!activeSeasonUid) return null;

  const leagueRef = db.doc(paths.league(leagueId));
  const leagueDoc = await leagueRef.get();
  if (!leagueDoc.exists) return null;

  const members = leagueDoc.data().members || [];
  const profileDocs = members.length
    ? await db.getAll(...members.map((uid) => db.doc(paths.userProfile(uid))))
    : [];

  const seasonActivity = computeSeasonActivity(members, profileDocs, activeSeasonUid);
  await leagueRef.update({ seasonActivity });
  return seasonActivity;
}

/**
 * Refresh every league this director belongs to.
 *
 * Called right after a director registers a corps or works through the
 * new-season setup wizard — the moment their leagues should stop reading as
 * empty. Best-effort: league visibility must never be able to fail a corps
 * registration, so failures are swallowed and the nightly refresh
 * (scheduled/leagueAutomation.js) picks up whatever this missed.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid
 * @param {string} [seasonUid]
 * @returns {Promise<number>} how many leagues were refreshed
 */
async function refreshLeaguesForUser(db, uid, seasonUid = null) {
  try {
    const activeSeasonUid = seasonUid || (await getActiveSeasonUid(db));
    if (!activeSeasonUid) return 0;

    const profileDoc = await db.doc(paths.userProfile(uid)).get();
    const leagueIds = profileDoc.exists ? profileDoc.data().leagueIds || [] : [];
    if (leagueIds.length === 0) return 0;

    await Promise.all(
      leagueIds.map((leagueId) => refreshLeagueActivity(db, leagueId, activeSeasonUid))
    );
    return leagueIds.length;
  } catch (error) {
    // Swallowed deliberately — see the note above.
    logger.warn(`Could not refresh league activity for ${uid}: ${error.message}`);
    return 0;
  }
}

module.exports = {
  hasNamedCorps,
  isActiveThisSeason,
  isClassActiveThisSeason,
  computeSeasonActivity,
  emptySeasonActivity,
  getActiveSeasonUid,
  refreshLeagueActivity,
  refreshLeaguesForUser,
};
