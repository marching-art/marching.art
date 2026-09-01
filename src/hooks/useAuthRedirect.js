// =============================================================================
// POST-AUTH REDIRECT TARGET
// =============================================================================
// ProtectedRoute stores the attempted location as `state.from` when it bounces
// a signed-out visitor AND stashes the resolved path in sessionStorage
// (lib/pendingRedirect). Router state covers one hop (the inline sign-in);
// the stash covers the multi-page Register → Onboarding funnel that used to
// drop every shared deep link for exactly the people it targeted.

import { useLocation } from 'react-router-dom';
import { peekPendingRedirect } from '../lib/pendingRedirect';

const DEFAULT_TARGET = '/dashboard';

// Bouncing back to an auth page (or to the home page, which is where
// ProtectedRoute sends people in the first place) would just loop.
/** @param {string} pathname */
const isCircular = (pathname) =>
  pathname === '/' ||
  pathname.startsWith('/login') ||
  pathname.startsWith('/register') ||
  pathname.startsWith('/forgot-password') ||
  pathname.startsWith('/onboarding');

/**
 * Resolve a `state.from` location into a path string to navigate to after a
 * successful sign-in or sign-up.
 *
 * @param {{pathname?: string, search?: string, hash?: string} | null | undefined} from
 * @returns {string}
 */
export function resolveAuthRedirect(from) {
  const pathname = from?.pathname;
  // Only same-origin, router-relative paths — never trust an absolute URL here,
  // which would turn the sign-in flow into an open redirect. A leading "//" is
  // protocol-relative and would leave the site, so it is rejected too.
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//')) {
    return DEFAULT_TARGET;
  }
  if (isCircular(pathname)) return DEFAULT_TARGET;
  return `${pathname}${from?.search || ''}${from?.hash || ''}`;
}

/**
 * The path to send the user to once they are authenticated: the route they
 * were bounced from (router state, one hop) or the pending deep link stashed
 * in sessionStorage (survives Register → Onboarding — see lib/pendingRedirect).
 */
export function useAuthRedirectTarget() {
  const location = useLocation();
  if (location.state?.from) return resolveAuthRedirect(location.state.from);
  return peekPendingRedirect() || DEFAULT_TARGET;
}

export default useAuthRedirectTarget;
