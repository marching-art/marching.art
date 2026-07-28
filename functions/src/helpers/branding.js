/**
 * In-game branding for event names.
 *
 * Every show on the tour is a marching.art show, so "DCI" never appears in a
 * name the game presents — whether the name arrived from the scraped DCI tour
 * data or a director typed it into the host-a-show form. Applying this at the
 * write boundary keeps the stored name, the Discord announcement, the
 * CorpsCoin ledger line and the schedule entry all saying the same thing.
 *
 * MIRROR: `formatEventName` in src/utils/season.ts is the client-side twin,
 * applied at render so names stored before this branding existed (and anything
 * else that slips past a write boundary) still display branded. The two must
 * agree — change both.
 */

/**
 * Replace the standalone word "DCI" with "marching.art" in an event name.
 * Non-string input is returned untouched so callers can pass through
 * missing/optional names.
 * @param {*} name - Raw event name (e.g. "DCI Indianapolis").
 * @returns {*} Branded name (e.g. "marching.art Indianapolis").
 */
function brandEventName(name) {
  return typeof name === "string" ? name.replace(/\bDCI\b/g, "marching.art") : name;
}

module.exports = { brandEventName };
