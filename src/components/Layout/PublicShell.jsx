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
// Layout note: this mirrors GameShell's fixed one-screen shell — a pinned
// header, a fixed bottom bar, and a single scroll region in between. Before
// this, the header lived in normal document flow (so it scrolled away on
// mobile) and the document scrolled behind the fixed bottom bar (so page
// content peeked through the bar's safe-area strip). Confining the scroll to
// `main` keeps the chrome put and stops anything from rendering under the bar,
// matching the app shell across the public/app boundary. In-page anchors and
// long-form content scroll inside `main`; crawlers see the same DOM.

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
    <div className="min-h-screen w-full overflow-x-hidden bg-background text-white font-sans">
      {/* Fixed header (h-14), pinned like GameShell's TopNav. */}
      {header === undefined ? <SiteHeader /> : header}

      {/* The one scroll region, fixed between the header and the bottom bar.
          id="main-content" is the target for SkipToContent and RouteChangeFocus.
          `main-content-bottom` reserves the mobile bottom bar (66px + safe area)
          and collapses to bottom:0 on lg where there is no bar; when the shell
          hides the bar entirely, run to the bottom edge. */}
      <main
        id="main-content"
        role="main"
        className={`fixed top-14 left-0 right-0 overflow-y-auto overflow-x-hidden bg-background ${
          showBottomBar ? 'main-content-bottom' : 'bottom-0'
        }`}
      >
        {children}
        {/* Footer now scrolls at the end of the region rather than sitting in
            document flow behind the fixed bar. */}
        {showFooter && <SiteFooter />}
      </main>

      {showBottomBar && (user ? <BottomNav /> : <GuestActionBar />)}
    </div>
  );
};

export default PublicShell;
