// League CorpsCoin constants, mirrored from the server so the UI and the game
// guide quote the same numbers the game actually pays.
//
// Each value below is a mirror, not a source of truth. The server files these
// come from all pull in firebase-admin or firebase-functions, so a vitest
// mirror-equality test cannot import them the way progressionGuide.test.js
// imports the (dependency-free) XP helpers — the comment on each constant is
// the link to keep them honest.
//
// Caption Wars' season cost is the exception and lives in utils/captionWars.ts
// beside the rest of that format, where it IS pinned by a mirror test.

/**
 * Paid to the winner of a weekly league matchup, per class, on top of
 * XP_SOURCES.leagueWin. Byes and ties pay nothing.
 *
 * Mirrors WEEKLY_LEAGUE_WIN_REWARD in functions/src/helpers/economy.js.
 */
export const LEAGUE_WEEKLY_WIN_CC = 100;

/**
 * Fixed buy-in per member per day for a league's prediction pool. Entrants who
 * post a perfect prediction day split the pot; if nobody does, it carries into
 * the league's next pool.
 *
 * Mirrors POOL_ANTE in functions/src/helpers/leaguePools.js.
 */
export const LEAGUE_POOL_ANTE_CC = 25;

/**
 * How many regular-season seeds qualify for a league's Finals when the league
 * carries no `settings.finalsSize` of its own.
 *
 * Mirrors DEFAULT_FINALS_SIZE in functions/src/helpers/leagueChampion.js.
 */
export const DEFAULT_FINALS_SIZE = 12;
