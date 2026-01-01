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

    // Also ensure #root allows overflow and is not fixed-positioned
    const root = document.getElementById('root');
    if (root) {
      root.style.position = 'static';
      root.style.top = 'auto';
      root.style.left = 'auto';
      root.style.width = '100%';
      root.style.height = 'auto';
      root.style.minHeight = '100vh';
      root.style.overflow = 'visible';
    }

    return () => {
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.overflow = '';
      document.body.style.height = '';
      if (root) {
        root.style.position = '';
        root.style.top = '';
        root.style.left = '';
        root.style.width = '';
        root.style.height = '';
        root.style.minHeight = '';
        root.style.overflow = '';
      }
    };
  }, []);
}
