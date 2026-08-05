// =============================================================================
// MODAL ROUTE — give a modal an address, and a back button that closes it
// =============================================================================
// The dashboard's modals were pure component state, which cost two things on
// mobile:
//
//   1. The hardware/gesture back button had nothing to pop, so pressing it
//      inside the lineup editor left the dashboard entirely. On Android that is
//      the normal way to dismiss anything, and losing the page instead teaches
//      directors that opening things is risky.
//   2. The core action of the game had no URL. A push notification, a Discord
//      link, or the Next Action hero could not send anyone *to* it — only to
//      the dashboard, to go find it.
//
// Both are fixed by keeping the open panel in the query string: `?panel=lineup`
// is a real history entry, so back pops it and the modal closes, and the same
// URL can be linked from anywhere.
//
// Only panels a director opens deliberately belong here. Queued interrupts (the
// season recap, the onboarding tour, an achievement) must NOT be routed — they
// are not places you navigated to, and letting history dismiss them would skip
// a one-shot ceremony.

import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/** Query key holding the open panel. */
const PANEL_KEY = 'panel';
/** Query key holding a panel's secondary target (e.g. which caption slot). */
const DETAIL_KEY = 'slot';

export interface ModalRoute {
  /** The open panel, or null. Never a value outside the allowed list. */
  panel: string | null;
  /** The panel's secondary target, or null. */
  detail: string | null;
  isOpen: (panel: string) => boolean;
  /** Open a panel, pushing a history entry so back closes it. */
  open: (panel: string, detail?: string | null) => void;
  /** Close whatever is open, consuming the pushed entry when there is one. */
  close: () => void;
}

/**
 * Route a set of named panels through `?panel=`.
 *
 * @param allowed Panel names this surface recognizes. Anything else in the URL
 *   is ignored rather than obeyed, so a stale or hand-edited link can never
 *   leave the page in a state with no modal to show for it.
 */
export function useModalRoute(allowed: readonly string[]): ModalRoute {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const raw = searchParams.get(PANEL_KEY);
  const panel = raw && allowed.includes(raw) ? raw : null;
  const detail = panel ? searchParams.get(DETAIL_KEY) : null;

  // How many history entries this hook pushed and has not yet consumed. Lets
  // close() pop the entry it created (so back and the X button agree) while a
  // deep link — which pushed nothing — is closed by rewriting the URL instead
  // of navigating out of the app.
  const pushedRef = useRef(0);

  // Latches for the render pass in which a close has been requested but the
  // URL has not caught up yet. Modals routinely fire both onSubmit and onClose
  // for one dismissal (CaptionSelectionModal does, on every successful save),
  // and without this the second call would pop a second history entry —
  // throwing the director off the dashboard for saving their lineup.
  const closingRef = useRef(false);

  // A back gesture closes the panel without going through close(), so the
  // pushed entry is already gone. Re-sync on every panel change, or the next
  // close() would pop a history entry belonging to another page.
  useEffect(() => {
    closingRef.current = false;
    if (!panel) pushedRef.current = 0;
  }, [panel]);

  const open = useCallback(
    (next: string, nextDetail: string | null = null) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          params.set(PANEL_KEY, next);
          if (nextDetail) {
            params.set(DETAIL_KEY, nextDetail);
          } else {
            params.delete(DETAIL_KEY);
          }
          return params;
        },
        { replace: false }
      );
      pushedRef.current += 1;
      closingRef.current = false;
    },
    [setSearchParams]
  );

  const close = useCallback(() => {
    // Nothing open, or this dismissal is already in flight.
    if (!panel || closingRef.current) return;
    closingRef.current = true;

    if (pushedRef.current > 0) {
      pushedRef.current -= 1;
      navigate(-1);
      return;
    }
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.delete(PANEL_KEY);
        params.delete(DETAIL_KEY);
        return params;
      },
      { replace: true }
    );
  }, [panel, navigate, setSearchParams]);

  const isOpen = useCallback((name: string) => panel === name, [panel]);

  return { panel, detail, isOpen, open, close };
}

export default useModalRoute;
