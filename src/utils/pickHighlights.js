// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Shared pick-highlight logic for running orders, used identically by the live
// and off-season views. A director's caption pick ("CorpsName|Year") highlights
// a corps in a show's running order when the brand is present, in two tiers:
//
//   full — the picked (corps, year) had a REAL result on this show's day
//          (resultDays, precomputed onto the pool in dci-data).
//   dim  — the brand is present but the day's score is regression-interpolated
//          (resultDays known and does not include this day).
//
// When resultDays is unavailable (e.g. live season, where the pool has none yet)
// the tier degrades to full — i.e. today's simple "your pick is performing" star.

export const CAPTION_LABELS = {
  GE1: 'General Effect 1',
  GE2: 'General Effect 2',
  VP: 'Visual Proficiency',
  VA: 'Visual Analysis',
  CG: 'Color Guard',
  B: 'Brass',
  MA: 'Music Analysis',
  P: 'Percussion',
};

export const normalizeCorpsName = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Split a lineup value "CorpsName|Year" into its parts. */
export function parsePick(value) {
  const [corpsName = '', sourceYear = null] = String(value || '').split('|');
  return { corpsName, sourceYear };
}

/**
 * Build the highlight map for one show's running order.
 *
 * @param {Object} params
 * @param {Object} params.show - The show ({ day, ... }); day is the offSeasonDay.
 * @param {Object} params.lineup - Caption -> "CorpsName|Year".
 * @param {Array}  params.poolCorps - dci-data corpsValues ({corpsName, sourceYear, resultDays}).
 * @returns {Map<string, {corps:string, sourceYear:(string|null), tier:('full'|'dim'), captions:string[]}>}
 *   keyed by normalized corps name.
 */
export function buildShowHighlights({ show, lineup, poolCorps }) {
  const day = show?.day ?? show?.offSeasonDay ?? null;

  // Look up a pick's real-result days by normalized corps name + source year.
  const resultDaysByKey = new Map();
  for (const c of poolCorps || []) {
    const key = `${normalizeCorpsName(c.corpsName)}|${c.sourceYear}`;
    resultDaysByKey.set(key, Array.isArray(c.resultDays) ? new Set(c.resultDays) : null);
  }

  const map = new Map();
  for (const [caption, value] of Object.entries(lineup || {})) {
    if (!value) continue;
    const { corpsName, sourceYear } = parsePick(value);
    const norm = normalizeCorpsName(corpsName);
    if (!norm) continue;

    const resultDays = resultDaysByKey.get(`${norm}|${sourceYear}`);
    // Dim only when we KNOW the pick had no real result on this day.
    const tier = resultDays && day != null ? (resultDays.has(day) ? 'full' : 'dim') : 'full';
    const label = CAPTION_LABELS[caption] || caption;

    if (!map.has(norm)) {
      map.set(norm, { corps: corpsName, sourceYear, tier, captions: [label] });
    } else {
      const entry = map.get(norm);
      entry.captions.push(label);
      if (tier === 'full') entry.tier = 'full'; // any real-result pick upgrades the brand
    }
  }
  return map;
}

/** Human tooltip for a highlighted row, e.g. "Your GE1 & Brass — Blue Devils (2009)". */
export function highlightLabel(entry) {
  if (!entry) return '';
  const yr = entry.sourceYear ? ` (${entry.sourceYear})` : '';
  const base = `Your ${entry.captions.join(' & ')} — ${entry.corps}${yr}`;
  return entry.tier === 'dim' ? `${base} · interpolated form today` : base;
}
