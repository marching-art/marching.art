// =============================================================================
// SITE LINKS MENU (❓) - the signed-in help menu: guides, what's-new, legal
// =============================================================================
// PublicShell pages get SiteFooter. GameShell can't: its layout is a fixed
// one-screen grid (main is position:fixed between the header and the bottom
// nav), so there is no document flow for a footer to live in — forcing one in
// would break the app shell's core layout.
//
// The consequence, before this menu existed, was that a signed-in director had
// no path from any app page to /privacy, /terms, /how-to-play, /podium-guide,
// /hall-of-champions, or the public results pages. The help icon in the top nav
// linked only to /guide. This turns that single icon into the same link set the
// footer carries.
//
// This menu is now rendered in BOTH shells — GameShell's TopNav and the public
// SiteHeader's signed-in branch — so the ❓ is identical no matter which side of
// the app/public boundary a director is on (it used to shrink to a lone /guide
// icon on public pages). Game destinations (Shop, Achievements, Records, the
// archive galleries) moved out to ExploreMenu, leaving this as pure help.

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, ExternalLink, Sparkles } from 'lucide-react';
import { DISCORD_URL } from '../../utils/siteLinks';
import { APP_CONFIG } from '../../config';
import { useUnseenUpdates } from '../../hooks/useUnseenUpdates';

// This menu is help: guides, what's-new, the public results surface, and legal.
// Game destinations (Shop, Achievements, Records, and the archive galleries)
// used to live here too, which made the ❓ a junk drawer — they now have their
// own home in ExploreMenu, shared across both shells.
const MENU_LINKS = [
  // Routed panel on the dashboard (hooks/useDashboardModals DASHBOARD_PANELS).
  // The Quick Start guide existed but had no caller anywhere in the app, so
  // nobody had ever seen it.
  { to: '/dashboard?panel=quickstart', label: 'Quick Start' },
  { to: '/guide', label: 'Game Guide' },
  { to: '/how-to-play', label: 'How to Play' },
  { to: '/podium-guide', label: 'Podium Guide' },
  { to: '/hall-of-champions', label: 'Hall of Champions' },
];

const LEGAL_LINKS = [
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
];

const itemClass =
  'block px-3 py-2.5 min-h-touch text-sm text-secondary hover:text-white hover:bg-white/5 transition-colors';

const SiteLinksMenu = () => {
  const [open, setOpen] = useState(false);
  const { unseenCount, hasUnseen } = useUnseenUpdates();
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const containerRef = useRef(null);
  /** @type {React.MutableRefObject<HTMLButtonElement | null>} */
  const buttonRef = useRef(null);

  // Close on outside click and on Escape (returning focus to the trigger, so
  // keyboard users aren't stranded at the top of the document).
  useEffect(() => {
    if (!open) return;

    /** @param {Event} event */
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(/** @type {Node} */ (event.target))) setOpen(false);
    };
    /** @param {KeyboardEvent} event */
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={
          hasUnseen ? 'Guides and site links (new updates available)' : 'Guides and site links'
        }
        title="Guides and site links"
        className={`relative ml-1 p-2 rounded-none transition-colors ${
          open ? 'text-white bg-white/10' : 'text-muted hover:text-white hover:bg-white/10'
        }`}
      >
        <HelpCircle className="w-5 h-5" />
        {/* Unseen-updates dot — the "the game is alive" nudge. Cleared when the
            director opens /updates. */}
        {hasUnseen && (
          <span
            className="absolute top-1 right-1 w-2 h-2 bg-teal-400 rounded-full ring-2 ring-surface-raised"
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Guides and site links"
          className="absolute right-0 top-full mt-1 w-56 bg-surface-card border border-line rounded-none py-1 z-50"
        >
          {/* What's New leads the menu and carries the unseen-updates badge. */}
          <Link
            to="/updates"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`${itemClass} flex items-center justify-between gap-2`}
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-400" aria-hidden="true" />
              What&apos;s New
            </span>
            {hasUnseen && (
              <span className="min-w-[1.25rem] px-1.5 py-0.5 text-[10px] font-bold text-center bg-teal-500/20 text-teal-400 border border-teal-500/40 rounded-none">
                {unseenCount > 9 ? '9+' : unseenCount}
              </span>
            )}
          </Link>

          <div className="my-1 border-t border-line" />

          {MENU_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              {link.label}
            </Link>
          ))}

          <div className="my-1 border-t border-line" />

          {/* /results is served by a Cloud Function through a hosting rewrite,
              not the SPA router — a <Link> would be swallowed client-side and
              land on the 404 route. */}
          <a
            href="/results"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`${itemClass} flex items-center justify-between gap-2`}
          >
            Public Results
            <ExternalLink className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
          </a>

          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`${itemClass} flex items-center justify-between gap-2`}
          >
            Discord
            <ExternalLink className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
          </a>

          {/* The one support address. Restricted-account errors, the legal
              pages, and outgoing mail all point here — a director who is
              told to "email support" has to be able to find it. */}
          <a
            href={`mailto:${APP_CONFIG.supportEmail}`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`${itemClass} flex items-center justify-between gap-2`}
          >
            Support
            <ExternalLink className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
          </a>

          <div className="my-1 border-t border-line" />

          <div className="flex">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex-1 px-3 py-2 min-h-touch text-xs text-muted hover:text-white hover:bg-white/5 transition-colors flex items-center"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteLinksMenu;
