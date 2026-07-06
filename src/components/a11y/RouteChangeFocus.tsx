// =============================================================================
// ROUTE CHANGE FOCUS - SPA navigation scroll + focus reset
// =============================================================================
// Browsers reset scroll and focus on full page loads, but SPA route changes
// leave both wherever they were — keyboard/screen-reader focus stays stranded
// on the old page's control and scroll position carries over. On every
// pathname change this resets window scroll and moves focus to the main
// content region (matching SkipToContent's target). The initial render is
// skipped so page load keeps the browser's default focus behavior.

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export const RouteChangeFocus = ({ contentId = 'main-content' }: { contentId?: string }) => {
  const { pathname } = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    window.scrollTo(0, 0);

    const main = document.getElementById(contentId) || document.querySelector('main');
    if (main instanceof HTMLElement) {
      // <main> isn't focusable by default — make it a programmatic target
      if (!main.hasAttribute('tabindex')) {
        main.setAttribute('tabindex', '-1');
      }
      main.focus({ preventScroll: true });
    }
  }, [pathname, contentId]);

  return null;
};

export default RouteChangeFocus;
