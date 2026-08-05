// =============================================================================
// DASHBOARD ZONES — the mobile dashboard's map
// =============================================================================
// Desktop lays the dashboard out as a 2/3 + 1/3 grid, so its four zones are all
// on screen at once and a director reads their situation in a glance. Collapsed
// to one column that same content is a ten-panel scroll with no map, which is
// what makes mobile a hunt: everything that was glanceable side by side became
// sequential and remembered.
//
// On mobile the three lower zones become tabs instead. The scorecard (Zone A)
// and the Next Action hero stay above them always — who you are and what to do
// next are not one section among three.
//
// Zone ids match the JSX in pages/Dashboard.jsx; the desktop grid ignores all
// of this (the tab bar is lg:hidden and every zone is lg:block).

export type DashboardZoneId = 'corps' | 'today' | 'season';

export interface DashboardZone {
  id: DashboardZoneId;
  label: string;
  /** DOM id of the zone's wrapper, for aria-controls. */
  elementId: string;
}

/**
 * Tab order, and the default.
 *
 * "My Corps" leads and opens by default because it holds the lineup — the
 * actual game. A new director who lands on a tab bar and sees their eight
 * caption slots has learned what the game is; one who lands on a checklist has
 * not. The daily chores keep their urgency without leading, because the Next
 * Action hero above the tabs already states them as an imperative.
 */
export const DASHBOARD_ZONES: DashboardZone[] = [
  { id: 'corps', label: 'My Corps', elementId: 'zone-my-corps' },
  { id: 'today', label: 'Today', elementId: 'zone-today' },
  { id: 'season', label: 'Season', elementId: 'zone-season' },
];

export const DEFAULT_DASHBOARD_ZONE: DashboardZoneId = 'corps';

/**
 * Which zone a scroll-target panel lives in.
 *
 * The Next Action hero can point at a panel inside a zone the director is not
 * currently looking at (a claimable reward while they are on My Corps). Without
 * this the button would scroll to a hidden element and appear to do nothing.
 */
const PANEL_ZONES: Record<string, DashboardZoneId> = {
  'directors-report': 'today',
  'journey-panel': 'today',
  // Podium's rehearsal planner and plan editor live in My Corps (Zone C),
  // where PodiumZone renders.
  'podium-planner': 'corps',
  'podium-plan-editor': 'corps',
};

/** The zone containing a panel id, or null when it is not inside one. */
export function zoneForPanel(panelId: string): DashboardZoneId | null {
  return PANEL_ZONES[panelId] ?? null;
}
