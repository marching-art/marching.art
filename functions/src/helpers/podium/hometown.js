/**
 * Podium hometown rules (design §5.3) — the structured official home and the
 * one-time free correction for corps whose home was picked under the old rule.
 *
 * Until the hometown place index shipped (scripts/buildPlaceIndex.js), a corps'
 * official home had to be one of the ~500 historical show cities, so many
 * directors registered with a home they didn't want. Every home chosen since
 * carries `anyTown: true`; a home WITHOUT it (or a legacy corps with no
 * structured home at all) was forced, and its director gets:
 *
 *   - one free mid-season correction (`correctPodiumHometown`), and
 *   - a free move at the next season's registration if they never corrected it
 *     (the usual 1 CC / 2 mi relocation fee is waived — they never chose it).
 *
 * Pure; no Firestore.
 */

/**
 * The structured home stored on state: the resolved venue's identity and
 * coordinates, stamped as chosen from the any-town picker.
 * @param {{venueId: string, city: string, region: string, lat: number, lng: number}} venue
 * @returns {{venueId: string, city: string, region: string, lat: number, lng: number, anyTown: true}}
 */
function homeRecordFor(venue) {
  return {
    venueId: venue.venueId,
    city: venue.city,
    region: venue.region,
    lat: venue.lat,
    lng: venue.lng,
    anyTown: true,
  };
}

/**
 * Was this state's home forced by the old show-city-only rule (and never
 * corrected since)? True for a structured home without `anyTown`, and for a
 * legacy corps with only free text — false once corrected or re-chosen.
 * @param {object|null|undefined} state a podium state doc
 * @returns {boolean}
 */
function homeWasForced(state) {
  if (!state || state.homeCorrectedAt) return false;
  return !(state.home && state.home.anyTown);
}

/**
 * Whether a director may use the free hometown correction on this state now.
 * @param {object|null|undefined} state the corps' current-season podium state
 * @param {string} seasonUid the active season
 * @returns {boolean}
 */
function canCorrectHome(state, seasonUid) {
  return Boolean(state && state.seasonUid === seasonUid && homeWasForced(state));
}

module.exports = { homeRecordFor, homeWasForced, canCorrectHome };
