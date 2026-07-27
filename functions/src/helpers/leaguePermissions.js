/**
 * Who can run a league.
 *
 * Every commissioner gate in the backend used to be a bare
 * `leagueData.creatorId === uid`, which made a league a single point of
 * failure: one person, who cannot be away, cannot share the work, and whose
 * departure used to orphan the league outright. A league that runs for several
 * seasons needs more than one pair of hands.
 *
 * There are two tiers, and the distinction matters:
 *
 *  - the OWNER (`creatorId`) — one director. Only the owner can hand the league
 *    over or change who the co-commissioners are. Letting a co-commissioner do
 *    either would let them lock the owner out of their own league.
 *  - COMMISSIONERS (`creatorId` plus `commissioners[]`) — everything else:
 *    settings, matchup generation, invitations, roster, chat moderation.
 *
 * Admins pass every check, as they do everywhere else.
 */

/** Extra commissioners beyond the owner. A league is fine with none. */
const MAX_CO_COMMISSIONERS = 4;

/** Is this director the league's owner? */
function isLeagueOwner(leagueData, uid) {
  return Boolean(uid) && leagueData?.creatorId === uid;
}

/** Can this director run the league day to day? */
function isLeagueCommissioner(leagueData, uid) {
  if (!uid || !leagueData) return false;
  if (leagueData.creatorId === uid) return true;
  return Array.isArray(leagueData.commissioners) && leagueData.commissioners.includes(uid);
}

/** Everyone with commissioner powers, owner first, de-duplicated. */
function listCommissioners(leagueData) {
  const owner = leagueData?.creatorId;
  const extras = Array.isArray(leagueData?.commissioners) ? leagueData.commissioners : [];
  return [...new Set([owner, ...extras].filter(Boolean))];
}

/**
 * Who should inherit a league whose owner is leaving.
 *
 * A co-commissioner first — they already do the job and the members already
 * know it. Otherwise any remaining member, so the league never ends up with
 * nobody able to run it.
 *
 * @param {object} leagueData
 * @param {string} departingUid
 * @returns {string|null}
 */
function pickSuccessor(leagueData, departingUid) {
  const members = Array.isArray(leagueData?.members) ? leagueData.members : [];
  const remaining = members.filter((uid) => uid !== departingUid);
  if (remaining.length === 0) return null;

  const coCommissioners = Array.isArray(leagueData?.commissioners)
    ? leagueData.commissioners
    : [];
  const promotableCo = remaining.find((uid) => coCommissioners.includes(uid));
  return promotableCo || remaining[0];
}

module.exports = {
  MAX_CO_COMMISSIONERS,
  isLeagueOwner,
  isLeagueCommissioner,
  listCommissioners,
  pickSuccessor,
};
