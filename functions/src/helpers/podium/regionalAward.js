/**
 * Podium regional-major champion (§5.11).
 *
 * Only the three branded regional majors crown regional champions — the
 * Southwestern Championship (day 28), the Southeastern Championship (day 35),
 * and the two-night Eastern Classic (days 41/42). Unlike the fantasy classes
 * (one champion per competitive class), Podium crowns ONE overall champion per
 * major: the top `podiumClass` corps across all divisions at that show.
 *
 * Extracted from processor.js to keep that file focused; the processor owns the
 * write, this module owns the "who won" decision.
 */

const { regionalTierForEventName } = require("../seasonSchedule");

// The days the three branded majors sit on. Day 41 is Eastern night 1 and
// defers into day 42's combined field.
const REGIONAL_MAJOR_DAYS = [28, 35, 41, 42];

/**
 * The single overall Podium regional champion for `competitionDay`, or null.
 *
 * Mirrors the fantasy timing: the Eastern Classic runs two nights (days 41/42)
 * with each corps performing one assigned night, so night one (day 41) defers
 * and night two (day 42) crowns from the COMBINED two-night field (reading the
 * persisted day-41 recap via `store.recapDayRef`).
 *
 * The result is applied with arrayUnion by the caller, so a deterministic
 * re-run of the same day is idempotent (identical trophy objects dedupe).
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} store - podium store module (for recapDayRef)
 * @param {Object} seasonData - carries seasonUid and name
 * @param {number} competitionDay
 * @param {string} majorLabel - branded event name for this major day
 * @param {Array<{eventName: string, results: Array}>} recapShows - tonight's grouped shows
 * @returns {Promise<{uid: string, trophy: Object}|null>}
 */
async function resolvePodiumRegionalChampion(
  db, store, seasonData, competitionDay, majorLabel, recapShows
) {
  if (!REGIONAL_MAJOR_DAYS.includes(competitionDay)) return null;
  // Eastern night 1 defers to the combined day-42 field — crowning from a
  // half-field would mint the wrong titlist.
  if (competitionDay === 41) return null;

  const isMajor = (show) =>
    show && (show.eventName === majorLabel || regionalTierForEventName(show.eventName));
  const majorShow = (recapShows || []).find(isMajor);
  if (!majorShow) return null;

  const podiumResults = (results) =>
    (results || []).filter((r) => r.corpsClass === "podiumClass");
  let combined = podiumResults(majorShow.results);

  if (competitionDay === 42) {
    // Combine with Eastern night 1 (day 41) so the champion comes from the full
    // two-night field, not just Saturday's corps.
    const night1Snap = await store.recapDayRef(db, seasonData.seasonUid, 41).get();
    const night1Shows = night1Snap.exists ? night1Snap.data().shows || [] : [];
    const night1Major = night1Shows.find(isMajor);
    if (night1Major) {
      combined = [...podiumResults(night1Major.results), ...combined];
    }
  }
  if (combined.length === 0) return null;

  const champion = combined.slice().sort((a, b) => b.totalScore - a.totalScore)[0];
  return {
    uid: champion.uid,
    trophy: {
      type: "regional",
      corpsClass: "podiumClass",
      seasonName: seasonData.name,
      eventName: majorLabel || majorShow.eventName,
      score: champion.totalScore,
      rank: 1,
    },
  };
}

module.exports = { REGIONAL_MAJOR_DAYS, resolvePodiumRegionalChampion };
