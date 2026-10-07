/**
 * League tags on director profiles.
 *
 * A director's leagues said nothing about them anywhere outside the Leagues
 * page: you could open a rival's profile and never learn they ran with the
 * same crew you did. A commissioner now sets a short bold tag for the league
 * ("DCFL", helpers/leagueIdentity.js), and every member wears it on their
 * profile header and on the ensembles the league pairs.
 *
 * Why a callable and not a client query: league docs are listable only by
 * their own members (or as public browse), so one director cannot list
 * another's leagues from the client — and should not, since a private league's
 * roster is private. The server does the lookup and returns only leagues whose
 * commissioner set a tag: setting one is the opt-in to being named on member
 * profiles, so an untagged private league is never revealed here.
 */

const { onCall } = require("firebase-functions/v2/https");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const { assertAuth, assertDocId } = require("../helpers/callableGuards");
const { leagueAbbreviation, leagueGameMode } = require("../helpers/leagueIdentity");

/** A director is in a handful of leagues; the bound matches the my-leagues query. */
const MAX_LEAGUES_SCANNED = 100;

/**
 * @typedef {Object} LeagueTagEntry
 * @property {string} leagueId
 * @property {string} name
 * @property {string} abbreviation
 * @property {"fantasy" | "podium" | "both"} gameMode
 * @property {boolean} isPublic
 * @property {boolean} isCommissioner - the director runs this league
 * @property {boolean} viewerIsMember - the viewer can open the league page
 */

/**
 * The tag entries for a director's leagues, oldest league first so a
 * director's chips don't reshuffle when they join a new one. Pure for tests.
 *
 * @param {Array<{id: string, data: Object}>} leagues
 * @param {string} directorUid
 * @param {string | null} viewerUid
 * @returns {LeagueTagEntry[]}
 */
function buildLeagueTagEntries(leagues, directorUid, viewerUid) {
  const createdMs = (league) => {
    const at = league.data.createdAt;
    if (at && typeof at.toMillis === "function") return at.toMillis();
    return typeof at === "number" ? at : Number.MAX_SAFE_INTEGER;
  };
  return leagues
    .filter(({ data }) => Array.isArray(data.members) && data.members.includes(directorUid))
    .map((league) => ({ league, abbreviation: leagueAbbreviation(league.data) }))
    .filter(({ abbreviation }) => abbreviation !== null)
    .sort((a, b) => createdMs(a.league) - createdMs(b.league) || a.league.id.localeCompare(b.league.id))
    .map(({ league: { id, data }, abbreviation }) => ({
      leagueId: id,
      name: typeof data.name === "string" ? data.name : "",
      abbreviation: /** @type {string} */ (abbreviation),
      gameMode: leagueGameMode(data),
      isPublic: data.isPublic !== false,
      isCommissioner:
        data.creatorId === directorUid ||
        (Array.isArray(data.commissioners) && data.commissioners.includes(directorUid)),
      viewerIsMember: !!viewerUid && data.members.includes(viewerUid),
    }));
}

/**
 * Every tagged league a director belongs to.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} directorUid
 * @param {string | null} [viewerUid]
 * @returns {Promise<LeagueTagEntry[]>}
 */
async function fetchDirectorLeagueTags(db, directorUid, viewerUid = null) {
  const snap = await db
    .collection(paths.leagues())
    .where("members", "array-contains", directorUid)
    .limit(MAX_LEAGUES_SCANNED)
    .get();
  return buildLeagueTagEntries(
    snap.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
    directorUid,
    viewerUid
  );
}

exports.getDirectorLeagueTags = onCall({ cors: true }, async (request) => {
  const viewerUid = assertAuth(request);
  const { uid } = request.data || {};
  const directorUid = uid === undefined ? viewerUid : uid;
  assertDocId(directorUid, "director ID");

  const tags = await fetchDirectorLeagueTags(getDb(), directorUid, viewerUid);
  return { tags };
});

module.exports.buildLeagueTagEntries = buildLeagueTagEntries;
module.exports.fetchDirectorLeagueTags = fetchDirectorLeagueTags;
