/**
 * Learned schedule model (Step 1).
 *
 * Generates a believable DCI-style running order + performance clock for any
 * event from just its field of (corps, score), for the years that have no real
 * scraped schedule (pre-2019) and for the pool-driven championship stages.
 *
 * The constants and the ordering rule are FIT from the 2019-2026 scraped archive
 * (see src/scripts/calibrateSchedule.js and docs/SCHEDULE_MODEL_CALIBRATION.md),
 * not guessed:
 *   - Performance order tracks reverse standings: across 24 sampled events the
 *     Spearman correlation between performance order and final score had a median
 *     of 0.917 and never fell below 0.60. So sorting a field worst-to-best by
 *     score reproduces the real running order closely (the residual is the small
 *     set of score-adjacent swaps, since real order is seeded by the PRIOR round,
 *     not that night's score).
 *   - Timing medians: first performer ~7:10 PM local, gates 80 min before, scores
 *     23 min after the last performer, ~17 min between corps, one ~34 min
 *     intermission ~43% of the way through the field.
 *
 * Output times are LOCAL wall-clock (minutes past local midnight, and a formatted
 * "H:MM AM/PM" string). Converting to absolute instants (performsAt) needs the
 * event's date + venue timezone and is done by the caller (Step 3 rebasing), so
 * this module stays pure and unit-testable.
 */

// Bump when the constants or ordering rule change so archived learned rows can be
// distinguished / rebuilt. Format: YYYY.MM of the calibration.
const MODEL_VERSION = "2026.07";

const CONSTANTS = {
  // First-performer local start for a typical regional-sized field (median 19.17h).
  defaultStartLocalMinutes: 19 * 60 + 10, // 7:10 PM
  // Large fields start earlier so the show still ends at a realistic hour; we
  // anchor the LAST performer near this time and back-compute the start.
  targetLastPerformerLocalMinutes: 22 * 60 + 30, // 10:30 PM
  // Never start a synthesized show before this (safety floor for huge fields).
  floorStartLocalMinutes: 10 * 60, // 10:00 AM
  gatesOffsetMin: 80, // gates open before first performer
  scoresOffsetMin: 23, // scores announced after last performer
  intervalMin: 17, // between consecutive performers
  intermissionMin: 34, // extra gap for the single intermission
  intermissionPosition: 0.43, // placed after ~43% of the field
  minFieldForIntermission: 6, // tiny shows get no intermission
};

/**
 * Format minutes-past-local-midnight as "H:MM AM/PM". Wraps past 24h for display
 * (the raw minutes are kept separately so callers can roll the date over).
 * @param {number} minutesOfDay
 * @returns {string}
 */
function formatLocalClock(minutesOfDay) {
  const m = ((Math.round(minutesOfDay) % 1440) + 1440) % 1440;
  let hour = Math.floor(m / 60);
  const min = m % 60;
  const period = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${String(min).padStart(2, "0")} ${period}`;
}

/**
 * Derive a running order + local clock for a field of competitors.
 *
 * @param {Array<{corps:string, score:number, hometown?:string}>} field
 * @param {Object} [opts]
 * @param {number} [opts.startLocalMinutes] - Force the first-performer start
 *   (overrides the end-anchored default; used when a caller knows the real slot).
 * @param {Object} [opts.constants] - Override any calibration constant (testing).
 * @returns {{
 *   modelVersion:string,
 *   startLocalMinutes:number, gatesLocalMinutes:number, scoresLocalMinutes:number,
 *   lineup:Array<{order:number, corps:string, hometown:(string|null),
 *                 performanceTime:string, performsAtLocalMinutes:number}>
 * }}
 */
function deriveRunningOrder(field, opts = {}) {
  const C = { ...CONSTANTS, ...(opts.constants || {}) };

  // Only real, scored competitors take the field; worst-to-best by score,
  // corps name as a stable tiebreaker so the order is deterministic.
  const performers = (field || [])
    .filter((f) => f && f.corps && Number.isFinite(f.score))
    .sort((a, b) => a.score - b.score || String(a.corps).localeCompare(String(b.corps)));

  const n = performers.length;
  const hasIntermission = n >= C.minFieldForIntermission;
  const intermissionAfter = hasIntermission ? Math.max(1, Math.round(n * C.intermissionPosition)) : 0;

  // Total span from first to last performer, then end-anchor the start so large
  // fields don't run past midnight; small fields keep the evening default.
  const spanMin = n > 1
    ? (n - 1) * C.intervalMin + (hasIntermission ? C.intermissionMin : 0)
    : 0;
  let start = opts.startLocalMinutes;
  if (start === undefined) {
    const endAnchoredStart = C.targetLastPerformerLocalMinutes - spanMin;
    start = Math.min(C.defaultStartLocalMinutes, endAnchoredStart);
    start = Math.max(C.floorStartLocalMinutes, start);
  }

  const lineup = [];
  let t = start;
  performers.forEach((p, i) => {
    if (i > 0) {
      t += C.intervalMin;
      if (intermissionAfter && i === intermissionAfter) t += C.intermissionMin;
    }
    lineup.push({
      order: i + 1,
      corps: p.corps,
      hometown: p.hometown ?? null,
      performanceTime: formatLocalClock(t),
      performsAtLocalMinutes: t,
    });
  });

  const firstT = lineup.length ? lineup[0].performsAtLocalMinutes : start;
  const lastT = lineup.length ? lineup[lineup.length - 1].performsAtLocalMinutes : start;

  return {
    modelVersion: MODEL_VERSION,
    startLocalMinutes: firstT,
    gatesLocalMinutes: firstT - C.gatesOffsetMin,
    scoresLocalMinutes: lastT + C.scoresOffsetMin,
    lineup,
  };
}

module.exports = {
  MODEL_VERSION,
  CONSTANTS,
  formatLocalClock,
  deriveRunningOrder,
};
