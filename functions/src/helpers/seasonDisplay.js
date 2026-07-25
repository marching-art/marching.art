/**
 * Season names, formatted for humans.
 *
 * A season's `name` IS its `seasonUid` — the storage key doubles as the
 * display string (`live_2026-26`, `finale_2026-27`), which is fine in a
 * document path and wrong in a sentence. Anything that shows a season to a
 * person formats it here first.
 *
 * Two rules, both borrowed from the client:
 *   - Underscores become spaces and words capitalize: `finale_2026-27` ->
 *     "Finale 2026-27".
 *   - A LIVE season is stored with a two-year suffix to match the off-season
 *     scheme, but it never spans a new year, so it collapses to the single
 *     competition year: `live_2026-26` -> "LIVE 2026".
 *
 * MIRROR: this is the server-side twin of `formatSeasonName` in
 * `src/utils/season.ts`. The two must agree — a director should never see a
 * season called one thing in Discord and another in the app. Change both.
 *
 * Display-only: the stored name/seasonUid is never rewritten, so document
 * paths, leases and archives are untouched.
 */

/**
 * @param {string|null|undefined} name - Raw season name or seasonUid.
 * @returns {string} Display form; "New Season" when there is nothing to show.
 */
function formatSeasonName(name) {
  if (!name) return "New Season";

  const liveMatch = /^live_(\d{4})/i.exec(name);
  if (liveMatch) return `LIVE ${liveMatch[1]}`;

  return String(name)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The display name for a season doc, preferring `name` and falling back to
 * `seasonUid` (they are normally the same string).
 *
 * @param {{name?: string, seasonUid?: string}|null|undefined} seasonData
 * @returns {string}
 */
function seasonDisplayName(seasonData) {
  if (!seasonData) return formatSeasonName(null);
  return formatSeasonName(seasonData.name || seasonData.seasonUid);
}

module.exports = { formatSeasonName, seasonDisplayName };
