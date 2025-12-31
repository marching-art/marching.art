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
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.height = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    return () => {
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.overflow = '';
      document.body.style.height = '';
    };
  }, []);
}
