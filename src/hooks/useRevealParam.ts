// =============================================================================
// REVEAL PARAM — land on the dashboard with a panel in view
// =============================================================================
// `?panel=` routes the dashboard's modals (hooks/useModalRoute). Inline panels
// have no such address, which left the onboarding checklist — the one surface
// a new director is told to go find — unlinkable from the help menu and the
// mobile More sheet. `?reveal=<panel id>` fills that gap: on arrival the
// dashboard switches to the panel's zone (mobile) and scrolls it into view,
// then drops the param so a refresh or a back gesture does not replay it.
//
// The reveal waits for `ready` because the panels it targets render only once
// the profile has loaded; revealing earlier would scroll to nothing.

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { REVEAL_PARAM } from '../utils/dashboardZones';

export interface UseRevealParamOptions {
  /** True once the dashboard's panels are on the page. */
  ready: boolean;
  /** Reveal a panel by id — hooks/useDashboardZones' `revealPanel`. */
  revealPanel: (panelId: string) => void;
}

export function useRevealParam({ ready, revealPanel }: UseRevealParamOptions): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const target = searchParams.get(REVEAL_PARAM);

  useEffect(() => {
    if (!target || !ready) return;
    revealPanel(target);
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.delete(REVEAL_PARAM);
        return params;
      },
      { replace: true }
    );
  }, [target, ready, revealPanel, setSearchParams]);
}

export default useRevealParam;
