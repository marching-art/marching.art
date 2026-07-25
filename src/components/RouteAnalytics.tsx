// =============================================================================
// ROUTE ANALYTICS - page views for every route, not just the app shell
// =============================================================================
// logPageView used to be called inside GameShell, so it only ever fired for the
// authenticated routes. Every acquisition surface — the home page, articles,
// /how-to-play, /podium, /preview, the guides, and 404s — recorded nothing at
// all, which is precisely the half of the funnel worth measuring.
//
// Mounted once next to the Router so it sees every navigation.

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsHelpers } from '../api';

export const RouteAnalytics = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    analyticsHelpers.logPageView(pathname);
  }, [pathname]);

  return null;
};

export default RouteAnalytics;
