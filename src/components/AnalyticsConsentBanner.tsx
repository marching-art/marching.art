// =============================================================================
// ANALYTICS CONSENT BANNER
// =============================================================================
// One compact, non-blocking bar for first-time visitors: Google Analytics is
// off until they say yes (utils/analyticsConsent), and either answer hides the
// bar for good on this browser. The decision can be changed later under
// Settings → Privacy. Mounted once in App.jsx beside the toaster; sits above
// the mobile bottom nav via `.above-bottom-nav`.

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { useAnalyticsConsent } from '../utils/analyticsConsent';

/**
 * Routes where the bar stays out of the way: full-height forms whose submit
 * button sits exactly where a bottom-anchored bar lands on a phone. The
 * question is asked on the next page instead.
 */
const QUIET_ROUTES = ['/login', '/register', '/forgot-password', '/onboarding'];

export const AnalyticsConsentBanner: React.FC = () => {
  const { asked, grant, deny } = useAnalyticsConsent();
  const { pathname } = useLocation();
  if (asked) return null;
  if (QUIET_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return null;
  }

  return (
    <section
      aria-labelledby="analytics-consent-title"
      className="fixed left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-[90] above-bottom-nav bg-surface border border-line p-3 sm:p-4"
      data-testid="analytics-consent"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-interactive/20 flex-shrink-0" aria-hidden="true">
          <BarChart3 className="w-4 h-4 text-interactive" />
        </div>
        <div className="flex-1 min-w-0">
          <p id="analytics-consent-title" className="text-sm font-bold text-white">
            Help improve marching.art?
          </p>
          <p className="text-xs text-muted mt-1">
            We use Google Analytics to see which parts of the game get used. It stays off unless you
            allow it, and you can change your mind any time in Settings.{' '}
            <Link to="/privacy" className="underline hover:text-secondary">
              Privacy policy
            </Link>
          </p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={grant}
              className="flex-1 min-h-[40px] px-3 bg-interactive text-white text-xs font-bold uppercase tracking-wider hover:bg-interactive-hover transition-colors"
            >
              Allow
            </button>
            <button
              type="button"
              onClick={deny}
              className="flex-1 min-h-[40px] px-3 bg-surface-sunken border border-line text-muted text-xs font-bold uppercase tracking-wider hover:text-white transition-colors"
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AnalyticsConsentBanner;
