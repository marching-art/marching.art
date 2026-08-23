/**
 * Encore assignment (Phase 6 of docs/EVENT_SCHEDULES_AND_SLOTS.md).
 *
 * After scores are read, one corps gets a purely COSMETIC encore — the joy is a
 * director seeing THEIR corps named as the encore. It never scores and never
 * touches standings. Rules:
 *
 *  - Default: the registered corps whose home is CLOSEST to the venue and that
 *    hasn't encored yet this season.
 *  - Cap: one encore per corps per season, absolute, consumed chronologically
 *    (the caller feeds a `usedKeys` set built from earlier shows).
 *  - Host default: at a director's own hosted show, their corps is the encore —
 *    UNLESS they already spent their one earlier, in which case they're not
 *    eligible and the encore falls to the next-closest eligible corps.
 *
 * Pure and unit-testable: the caller supplies the field (with home coords), the
 * venue coords, the used-this-season set, and the host uid.
 */

const { milesBetween } = require("./corpsGeo");

/** Per-corps season cap key: a director's specific corps (uid + class). */
function encoreKey(reg) {
  return `${reg.uid || "anon"}_${reg.corpsClass}`;
}

/**
 * Pick a show's encore corps, or null if none is eligible.
 *
 * @param {Object} params
 * @param {Array<{uid:string|null, corpsClass:string, corpsName:string,
 *   homeGeo?:{lat:number,lng:number}|null, encoreDeclined?:boolean}>} params.registrations
 *   - the field. `encoreDeclined` corps have banked their encore for a later show.
 * @param {{lat:number,lng:number}|null} params.venueGeo - the show's coordinates.
 * @param {Set<string>} params.usedKeys - corps (encoreKey) already used this season.
 * @param {string|null} [params.hostUid] - the show's host, if director-hosted.
 * @returns {{uid:string, corpsClass:string, corps:string,
 *   reason:('host'|'proximity'), miles:(number|null)}|null}
 */
function assignEncore({ registrations = [], venueGeo, usedKeys = new Set(), hostUid = null }) {
  // A corps that declined here (banking for later) is skipped, and — crucially —
  // is NOT added to usedKeys by the caller, so it stays eligible elsewhere.
  const eligible = registrations.filter(
    (r) => r.uid && !r.encoreDeclined && !usedKeys.has(encoreKey(r))
  );
  if (eligible.length === 0) return null;

  // Host default — their own show, if they haven't already spent their encore.
  if (hostUid) {
    const host = eligible.find((r) => r.uid === hostUid);
    if (host) {
      return { uid: host.uid, corpsClass: host.corpsClass, corps: host.corpsName, reason: "host", miles: null };
    }
  }

  // Proximity — nearest home to the venue (stable by corps name on a tie).
  if (venueGeo) {
    let best = null;
    let bestMi = Infinity;
    for (const r of eligible) {
      const mi = milesBetween(r.homeGeo, venueGeo);
      if (mi == null) continue;
      if (mi < bestMi || (mi === bestMi && best && String(r.corpsName).localeCompare(best.corpsName) < 0)) {
        bestMi = mi;
        best = r;
      }
    }
    if (best) {
      return {
        uid: best.uid,
        corpsClass: best.corpsClass,
        corps: best.corpsName,
        reason: "proximity",
        miles: Math.round(bestMi),
      };
    }
  }

  return null;
}

module.exports = { assignEncore, encoreKey };
