// =============================================================================
// SITE FOOTER - shared utility links for every page outside GameShell
// =============================================================================
// Before this existed the site had no footer at all: /privacy and /terms were
// reachable only from the signed-out variant of the home header, and the public
// guides had no inbound links from anywhere in the app. Every page rendered by
// PublicShell gets this row, and the server-rendered /results pages mirror the
// same link set (functions/src/helpers/resultsPages.js) so the two surfaces
// read as one site.
//
// GameShell deliberately does NOT use this — its fixed one-screen layout has no
// document flow to put a footer in. Signed-in directors reach the same links
// through SiteLinksMenu in the top nav.

import React from 'react';
import { Link } from 'react-router-dom';
import { DISCORD_URL } from '../../utils/siteLinks';

// /results is served by a Cloud Function via a hosting rewrite, NOT by the SPA
// router — a <Link> would be intercepted client-side and fall through to the
// 404 route. It has to be a real anchor so the browser does a full navigation.
const SiteFooter = ({ className = '' }) => (
  <footer className={`border-t border-line mt-8 ${className}`}>
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted">
      <Link to="/" className="hover:text-white transition-colors">
        Home
      </Link>
      <Link to="/how-to-play" className="hover:text-white transition-colors">
        How to Play
      </Link>
      <Link to="/podium-guide" className="hover:text-white transition-colors">
        Podium Guide
      </Link>
      <Link to="/hall-of-champions" className="hover:text-white transition-colors">
        Hall of Champions
      </Link>
      <a href="/results" className="hover:text-white transition-colors">
        Results
      </a>
      <a
        href={DISCORD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-white transition-colors"
      >
        Discord
      </a>
      <Link to="/privacy" className="hover:text-white transition-colors">
        Privacy
      </Link>
      <Link to="/terms" className="hover:text-white transition-colors">
        Terms
      </Link>
    </div>
  </footer>
);

export default SiteFooter;
