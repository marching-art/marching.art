/**
 * Schedule Selection Audit / Repair
 *
 * When the season schedule is regenerated or renamed (e.g. event names rebranded
 * from "DCI ..." to "marching.art ..."), directors' saved show selections
 * (corps.{class}.selectedShows.weekN[]) keep their OLD snapshots. Two things
 * break:
 *
 *   1. The per-week max-shows check counts the snapshot array length, so stale
 *      entries consume slots even though they no longer match any show — a
 *      director sees "maxed out" in a week that looks empty.
 *   2. Scoring matches attendance by exact eventName, so a stale name silently
 *      scores nothing.
 *
 * reconcileSelectedShows() re-matches every stored entry against the current
 * schedule using brand-normalized names (brandEventName is applied to the stored
 * name, so pre-branding "DCI X" snapshots match today's "marching.art X" shows):
 *
 *   - Matched entries are canonicalized in place (name/date/location/day taken
 *     from the schedule) and moved to the correct week bucket if the show's day
 *     changed.
 *   - Current/future-week entries that match nothing are REMOVED, freeing the
 *     director's slots so they can register again.
 *   - Past weeks are treated as history: entries are renamed when they safely
 *     match, but never removed or moved.
 *   - Each current/future week is deduped (one show per day, no repeat names)
 *     and re-capped at the week's max.
 *
 * Pure function — no Firestore — so it's unit-testable; the admin
 * audit/repairShowSelections jobs drive it over every profile in the season.
 */

const { brandEventName } = require("./season");

// Mirrors getMaxShowsForWeek in callable/lineups.js (module-local there):
// regular weeks allow 4 shows, the final week allows 7 (one per day).
function maxShowsForWeek(week, totalWeeks = 7) {
  return week === totalWeeks ? 7 : 4;
}

/** Brand + lowercase + collapse whitespace, for name matching across renames. */
function normalizeName(name) {
  return brandEventName(String(name || "")).toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Reconcile one corps's selectedShows object against the current schedule.
 *
 * @param {Object} selectedShows - { week1: [{eventName, date, location, day}], ... }
 * @param {Array<Object>} competitions - Current schedule (schedules/{seasonId}).
 * @param {number} currentWeek - Directors can only edit weeks >= currentWeek;
 *   earlier weeks are history and are never removed/moved, only safely renamed.
 * @param {number} [totalWeeks=7]
 * @returns {{selectedShows: Object, changed: boolean,
 *   stats: {kept: number, renamed: number, moved: number, removed: number}}}
 */
function reconcileSelectedShows(selectedShows, competitions, currentWeek, totalWeeks = 7) {
  const stats = { kept: 0, renamed: 0, moved: 0, removed: 0 };

  // Index the schedule by normalized name. Multiple comps can share a name
  // across days (rare), so keep them all and disambiguate by day.
  const compsByName = new Map();
  for (const comp of competitions) {
    const key = normalizeName(comp.name);
    if (!compsByName.has(key)) compsByName.set(key, []);
    compsByName.get(key).push(comp);
  }

  const canonical = (comp) => ({
    eventName: comp.name,
    date: comp.date ?? null,
    location: comp.location || "",
    day: comp.day,
  });

  // Rebuilt week buckets. Entries can move between buckets when a show's day
  // changed, so build the full map first, then dedupe/cap.
  const rebuilt = {};
  for (let w = 1; w <= totalWeeks; w++) rebuilt[`week${w}`] = [];
  let changed = false;

  for (const [weekKey, entries] of Object.entries(selectedShows || {})) {
    const weekNum = parseInt(String(weekKey).replace(/^week/, ""), 10);
    if (!Array.isArray(entries) || Number.isNaN(weekNum)) continue;
    if (!rebuilt[weekKey]) rebuilt[weekKey] = [];
    const isPastWeek = weekNum < currentWeek;

    for (const entry of entries) {
      const storedName = entry?.eventName || entry?.name;
      const nameKey = normalizeName(storedName);
      const candidates = nameKey ? (compsByName.get(nameKey) || []) : [];
      // Prefer the same day, then the same week, then the first candidate.
      const match =
        candidates.find((c) => c.day === entry.day) ||
        candidates.find((c) => (c.week || Math.ceil(c.day / 7)) === weekNum) ||
        candidates[0];

      if (isPastWeek) {
        // History: never remove or move. Rename/canonicalize only on a confident
        // (same-day) match so scoring/recaps line up with the schedule.
        if (match && match.day === entry.day && match.name !== storedName) {
          rebuilt[weekKey].push({ ...entry, ...canonical(match) });
          stats.renamed++;
          changed = true;
        } else {
          rebuilt[weekKey].push(entry);
          stats.kept++;
        }
        continue;
      }

      if (!match) {
        // Nothing on the schedule matches — drop it and free the slot.
        stats.removed++;
        changed = true;
        continue;
      }

      const matchWeek = match.week || Math.ceil(match.day / 7);
      if (matchWeek < currentWeek) {
        // The show now happens in a week the director can no longer edit/attend.
        stats.removed++;
        changed = true;
        continue;
      }

      const fixed = { ...entry, ...canonical(match) };
      const targetKey = `week${matchWeek}`;
      if (!rebuilt[targetKey]) rebuilt[targetKey] = [];
      rebuilt[targetKey].push(fixed);

      if (matchWeek !== weekNum) {
        stats.moved++;
        changed = true;
      } else if (match.name !== storedName || match.day !== entry.day) {
        stats.renamed++;
        changed = true;
      } else {
        stats.kept++;
      }
    }
  }

  // Dedupe + cap editable weeks (one show per day, no repeat names, week max).
  for (const [weekKey, entries] of Object.entries(rebuilt)) {
    const weekNum = parseInt(weekKey.replace(/^week/, ""), 10);
    if (weekNum < currentWeek) continue;

    const seenDays = new Set();
    const seenNames = new Set();
    const cap = maxShowsForWeek(weekNum, totalWeeks);
    const deduped = [];
    for (const entry of entries) {
      const nameKey = normalizeName(entry.eventName);
      if (seenNames.has(nameKey) || (entry.day != null && seenDays.has(entry.day))) {
        stats.removed++;
        changed = true;
        continue;
      }
      if (deduped.length >= cap) {
        stats.removed++;
        changed = true;
        continue;
      }
      seenNames.add(nameKey);
      if (entry.day != null) seenDays.add(entry.day);
      deduped.push(entry);
    }
    rebuilt[weekKey] = deduped.sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
  }

  // Drop empty buckets we invented so the stored object stays sparse like before.
  for (const weekKey of Object.keys(rebuilt)) {
    if (rebuilt[weekKey].length === 0 && !(selectedShows || {})[weekKey]) {
      delete rebuilt[weekKey];
    }
  }

  return { selectedShows: rebuilt, changed, stats };
}

module.exports = { reconcileSelectedShows, normalizeName, maxShowsForWeek };
