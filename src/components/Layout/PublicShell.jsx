// =============================================================================
// PUBLIC SHELL - the layout for every route outside GameShell
// =============================================================================
// GameShell was the only layout component in the app, so each public route hand
// rolled its own chrome: nine different headers, no footer anywhere, and a
// persistent bottom nav on exactly two of them. Pages like /privacy and
// /podium-guide dead-ended with a single "back to home" text link, which on
// mobile meant the entire navigation model vanished the moment you left the
// signed-in app.
//
// PublicShell is the counterpart to GameShell: same header, same bottom nav
// across the signed-in/signed-out boundary, plus the SiteFooter that GameShell's
// fixed layout has no room for.
//
// Layout note: this uses normal document scroll (min-h-screen + flex-col),
// unlike GameShell's fixed one-screen grid. Long-form content, in-page anchors,
// and crawlers all want a scrolling document.

import React from 'react';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import BottomNav from '../BottomNav';
import GuestActionBar from '../Landing/GuestActionBar';
import { useAuth } from '../../context/AuthContext';
import { useBodyScroll } from '../../hooks/useBodyScroll';

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.header]     Override the default SiteHeader
 *   (the demo and Podium landers carry conversion-specific headers).
 * @param {boolean} [props.showFooter]         Default true.
 * @param {boolean} [props.showBottomBar]      Default true. The signed-in
 *   BottomNav, or GuestActionBar for logged-out visitors.
 */
const PublicShell = ({ children, header, showFooter = true, showBottomBar = true }) => {
  // These render on public routes too, where there is no AuthProvider —
  // `useAuth()` is null there and `user` is simply undefined.
  const user = useAuth()?.user;

  // Strip GameShell's fixed-layout class if we arrived from an app route
  // before its cleanup effect ran.
  useBodyScroll();

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-background text-white font-sans">
      {header === undefined ? <SiteHeader /> : header}

      {/* id="main-content" is the target for SkipToContent and RouteChangeFocus.
          Only GameShell used to carry it, so on public pages the skip link fell
          back to a querySelector and focus reset was best-effort. */}
      <main id="main-content" role="main" className="flex-1">
        {children}
      </main>

      {/* Bottom padding clears the fixed bottom bar (66px + safe area), which
          would otherwise sit on top of the last footer row on mobile. */}
      {showFooter && <SiteFooter className={showBottomBar ? 'pb-20 lg:pb-0' : ''} />}

      {showBottomBar && (user ? <BottomNav /> : <GuestActionBar />)}
    </div>
  );
};

export default PublicShell;
