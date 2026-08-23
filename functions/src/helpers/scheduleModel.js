/**
 * Learned schedule model (Step 1).
 *
 * Generates a believable DCI-style running order + performance clock for any
 * event from just its field of (corps, score), for the years that have no real
 * scraped schedule (pre-2019) and for the pool-driven championship stages.
 *
 * The constants and the ordering rule are FIT from the 2019-2026 scraped archive
 * (see src/scripts/calibrateSchedule.js and docs/SCHEDULE_SYSTEM.md),
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
 *
 * ## Two modes
 *
 * 1. **Default (end-anchored start).** The historical/heritage path: performers
 *    are spaced at the fixed calibrated 17-min interval, and the START is pulled
 *    earlier for large fields so the show never runs past ~10:30 PM. Used by the
 *    heritage enrichment and championship synthesis; behavior is unchanged.
 *
 * 2. **Fit-to-window (end-anchored scores).** The live-field path (see
 *    docs/EVENT_SCHEDULES_AND_SLOTS.md). The caller passes the show's real "scores
 *    read" time (the nightly score drop, in local wall-clock minutes); the LAST
 *    performer is anchored so scores land exactly then, and the interval is
 *    COMPRESSED as the field grows so every registered corps still gets a timed
 *    slot before the drop. Only if the field can't fit even at the minimum
 *    interval do the lowest performers spill into `overflow` (the safety valve —
 *    still scored, just not in the timed order). This is what lets a director
 *    always see their own corps take the field at a real time.
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
  intervalMin: 17, // between consecutive performers (also the fit-to-window ceiling)
  intermissionMin: 34, // extra gap for the single intermission
  intermissionPosition: 0.43, // placed after ~43% of the field
  minFieldForIntermission: 6, // tiny shows get no intermission
  // --- Fit-to-window knobs (docs/EVENT_SCHEDULES_AND_SLOTS.md §11 calibration) ---
  // Max span from first to last performer. Bounds how early a big show opens; the
  // interval compresses to keep the field inside it. 5h keeps even a big regional
  // ending at the drop from opening before mid-afternoon.
  defaultWindowMinutes: 300,
  // Floor spacing between performers under compression. Below this, extra corps
  // overflow instead of packing tighter. Biased small so the field rarely
  // overflows — the north star is that every director gets a timed slot.
  minIntervalMin: 5,
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
 * Sort a raw field worst-to-best by score (the calibrated running-order rule),
 * dropping anything without a corps and a finite score. Corps name is the stable
 * tiebreak so the order is deterministic.
 * @param {Array<{corps:string, score:number, hometown?:string}>} field
 * @returns {Array<{corps:string, score:number, hometown?:string}>}
 */
function orderedPerformers(field) {
  return (field || [])
    .filter((f) => f && f.corps && Number.isFinite(f.score))
    .sort((a, b) => a.score - b.score || String(a.corps).localeCompare(String(b.corps)));
}

/** Where the single intermission falls in a field of `n` (0 = none). */
function intermissionAfterFor(n, C) {
  return n >= C.minFieldForIntermission ? Math.max(1, Math.round(n * C.intermissionPosition)) : 0;
}

/** Span (minutes) from first to last performer for `n` corps at `interval`. */
function spanFor(n, interval, C) {
  if (n <= 1) return 0;
  return (n - 1) * interval + (intermissionAfterFor(n, C) > 0 ? C.intermissionMin : 0);
}

/**
 * Lay `performers` onto the clock starting at `start`, spaced by `interval`, with
 * the single intermission gap after `intermissionAfter` (0 = none).
 * @returns {Array<{order, corps, hometown, performanceTime, performsAtLocalMinutes}>}
 */
