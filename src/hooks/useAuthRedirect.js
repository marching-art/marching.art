// =============================================================================
// POST-AUTH REDIRECT TARGET
// =============================================================================
// ProtectedRoute has always stored the attempted location as `state.from` when
// it bounces a signed-out visitor, but nothing ever read it: /login and
// /register hard-coded a redirect to /dashboard, so a shared deep link (a
// league invite, a profile, a specific scores tab) was silently discarded the
// moment the user had to sign in.

import { useLocation } from 'react-router-dom';

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

/** The path to send the user to once they are authenticated. */
export function useAuthRedirectTarget() {
  const location = useLocation();
  return resolveAuthRedirect(location.state?.from);
}

export default useAuthRedirectTarget;
