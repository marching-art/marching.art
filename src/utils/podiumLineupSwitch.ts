// =============================================================================
// PODIUM → FANTASY LINEUP SWITCH
// =============================================================================
// Podium is a director simulation with no drafted lineup (classRegistry
// hasLineup:false), so the mobile "Lineup" tab and any ?panel=lineup deep link
// have nothing to open onto while the Podium tab is selected. Rather than a
// dead click, the dashboard surfaces a chooser (components/Podium/
// PodiumLineupSheet) offering the Podium daily verb — the rehearsal planner —
// and, when the director also runs fantasy corps, a jump straight to one of
// those lineups.
//
// This module is the pure list-builder behind that chooser: which fantasy
// classes have a foundable lineup right now, and which of those are short of a
// full 8 so they can lead. React-free so the ranking is unit-testable.

import { CAPTION_IDS } from '../data/captions';
import { CORPS_CLASS_ORDER, CORPS_CLASS_LABELS } from './corps';
import { classHasLineup } from './classRegistry';

export interface FantasyLineupClass {
  /** Canonical class id (worldClass/openClass/aClass/soundSport). */
  classId: string;
  /** User-facing class name (CORPS_CLASS_LABELS). */
  label: string;
  /** The corps' own name, falling back to the class label. */
  corpsName: string;
  /**
   * Fewer than 8 captions filled. An incomplete lineup scores nothing at its
   * next show (functions scoring gates on a complete lineup), so these lead the
   * chooser — they are what a director tapping "Lineup" most likely wants.
   */
  incomplete: boolean;
}

/** A corps' lineup is short of all 8 captions (mirrors utils/navBadges). */
function lineupIncomplete(lineup: Record<string, unknown> | null | undefined): boolean {
  const slots = lineup || {};
  const filled = CAPTION_IDS.filter((id) => {
    const value = slots[id];
    return typeof value === 'string' && value.length > 0;
  }).length;
  return filled < CAPTION_IDS.length;
}

/**
 * The fantasy classes a director can open a lineup for right now — one entry per
 * enabled, lineup-drafting class that has a founded corps — sorted so the
 * classes still short of a full lineup come first.
 */
export function getFantasyLineupClasses(
  corps: Record<string, unknown> | null | undefined
): FantasyLineupClass[] {
  const list: FantasyLineupClass[] = [];
  for (const classId of CORPS_CLASS_ORDER) {
    if (!classHasLineup(classId)) continue;
    const entry = corps?.[classId] as
      { corpsName?: string; name?: string; lineup?: Record<string, unknown> } | undefined;
    if (!entry || typeof entry !== 'object') continue;
    const label = CORPS_CLASS_LABELS[classId] || classId;
    list.push({
      classId,
      label,
      corpsName: entry.corpsName || entry.name || label,
      incomplete: lineupIncomplete(entry.lineup),
    });
  }
  // Incomplete first; canonical tier order (the CORPS_CLASS_ORDER traversal
  // above) is preserved within each group by the stable sort.
  return list.sort((a, b) => Number(b.incomplete) - Number(a.incomplete));
}

export default getFantasyLineupClasses;