function layoutLineup(performers, start, interval, intermissionAfter, C) {
  const lineup = [];
  let t = start;
  performers.forEach((p, i) => {
    if (i > 0) {
      t += interval;
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
  return lineup;
}

/**
 * Fit-to-window layout: anchor the last performer so scores land at
 * `scoresLocalMinutes`, compressing the interval so the whole field fits inside
 * the window; overflow the lowest performers only if even the minimum interval
 * can't fit them. `performers` must already be worst-to-best.
 *
 * @param {Array} performers ordered worst-to-best
 * @param {Object} fw fit-to-window options
 * @param {Object} C constants
 * @returns {{start:number, interval:number, kept:Array, overflow:Array, intermissionAfter:number}}
 */
function fitToWindowLayout(performers, fw, C) {
  const window = fw.windowMinutes ?? C.defaultWindowMinutes;
  const minInt = fw.minIntervalMin ?? C.minIntervalMin;
  const maxInt = fw.maxIntervalMin ?? C.intervalMin;
  const n = performers.length;

  // Capacity: the most performers that fit in `window` at the MINIMUM interval.
  // Intermission presence depends on the kept count, so test the real span.
  let cap = n;
  if (spanFor(n, minInt, C) > window) {
    cap = 1;
    for (let c = n; c >= 1; c--) {
      if (spanFor(c, minInt, C) <= window) { cap = c; break; }
    }
  }
  // Keep the BEST `cap` performers (the tail of a worst-to-best list); the lowest
  // performers overflow to the "also competing" list.
  const overflow = cap < n ? performers.slice(0, n - cap) : [];
  const kept = cap < n ? performers.slice(n - cap) : performers;
  const k = kept.length;

  const intermissionAfter = intermissionAfterFor(k, C);
  // Interval: as wide as the calibrated ceiling when the field is small, then
  // compressed toward the floor as it grows to keep the span within the window.
  let interval = maxInt;
  if (k > 1) {
    const inter = intermissionAfter > 0 ? C.intermissionMin : 0;
    const ideal = (window - inter) / (k - 1);
    // Floor (not round) so the span never overshoots the window.
    interval = Math.max(minInt, Math.min(maxInt, Math.floor(ideal)));
  }

  // End-anchor: scores read at `scoresLocalMinutes`, so the last performer is one
  // scores-offset earlier, and the first performer is the span before that.
  const lastPerformer = fw.scoresLocalMinutes - C.scoresOffsetMin;
  const start = lastPerformer - spanFor(k, interval, C);

  return { start, interval, kept, overflow, intermissionAfter };
}

/**
 * Derive a running order + local clock for a field of competitors.
 *
 * @param {Array<{corps:string, score:number, hometown?:string}>} field
 * @param {Object} [opts]
 * @param {number} [opts.startLocalMinutes] - Force the first-performer start
 *   (overrides the end-anchored default; used when a caller knows the real slot).
 *   Ignored when `fitToWindow` is set.
 * @param {Object} [opts.fitToWindow] - Switch to fit-to-window mode. The last
 *   performer is anchored so scores land at `scoresLocalMinutes` (local wall-clock
 *   minutes), and the interval compresses as the field grows.
 * @param {number} opts.fitToWindow.scoresLocalMinutes - REQUIRED: the score-drop
 *   time in local wall-clock minutes.
 * @param {number} [opts.fitToWindow.windowMinutes] - Max first->last span.
 * @param {number} [opts.fitToWindow.minIntervalMin] - Floor spacing (overflow below).
 * @param {number} [opts.fitToWindow.maxIntervalMin] - Ceiling spacing (default 17).
 * @param {Object} [opts.constants] - Override any calibration constant (testing).
 * @returns {{
 *   modelVersion:string, mode:("default"|"fit-to-window"),
 *   startLocalMinutes:number, gatesLocalMinutes:number, scoresLocalMinutes:number,
 *   intervalMin:number,
 *   lineup:Array<{order:number, corps:string, hometown:(string|null),
 *                 performanceTime:string, performsAtLocalMinutes:number}>,
 *   overflow:Array<{corps:string, hometown:(string|null), score:number}>
 * }}
 */
function deriveRunningOrder(field, opts = {}) {
  const C = { ...CONSTANTS, ...(opts.constants || {}) };
  const performers = orderedPerformers(field);
  const n = performers.length;

  // --- Fit-to-window mode --------------------------------------------------
  if (opts.fitToWindow && Number.isFinite(opts.fitToWindow.scoresLocalMinutes)) {
    if (n === 0) {
      return emptyResult("fit-to-window", opts.fitToWindow.scoresLocalMinutes, C);
    }
    const { start, interval, kept, overflow, intermissionAfter } = fitToWindowLayout(
      performers,
      opts.fitToWindow,
      C
    );
    const lineup = layoutLineup(kept, start, interval, intermissionAfter, C);
    return finishResult(lineup, interval, "fit-to-window", C, overflow);
  }

  // --- Default (end-anchored start) mode -----------------------------------
  const hasIntermission = n >= C.minFieldForIntermission;
  const intermissionAfter = hasIntermission ? Math.max(1, Math.round(n * C.intermissionPosition)) : 0;
  const spanMin = spanFor(n, C.intervalMin, C);

  let start = opts.startLocalMinutes;
  if (start === undefined) {
    const endAnchoredStart = C.targetLastPerformerLocalMinutes - spanMin;
    start = Math.min(C.defaultStartLocalMinutes, endAnchoredStart);
    start = Math.max(C.floorStartLocalMinutes, start);
  }
  const lineup = layoutLineup(performers, start, C.intervalMin, intermissionAfter, C);
  return finishResult(lineup, C.intervalMin, "default", C, []);
}

/** Shared result assembly: derive gates/scores from the laid-out lineup. */
function finishResult(lineup, interval, mode, C, overflow) {
  const firstT = lineup.length ? lineup[0].performsAtLocalMinutes : 0;
  const lastT = lineup.length ? lineup[lineup.length - 1].performsAtLocalMinutes : 0;
  return {
    modelVersion: MODEL_VERSION,
    mode,
    startLocalMinutes: firstT,
    gatesLocalMinutes: firstT - C.gatesOffsetMin,
    scoresLocalMinutes: lastT + C.scoresOffsetMin,
    intervalMin: interval,
    lineup,
    overflow: (overflow || []).map((p) => ({
      corps: p.corps,
      hometown: p.hometown ?? null,
      score: p.score,
    })),
  };
}

/** Empty-field result. In fit mode the scores anchor is still reported. */
function emptyResult(mode, scoresLocalMinutes, C) {
  const scores = Number.isFinite(scoresLocalMinutes) ? scoresLocalMinutes : 0;
  const start = scores - C.scoresOffsetMin;
  return {
    modelVersion: MODEL_VERSION,
    mode,
    startLocalMinutes: start,
    gatesLocalMinutes: start - C.gatesOffsetMin,
    scoresLocalMinutes: scores,
    intervalMin: C.intervalMin,
    lineup: [],
    overflow: [],
  };
}

module.exports = {
  MODEL_VERSION,
  CONSTANTS,
  formatLocalClock,
  deriveRunningOrder,
};
