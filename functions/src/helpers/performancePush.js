/**
 * "Your corps takes the field" push builder (follow-up to
 * docs/EVENT_SCHEDULES_AND_SLOTS.md §11).
 *
 * Scans the materialized fantasy running orders for a director's own corps whose
 * slot is imminent, so the scheduled job can push "🎺 <corps> takes the field in
 * N min" — the phone-side twin of the dashboard's live banner. Pure and
 * testable: instants + an already-sent set in, push descriptors out.
 */

/** Unique per corps per show (a corps performs once per show). */
function pushKey(uid, corpsClass, day, eventName) {
  return `${uid}_${corpsClass}_${day}_${eventName}`;
}

/**
 * Build the imminent "takes the field" pushes.
 *
 * A slot fires exactly once, when it is between 0 and `leadMaxMin` minutes ahead
 * of `nowMs` — the scheduled cadence must be ≤ leadMaxMin so no slot is skipped,
 * and the already-sent set stops a later tick from re-firing it.
 *
 * @param {Object} params
 * @param {Array<Object>} params.competitions - schedule competitions (with fantasySchedule).
 * @param {number} params.nowMs - current epoch ms.
 * @param {number} [params.leadMaxMin] - furthest-ahead a slot fires (default 18).
 * @param {Set<string>} [params.alreadySent] - pushKeys already sent (dedup).
 * @returns {Array<{uid:string, corpsClass:string, corps:string, showName:string,
 *   minutesUntil:number, key:string}>}
 */
function buildTakeTheFieldPushes({ competitions, nowMs, leadMaxMin = 18, alreadySent = new Set() }) {
  const out = [];
  for (const comp of competitions || []) {
    const fs = comp && comp.fantasySchedule;
    if (!fs || !Array.isArray(fs.lineup)) continue;
    for (const e of fs.lineup) {
      if (!e || !e.uid || !e.performsAt) continue;
      const at = Date.parse(e.performsAt);
      if (Number.isNaN(at)) continue;
      const minutesUntil = Math.round((at - nowMs) / 60000);
      if (minutesUntil < 0 || minutesUntil > leadMaxMin) continue;
      const key = pushKey(e.uid, e.corpsClass, comp.day, comp.name);
      if (alreadySent.has(key)) continue;
      out.push({
        uid: e.uid,
        corpsClass: e.corpsClass,
        corps: e.corps || "Your corps",
        showName: comp.name,
        minutesUntil: Math.max(0, minutesUntil),
        key,
      });
    }
  }
  return out;
}

module.exports = { buildTakeTheFieldPushes, pushKey };
