// Client mirrors of server economy constants that the UI quotes to directors.
//
// Each value is a mirror, not a source of truth: the server modules they come
// from pull in firebase-admin, so a vitest test cannot import them directly.
// economyMirrors.test.ts pins every mirror here (and the league ones in
// utils/leagueEconomy.ts) by reading the server source text instead, so a
// server-side balance change fails CI until the copy the director sees is
// updated too.

/**
 * CorpsCoin a brand-new director starts with — quoted by onboarding.
 * Mirrors NEW_DIRECTOR_CORPSCOIN in functions/src/helpers/economy.js.
 */
export const NEW_DIRECTOR_CORPSCOIN = 1000;
