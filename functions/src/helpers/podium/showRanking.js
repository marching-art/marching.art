/**
 * Per-show ranking and medals — ONE rule for placement, shared by the nightly
 * processor (which writes it), the recap sheet and the season ledger (which
 * display it), and the correction script (which repairs recaps written before
 * this module existed).
 *
 * A Podium show is ranked WITHIN EACH DIVISION. Every division crowns its own
 * winner (design §5.7) — the recap sheet sections the field World / Open / A
 * and numbers each section on its own — so a corps' `place` is its rank among
 * the corps of its division that night, and `fieldSize` is how many of them
 * there were. Medals (design §14.1.3) follow the same field: the top three of
 * a division whose field is at least `minFieldSize` bank gold / silver /
 * bronze. The mixed-field rank was never shown anywhere, and medalling on it
 * put a silver next to a "1/3" and a gold next to a "2/3" in the ledger.
 *
 * Pure: no Firestore, no clock.
 */

const divisions = require("./divisions");

const MEDAL_NAMES = ["gold", "silver", "bronze"];

/** Descending total; a tie keeps the incoming order (a stable sort). */
function byTotalDesc(a, b) {
  return (Number(b.totalScore) || 0) - (Number(a.totalScore) || 0);
}

/**
 * The medal a placement earns, or null. `minFieldSize` is the balance knob
 * (`balance.medals.minFieldSize`): a podium in a two-corps field is not one.
 * @param {number|null|undefined} place 1-based rank within the division.
 * @param {number|null|undefined} fieldSize Corps in that division that night.
 * @param {number} minFieldSize
 * @returns {?("gold"|"silver"|"bronze")}
 */
function medalForPlace(place, fieldSize, minFieldSize) {
  if (!Number.isInteger(place) || place < 1 || place > MEDAL_NAMES.length) return null;
  if (!Number.isFinite(fieldSize) || fieldSize < minFieldSize) return null;
  return /** @type {"gold"|"silver"|"bronze"} */ (MEDAL_NAMES[place - 1]);
}

/**
 * Rank one show's results in place: sorts the rows by descending total (the
 * order every reader expects the array in), then stamps each row with its
 * division `place`, the division `fieldSize`, and its `medal` (or null — the
 * key is always written, so a row with no medal reads as "none", never as
 * "unknown").
 *
 * @template {{ uid?: string, division?: string, totalScore?: number }} Row
 * @param {Row[]} results Mutated and returned.
 * @param {{ minFieldSize: number }} options
 * @returns {{ results: Row[], medalByUid: Record<string, "gold"|"silver"|"bronze"> }}
 */
function rankShowResults(results, { minFieldSize }) {
  results.sort(byTotalDesc);

  /** @type {Map<string, Row[]>} */
  const fieldByDivision = new Map();
  for (const row of results) {
    const division = divisions.normalizeDivision(row.division);
    if (!fieldByDivision.has(division)) fieldByDivision.set(division, []);
    fieldByDivision.get(division).push(row);
  }

  /** @type {Record<string, "gold"|"silver"|"bronze">} */
  const medalByUid = {};
  for (const field of fieldByDivision.values()) {
    // Already in descending order — the outer sort ran over the whole show.
    field.forEach((row, index) => {
      const place = index + 1;
      const medal = medalForPlace(place, field.length, minFieldSize);
      Object.assign(row, { place, fieldSize: field.length, medal });
      if (medal && row.uid) medalByUid[row.uid] = medal;
    });
  }

  return { results, medalByUid };
}

module.exports = { MEDAL_NAMES, medalForPlace, rankShowResults };
