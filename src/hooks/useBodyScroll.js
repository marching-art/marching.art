import { useEffect } from 'react';

/**
 * Enables body scrolling for pages outside GameShell.
 *
 * The index.html sets overflow:hidden and height:100% on html/body
 * for GameShell's fixed-position layout. Pages rendered outside
 * GameShell (Landing, Login, Register, etc.) need to override this.
 */
export function useBodyScroll() {
  useEffect(() => {
    // Override html and body constraints
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.height = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';

    // Also ensure #root allows overflow
    const root = document.getElementById('root');
    if (root) {
      root.style.minHeight = 'auto';
      root.style.height = 'auto';
      root.style.overflow = 'visible';
    }

    return () => {
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.overflow = '';
      document.body.style.height = '';
      if (root) {
        root.style.minHeight = '';
        root.style.height = '';
        root.style.overflow = '';
      }
    };
  }, []);
}
