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
  userCorpsCoinHistory: (uid) => `artifacts/${ns()}/users/${uid}/corpsCoinHistory`,
  userNotifications: (uid) => `artifacts/${ns()}/users/${uid}/notifications`,
  userLeagueNotifications: (uid) => `artifacts/${ns()}/users/${uid}/notifications/leagues`,
  userEmailLog: (uid) => `artifacts/${ns()}/users/${uid}/email_log`,
  userComment: (uid, commentId) => `artifacts/${ns()}/users/${uid}/comments/${commentId}`,
  userPodiumState: (uid) => `artifacts/${ns()}/users/${uid}/podium/state`,
  userPodiumCareer: (uid) => `artifacts/${ns()}/users/${uid}/podium/career`,

  // --- Leaderboard ---
  lifetimeLeaderboard: (view) => `artifacts/${ns()}/leaderboard/lifetime_${view}`,
  // Precomputed current-season global rankings (uid -> {rank,totalScore}),
  // materialized by the nightly lifetime-leaderboard job so getUserRankings
  // reads one doc instead of scanning every profile per call.
  seasonRankings: () => `artifacts/${ns()}/leaderboard/season_rankings/data`,

  // --- Leagues ---
  leagues: () => `artifacts/${ns()}/leagues`,
  league: (leagueId) => `artifacts/${ns()}/leagues/${leagueId}`,
  leagueStandings: (leagueId) => `artifacts/${ns()}/leagues/${leagueId}/standings/current`,
  leagueActivity: (leagueId) => `artifacts/${ns()}/leagues/${leagueId}/activity`,
  leagueMatchups: (leagueId) => `artifacts/${ns()}/leagues/${leagueId}/matchups`,
  leagueMatchupWeek: (leagueId, week) =>
    `artifacts/${ns()}/leagues/${leagueId}/matchups/week-${week}`,
  leagueWeekRecap: (leagueId, week) => `artifacts/${ns()}/leagues/${leagueId}/recaps/week-${week}`,
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
