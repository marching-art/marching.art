/**
 * Firestore path builders — the single source of truth for document/collection
 * paths on the backend, mirroring the frontend's `paths` helper (src/api/client.ts).
 *
 * Before this module the literal `artifacts/${dataNamespaceParam.value()}/...`
 * template was hand-written in ~90 places across ~30 files. Every one was an
 * independent typo risk (a wrong segment silently reads or writes the wrong
 * document) and a namespace/schema change meant editing all of them. Build the
 * path here once; call it everywhere.
 *
 * Each builder returns a plain string, so call sites stay `db.doc(paths.x(id))`
 * / `db.collection(paths.y())` exactly as before.
 */

const { dataNamespaceParam } = require("../config");

const ns = () => dataNamespaceParam.value();

const paths = {
  // --- Users ---
  users: () => `artifacts/${ns()}/users`,
  user: (uid) => `artifacts/${ns()}/users/${uid}`,
  userProfile: (uid) => `artifacts/${ns()}/users/${uid}/profile/data`,
  userPrivate: (uid) => `artifacts/${ns()}/users/${uid}/private/data`,
  userCorps: (uid, corpsClass) => `artifacts/${ns()}/users/${uid}/corps/${corpsClass}`,
  // Per-season detail (full caption lineup + week-by-week show picks) split off
  // the profile's seasonHistory summary rows so the hot, listener-backed profile
  // doc stays small. detailId = seasonHistoryRecord.seasonDetailId(seasonId, class).
  userSeasonDetails: (uid) => `artifacts/${ns()}/users/${uid}/seasonDetail`,
  userSeasonDetail: (uid, detailId) => `artifacts/${ns()}/users/${uid}/seasonDetail/${detailId}`,
  userCorpsCoinHistory: (uid) => `artifacts/${ns()}/users/${uid}/corpsCoinHistory`,
  // Uniform Studio wardrobe: saved v2 designs, owner-read via the rules
  // catch-all, written only by the wardrobe callables.
  userWardrobe: (uid) => `artifacts/${ns()}/users/${uid}/wardrobe`,
  userWardrobeDesign: (uid, designId) => `artifacts/${ns()}/users/${uid}/wardrobe/${designId}`,
  userNotifications: (uid) => `artifacts/${ns()}/users/${uid}/notifications`,
  userLeagueNotifications: (uid) => `artifacts/${ns()}/users/${uid}/notifications/leagues`,
  userEmailLog: (uid) => `artifacts/${ns()}/users/${uid}/email_log`,
  userComment: (uid, commentId) => `artifacts/${ns()}/users/${uid}/comments/${commentId}`,
  userPodiumState: (uid) => `artifacts/${ns()}/users/${uid}/podium/state`,
  userPodiumCareer: (uid) => `artifacts/${ns()}/users/${uid}/podium/career`,
  // Private per-director fantasy caption ledger — the full 8-caption breakdown
  // of a director's own outings, one day-doc per scored day, owner-read only
  // (the public recap keeps fantasy classes at GE/VIS/MUS to prevent lineup
  // harvesting). Mirrors the fantasy_recaps season/day shape.
  userCaptionLedger: (uid, seasonUid) =>
    `artifacts/${ns()}/users/${uid}/captionLedger/${seasonUid}`,
  userCaptionLedgerDays: (uid, seasonUid) =>
    `artifacts/${ns()}/users/${uid}/captionLedger/${seasonUid}/days`,
  userCaptionLedgerDay: (uid, seasonUid, day) =>
    `artifacts/${ns()}/users/${uid}/captionLedger/${seasonUid}/days/${day}`,

  // --- Leaderboard ---
  lifetimeLeaderboard: (view) => `artifacts/${ns()}/leaderboard/lifetime_${view}`,
  // Precomputed current-season global rankings (uid -> {rank,totalScore}),
  // materialized by the nightly lifetime-leaderboard job so getUserRankings
  // reads one doc instead of scanning every profile per call.
  seasonRankings: () => `artifacts/${ns()}/leaderboard/season_rankings/data`,

  // --- Show registrations (materialized "who's attending" index) ---
  // One doc per (week, eventName, date) event; see helpers/showRegistrations.js.
  // Server-only: no firestore.rules match — read via the getShowRegistrations
  // callable, written by selectUserShows + the nightly rebuild.
  showRegistrationEvents: (seasonUid) => `artifacts/${ns()}/show_registrations/${seasonUid}/events`,
  showRegistrationEvent: (seasonUid, eventKey) =>
    `artifacts/${ns()}/show_registrations/${seasonUid}/events/${eventKey}`,

  // --- Leagues ---
  leagues: () => `artifacts/${ns()}/leagues`,
  league: (leagueId) => `artifacts/${ns()}/leagues/${leagueId}`,
  leagueStandings: (leagueId) => `artifacts/${ns()}/leagues/${leagueId}/standings/current`,
  leagueActivity: (leagueId) => `artifacts/${ns()}/leagues/${leagueId}/activity`,
  leagueMatchups: (leagueId) => `artifacts/${ns()}/leagues/${leagueId}/matchups`,
  /**
   * Where a season's matchups go when it ends. Live `matchups/week-N` documents
   * are MOVED here at rollover — they used to be left in place, which meant the
   * generator saw week 1 already existed and skipped it, so a league that
   * completed one season never got matchups again (see resetLeaguesForNewSeason).
   */
  leagueMatchupHistory: (leagueId) =>
    `artifacts/${ns()}/leagues/${leagueId}/matchupHistory`,
  leagueMatchupHistoryWeek: (leagueId, seasonUid, week) =>
    `artifacts/${ns()}/leagues/${leagueId}/matchupHistory/${seasonUid}_week-${week}`,
  leagueMatchupWeek: (leagueId, week) =>
    `artifacts/${ns()}/leagues/${leagueId}/matchups/week-${week}`,
  leagueWeekRecap: (leagueId, week) => `artifacts/${ns()}/leagues/${leagueId}/recaps/week-${week}`,
  /** Finished seasons' weekly recaps — same rollover treatment as matchups. */
  leagueRecapHistoryWeek: (leagueId, seasonUid, week) =>
    `artifacts/${ns()}/leagues/${leagueId}/recapHistory/${seasonUid}_week-${week}`,
  leagueMeta: (leagueId, docId) => `artifacts/${ns()}/leagues/${leagueId}/meta/${docId}`,

  // --- League invitations ---
  leagueInvitations: () => `artifacts/${ns()}/leagueInvitations`,
  leagueInvitation: (invitationId) => `artifacts/${ns()}/leagueInvitations/${invitationId}`,

  // --- Buy Me a Coffee supporters ---
  // Keyed by SHA-256 of the payer email (never the raw email). Server-only:
  // holds PII (email, payer name), so the collection is locked in
  // firestore.rules and the public wall is served via the getSupportersWall
  // callable.
  supporters: () => `artifacts/${ns()}/supporters`,
  supporter: (emailHash) => `artifacts/${ns()}/supporters/${emailHash}`,
};

module.exports = { paths };
