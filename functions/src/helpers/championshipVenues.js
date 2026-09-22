// The fixed venues of Championship Week. These are game facts, not schedule
// data: the Open & A Class rounds are always in Marion, IN and the World
// Championship rounds (and the SoundSport festival) always in Indianapolis, IN
// — the same sites the client's CHAMPIONSHIP_EVENTS constants print. An
// off-season schedule copies its World rounds from an archive year's "DCI
// World Championship" show, which drags that year's historical venue along
// (Madison, Denver, Bloomington…); everything that stamps or reads a
// championship row's venue resolves it through here instead, so the schedule
// doc, its show-time weather and the card all agree.

const OPEN_A_VENUE = "Marion, IN";
const WORLD_VENUE = "Indianapolis, IN";

/** True for a schedule row (or generated show) that is a championship round. */
function isChampionshipRow(comp) {
  return Boolean(
    comp && (comp.type === "championship" || comp.isChampionship === true || comp.mandatory === true)
  );
}

/**
 * The fixed venue for a championship row, by its event name; null for a
 * regular show (or a championship row whose name matches no known round —
 * its own location then stands).
 * @param {{name?: string, eventName?: string, type?: string, isChampionship?: boolean, mandatory?: boolean}|null|undefined} comp
 * @returns {string|null}
 */
function championshipVenueFor(comp) {
  if (!isChampionshipRow(comp)) return null;
  const name = String(comp.name || comp.eventName || "").toLowerCase();
  if (/open\s*(and|&|\/)\s*a\s*class/.test(name)) return OPEN_A_VENUE;
  if (/world championship|soundsport/.test(name)) return WORLD_VENUE;
  return null;
}

module.exports = { OPEN_A_VENUE, WORLD_VENUE, isChampionshipRow, championshipVenueFor };
