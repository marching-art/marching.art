/**
 * Real-field running order (Phase 2 of docs/EVENT_SCHEDULES_AND_SLOTS.md).
 *
 * Turns the corps that actually REGISTERED for a show into a believable running
 * order, slotted worst-to-best by recent performance and anchored so the last
 * performer's scores land exactly at the night's real score drop. This is what
 * lets a director see THEIR OWN corps take the field at a real time — the field
 * is the live player field, not a historical stand-in.
 *
 * Pure and unit-testable: all timing math runs on injected instants + the
 * fit-to-window engine (helpers/scheduleModel.js); the only impurity is reading
 * the venue timezone (helpers/eventDetails.js), which is a deterministic lookup.
 * The Firestore reads/writes live in scheduled/scheduleRunningOrder.js.
 */

const { deriveRunningOrder } = require("./scheduleModel");
const { resolveTimezone, zonedWallTimeToUtc } = require("./eventDetails");

// Rolling window (most-recent scored nights) for the slotting metric. A short
// mean is steadier than the single latest score early-season but still tracks
// current form. Calibration knob — see EVENT_SCHEDULES_AND_SLOTS.md §11.
const RECENT_WINDOW = 3;

// Class prestige bands break ties in a mixed field with no scores yet (cold
// start) so higher classes tend to headline — a whisper next to real
// performance (0.01), never enough to reorder corps that actually have scores.
const CLASS_BAND = { soundSport: 0, aClass: 1, openClass: 2, worldClass: 3, podiumClass: 2 };

/**
 * A corps' recent-performance number for slotting: the mean of its most recent
 * scored nights, falling back to its latest total, then 0 (cold start).
 * @param {Object|null} entry a fantasy_standings class entry (or null)
 * @param {number} [window]
 * @returns {number}
 */
function recentPerformance(entry, window = RECENT_WINDOW) {
  if (!entry) return 0;
  const hist = Array.isArray(entry.scores) ? entry.scores : [];
  const recent = hist
    .slice(0, window)
    .map((s) => Number(s && (s.score ?? s.totalScore)))
    .filter(Number.isFinite);
  if (recent.length) return recent.reduce((a, b) => a + b, 0) / recent.length;
  const latest = Number(entry.totalScore ?? entry.score);
  return Number.isFinite(latest) ? latest : 0;
}

/** Wall-clock parts of an instant in a timezone (via Intl, DST-correct). */
function tzParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0; // Intl can emit 24 at midnight
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour,
    minute: parseInt(parts.minute, 10),
  };
}

/**
 * Build a show's running order from its registered field.
 *
 * @param {Object} params
 * @param {Array<{uid:string|null, corpsClass:string, corpsName:string, hometown?:string}>} params.registrations
 * @param {(uid:string|null, corpsClass:string)=>Object|null} [params.metricFor]
 *   Lookup for a corps' standings entry (recent performance). Missing = cold start.
 * @param {Date} params.scoresDropAt  The real fantasy score-drop instant for this
 *   show (off-season: 9 PM ET; live: the ladder/announce instant).
 * @param {string} [params.timezone]  Venue timezone; resolved from location if absent.
 * @param {string} [params.location]  "City, ST" — used only to resolve the timezone.
 * @param {Object} [params.fitOpts]   Extra fit-to-window options (windowMinutes,
 *   minIntervalMin, maxIntervalMin) forwarded to deriveRunningOrder.
 * @returns {{
 *   timezone:string, gatesAt:(string|null), startsAt:(string|null),
 *   scoresAt:(string|null), intervalMin:number, fieldSize:number,
 *   lineup:Array<{order:number, uid:string|null, corpsClass:string, corps:string,
 *     hometown:(string|null), performanceTime:string, performsAt:(string|null)}>,
 *   overflow:Array<{uid:string|null, corpsClass:string, corps:string}>
 * }}
 */
function buildShowRunningOrder(params) {
  const {
    registrations = [],
    metricFor = () => null,
    scoresDropAt,
    timezone,
    location,
    fitOpts = {},
  } = params;

  const tz = timezone || resolveTimezone(location || "", null) || "America/New_York";

  // Local wall-clock of the drop, in the venue tz — the fit-to-window anchor —
  // and the local calendar day we rebuild performer instants against.
  const drop = tzParts(scoresDropAt, tz);
  const scoresLocalMinutes = drop.hour * 60 + drop.minute;

  // Convert a local-minutes-of-day (possibly rolled to the prior day for a very
  // early first performer) back to an absolute instant on the drop's local date.
  const toIso = (mins) => {
    const dayOff = Math.floor(mins / 1440);
    const m = ((mins % 1440) + 1440) % 1440;
    return zonedWallTimeToUtc(
      drop.year,
      drop.month - 1,
      drop.day + dayOff,
      Math.floor(m / 60),
      m % 60,
      tz
    ).toISOString();
  };

  // Each corps is fed to the engine under a UNIQUE key (uid_class, or a synthetic
  // for legacy uid-less rows) so duplicate/"Unnamed Corps" names never collide;
  // the display fields are restored from this side map afterward.
  const byKey = new Map();
  const field = registrations.map((r, i) => {
    const key = r.uid ? `${r.uid}_${r.corpsClass}` : `anon${i}_${r.corpsClass}`;
    byKey.set(key, r);
    const perf = recentPerformance(metricFor(r.uid, r.corpsClass));
    const band = CLASS_BAND[r.corpsClass] ?? 0;
    return { corps: key, hometown: r.hometown ?? null, score: perf + band * 0.01 };
  });

  const ro = deriveRunningOrder(field, {
    fitToWindow: { scoresLocalMinutes, ...fitOpts },
  });

  const restore = (key) => byKey.get(key) || { uid: null, corpsClass: null, corpsName: key };
  const lineup = ro.lineup.map((e) => {
    const r = restore(e.corps);
    return {
      order: e.order,
      uid: r.uid ?? null,
      corpsClass: r.corpsClass,
      corps: r.corpsName || "Unnamed Corps",
      hometown: e.hometown ?? null,
      performanceTime: e.performanceTime,
      performsAt: toIso(e.performsAtLocalMinutes),
    };
  });
  const overflow = (ro.overflow || []).map((o) => {
    const r = restore(o.corps);
    return { uid: r.uid ?? null, corpsClass: r.corpsClass, corps: r.corpsName || "Unnamed Corps" };
  });

  return {
    timezone: tz,
    gatesAt: lineup.length ? toIso(ro.gatesLocalMinutes) : null,
    startsAt: lineup.length ? toIso(ro.startLocalMinutes) : null,
    scoresAt: lineup.length ? toIso(ro.scoresLocalMinutes) : null,
    intervalMin: ro.intervalMin,
    fieldSize: registrations.length,
    lineup,
    overflow,
  };
}

module.exports = {
  RECENT_WINDOW,
  CLASS_BAND,
  recentPerformance,
  tzParts,
  buildShowRunningOrder,
};
