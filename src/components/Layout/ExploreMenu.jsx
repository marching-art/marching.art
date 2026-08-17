// =============================================================================
// EXPLORE MENU - the game destinations that aren't part of the daily loop
// =============================================================================
// Shop, Achievements, Records, and the archive galleries used to live inside
// the ❓ help drawer (SiteLinksMenu), grouped under a question mark next to
// Privacy and the Game Guide. They are game features, not help — a director
// looking to spend CorpsCoin had to think to look under "help", and on mobile
// they weren't reachable from the nav at all. This pulls them into their own
// menu so the ❓ can go back to being purely guides + legal.
//
// Rendered in both shells (GameShell's TopNav and the public SiteHeader's
// signed-in branch) from the shared link lists in utils/exploreLinks, so a
// signed-in director reaches the same places whether they're on an app page or
// a public one — the two headers no longer disagree.

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { prefetchRoute } from '../../lib/prefetch';
import { GAME_LINKS, ARCHIVE_LINKS } from '../../utils/exploreLinks';

const itemClass =
  'flex items-center gap-2.5 px-3 py-2.5 min-h-touch text-sm text-secondary hover:text-white hover:bg-white/5 transition-colors';

const ExploreMenu = () => {
  const [open, setOpen] = useState(false);
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const containerRef = useRef(null);
  /** @type {React.MutableRefObject<HTMLButtonElement | null>} */
  const buttonRef = useRef(null);

  // Close on outside click and on Escape (returning focus to the trigger, so
  // keyboard users aren't stranded). Mirrors SiteLinksMenu.
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

  /** @param {import('../../utils/exploreLinks').AppLink} link */
  const renderLink = (link) => {
    const Icon = link.icon;
    return (
      <Link
        key={link.to}
        to={link.to}
        role="menuitem"
        onClick={() => setOpen(false)}
        onMouseEnter={() => prefetchRoute(link.to)}
        onFocus={() => prefetchRoute(link.to)}
        className={itemClass}
      >
        <Icon className="w-4 h-4 text-muted" aria-hidden="true" />
        {link.label}
      </Link>
    );
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Explore"
        title="Explore"
        className={`relative ml-1 p-2 rounded-none transition-colors ${
          open ? 'text-white bg-white/10' : 'text-muted hover:text-white hover:bg-white/10'
        }`}
      >
        <LayoutGrid className="w-5 h-5" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Explore"
          className="absolute right-0 top-full mt-1 w-52 bg-surface-card border border-line rounded-none py-1 z-50"
        >
          {/* Your progression & economy */}
          {GAME_LINKS.map(renderLink)}

          <div className="my-1 border-t border-line" />

          {/* The game world's archive */}
          {ARCHIVE_LINKS.map(renderLink)}
        </div>
      )}
    </div>
  );
};

export default ExploreMenu;
