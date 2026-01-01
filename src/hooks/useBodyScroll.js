import { useEffect } from 'react';

/**
 * Ensures body scrolling is enabled for pages outside GameShell.
 *
 * The index.html now defaults to scrollable layout. GameShell pages
 * add the 'game-shell-active' class to enable fixed positioning.
 * This hook ensures the class is removed when viewing public pages,
 * as a safeguard against timing issues during navigation.
 */
export function useBodyScroll() {
  useEffect(() => {
    // Ensure we're not in game-shell mode (safeguard for navigation timing)
    document.documentElement.classList.remove('game-shell-active');
  }, []);
}
