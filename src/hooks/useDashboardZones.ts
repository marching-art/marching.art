// Mobile zone state for the dashboard: which section is showing, which of the
// others have something waiting, and how to reveal a panel buried in one.
//
// Desktop ignores all of it — every zone is `lg:block` and the tab bar is
// `lg:hidden`. The zone list and the panel→zone map live in
// utils/dashboardZones; the reasoning for tabbing at all is documented there.

import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_DASHBOARD_ZONE,
  zoneForPanel,
  type DashboardZoneId,
} from '../utils/dashboardZones';
import {
  computeDirectorsReport,
  type DirectorsReportProfile,
  type PodiumChallengeFacts,
  type RecentResult,
} from '../utils/directorsReport';

export interface UseDashboardZonesOptions {
  profile: DirectorsReportProfile | null;
  recentResults: RecentResult[];
  activeCorpsClass: string | null;
  /** Filled caption slots in the active corps. */
  lineupCount: number;
  /**
   * True when the active class is Podium, which has no caption lineup — so the
   * lineup-completeness dot must not apply (without this, a Podium director saw
   * a permanent My-Corps dot, since their lineupCount is always 0).
   */
  isPodium?: boolean;
  /**
   * Podium show/concept facts, threaded into the Today count so the tab dot
   * agrees with the Director's Report for a Podium director.
   */
  podium?: PodiumChallengeFacts | null;
}

export interface DashboardZoneState {
  activeZone: DashboardZoneId;
  setActiveZone: (zone: DashboardZoneId) => void;
  /** Extra classes for a zone wrapper: hidden on mobile unless selected. */
  zoneClass: (zone: DashboardZoneId) => string;
  attention: Partial<Record<DashboardZoneId, boolean>>;
  /** Show a panel by id, switching to its zone first if it is hidden. */
  revealPanel: (panelId: string) => void;
}

export function useDashboardZones({
  profile,
  recentResults,
  activeCorpsClass,
  lineupCount,
  isPodium = false,
  podium = null,
}: UseDashboardZonesOptions): DashboardZoneState {
  const [activeZone, setActiveZone] = useState<DashboardZoneId>(DEFAULT_DASHBOARD_ZONE);

  const zoneClass = useCallback(
    (zone: DashboardZoneId) => (zone === activeZone ? '' : 'hidden lg:block'),
    [activeZone]
  );

  // The same computation the Director's Report renders, so a dot on the Today
  // tab can never disagree with the count inside it — including the Podium
  // show/concept facts that keep a Podium director's set winnable.
  const daily = useMemo(
    () => computeDirectorsReport({ profile, recentResults, corpsClass: activeCorpsClass, podium }),
    [profile, recentResults, activeCorpsClass, podium]
  );

  // Dots on the tabs the director is not currently looking at — the ambient
  // "there is something over here" a flat stack can never give. Only the two
  // signals this page holds exactly: the Season zone's rewards are claimed from
  // the Director's Report, which lives under Today, so it has none of its own.
  // Podium has no lineup, so the lineup-completeness dot must not apply to it
  // (a richer Podium corps signal belongs with the Podium next-action work).
  const attention = useMemo(
    () => ({ corps: !isPodium && lineupCount < 8, today: !daily.allDone }),
    [isPodium, lineupCount, daily.allDone]
  );

  // A panel the Next Action hero points at may live in a zone that is
  // currently hidden. Reveal its zone first, or the button scrolls to a
  // display:none element and appears to do nothing.
  const revealPanel = useCallback((panelId: string) => {
    const zone = zoneForPanel(panelId);
    if (zone) setActiveZone(zone);
    // Next frame: a newly shown zone has to be laid out before it can be
    // scrolled to.
    requestAnimationFrame(() => {
      document.getElementById(panelId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  return { activeZone, setActiveZone, zoneClass, attention, revealPanel };
}

export default useDashboardZones;
