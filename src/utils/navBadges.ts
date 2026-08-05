// =============================================================================
// NAV BADGES — ambient "something needs doing" signals for the mobile nav
// =============================================================================
// The bottom bar carried no state at all, so nothing on screen told a director
// that a corps was unfilled or a week unregistered until they went looking. A
// dot on the tab that fixes it turns the nav from a sitemap into a status bar.
//
// Only two things are badged, and both are badged because they cost score
// outright (utils/nextAction documents the reasoning):
//   - a lineup short of 8 captions scores NOTHING at that show
//     (functions/src/helpers/scoring.js gates on hasCompleteLineup);
//   - a week with no registered show is a week with no result at all.
//
// Deliberately NOT badged:
//   - today's Director's Report. Its count depends on the prediction catalog,
//     which is built from a corps' recent results — data the nav does not
//     have. A badge that disagreed with the card it points at is worse than
//     no badge, and the dashboard's own Next Action hero already covers it.
//   - notifications, which the header bell already owns.
//
// Badges are portfolio-wide (any corps, not just the selected one). A nav bar
// is a global surface, and "somewhere in your corps this needs attention" is
// the honest reading of a dot on it — it also sidesteps depending on the
// dashboard's locally-held class selection.

import { CAPTION_IDS } from '../data/captions';
import { CHAMPIONSHIP_START_DAY } from './seasonClock';

export interface NavBadges {
  /** Some corps is short of a full 8-caption lineup. */
  lineup: boolean;
  /** Some corps has no show registered for the current competition week. */
  schedule: boolean;
}

/** Per-class corps entry, narrowed to what badges read. */
export interface BadgeCorps {
  lineup?: Record<string, unknown> | null;
  selectedShows?: Record<string, unknown> | null;
}

/**
 * Pure badge derivation, so the rules are testable without stores.
 *
 * `podiumClass` is skipped throughout: Podium is a director simulation with no
 * caption lineup and its own attendance model, so both rules are meaningless
 * there and would badge forever.
 */
export function deriveNavBadges(
  // The profile store types its corps map loosely (Record<string, unknown>),
  // so accept that and narrow here rather than making every caller assert.
  corps: Record<string, unknown> | null | undefined,
  currentDay: number | null | undefined,
  currentWeek: number | null | undefined
): NavBadges {
  const entries = Object.entries(corps || {}).filter(
    ([corpsClass, entry]) => !!entry && typeof entry === 'object' && corpsClass !== 'podiumClass'
  ) as [string, BadgeCorps][];

  if (entries.length === 0) return { lineup: false, schedule: false };

  const lineup = entries.some(([, entry]) => {
    const slots = entry.lineup || {};
    const filled = CAPTION_IDS.filter((id) => {
      const value = slots[id];
      return typeof value === 'string' && value.length > 0;
    }).length;
    return filled < CAPTION_IDS.length;
  });

  // Championship Week (Days 45-49) auto-enrolls every eligible corps, so there
  // is nothing left to register and the dot would be pointing at a page that
  // cannot help. Before the season store hydrates, say nothing rather than
  // guess.
  const canRegister =
    currentWeek != null && (currentDay == null || currentDay < CHAMPIONSHIP_START_DAY);

  const schedule =
    canRegister &&
    entries.some(([, entry]) => {
      const week = entry.selectedShows?.[`week${currentWeek}`];
      return !Array.isArray(week) || week.length === 0;
    });

  return { lineup, schedule };
}
