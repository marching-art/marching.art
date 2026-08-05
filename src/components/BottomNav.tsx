// =============================================================================
// BOTTOM NAV — the mobile game console
// =============================================================================
// This bar used to mirror the desktop header: News, Dashboard, Schedule,
// Scores, Leagues, Profile, and Admin for staff. That is a sitemap, not a
// console. Seven destinations on a 360px screen leave ~48px each with 9px
// labels, the daily loop is not represented at all — building a lineup, the
// actual game, was three screens down inside the dashboard — and nothing on
// the bar ever changed, so it never told a director that anything needed doing.
//
// It is now the loop, in the order the loop runs:
//
//   Dashboard — what's happening and what to do next
//   Lineup    — the game itself, opened directly (the modal is routable now,
//               so a tab really can land on it: /dashboard?panel=lineup)
//   Schedule  — where you're competing
//   Scores    — how it went
//   More      — the rest of the site, in a sheet
//
// The two tabs that can cost a director score carry a dot when they need
// attention (utils/navBadges). "Dashboard" keeps its desktop name on purpose:
// a tab that is called something different on each device is one more thing
// to learn.

import React, { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  LayoutDashboard,
  MoreHorizontal,
  Music,
  Newspaper,
  Shield,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { m } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { adminHelpers } from '../api';
import { triggerHaptic } from '../hooks/useHaptic';
import { prefetchRoute } from '../lib/prefetch';
import { useNavBadges } from '../hooks/useNavBadges';
import { BottomSheet } from './ui/BottomSheet';

// =============================================================================
// TYPES
// =============================================================================

interface NavItem {
  /** Full target, query string included. */
  to: string;
  /** Route to prefetch on intent (the path alone). */
  prefetch: string;
  label: string;
  icon: LucideIcon;
  /** Which badge, if any, this tab reflects. */
  badge?: 'lineup' | 'schedule';
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PRIMARY_ITEMS: NavItem[] = [
  { to: '/dashboard', prefetch: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    // The lineup editor is a routed panel on the dashboard, so the tab can go
    // straight to it instead of leaving the director to find "Manage Lineup".
    to: '/dashboard?panel=lineup',
    prefetch: '/dashboard',
    label: 'Lineup',
    icon: Music,
    badge: 'lineup',
  },
  { to: '/schedule', prefetch: '/schedule', label: 'Schedule', icon: Calendar, badge: 'schedule' },
  { to: '/scores', prefetch: '/scores', label: 'Scores', icon: Trophy },
];

/** Destinations that moved into the More sheet, plus the help entry. */
const MORE_ITEMS: NavItem[] = [
  // The Quick Start guide had no caller anywhere in the app until it was
  // given a URL; this is the mobile way back to it.
  {
    to: '/dashboard?panel=quickstart',
    prefetch: '/dashboard',
    label: 'Quick Start',
    icon: BookOpen,
  },
  { to: '/', prefetch: '/', label: 'News', icon: Newspaper },
  { to: '/leagues', prefetch: '/leagues', label: 'Leagues', icon: Users },
  { to: '/profile', prefetch: '/profile', label: 'Profile', icon: User },
];

const ADMIN_ITEM: NavItem = { to: '/admin', prefetch: '/admin', label: 'Admin', icon: Shield };

/** Paths the More tab stands in for, so it highlights when you are on one. */
const MORE_PATHS = ['/', '/leagues', '/profile', '/admin'];

// =============================================================================
// COMPONENT
// =============================================================================

const BottomNav: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // useAuth() is null only outside AuthProvider (the public pages); this
  // component renders behind the auth gate, so `user` is simply absent
  // rather than the hook being unavailable.
  const user = useAuth()?.user;
  const [isAdmin, setIsAdmin] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const badges = useNavBadges();

  // Check if user is admin (mirrors the desktop TopNav in GameShell)
  useEffect(() => {
    if (user) {
      adminHelpers.isAdmin().then(setIsAdmin);
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  // Close the sheet on navigation, so tapping a destination inside it does not
  // leave the sheet covering the page it just opened.
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname, location.search]);

  const moreItems = isAdmin ? [...MORE_ITEMS, ADMIN_ITEM] : MORE_ITEMS;
  const lineupOpen = searchParams.get('panel') === 'lineup';

  const isActive = (item: NavItem) => {
    const { pathname } = location;
    if (item.label === 'Lineup') return pathname === '/dashboard' && lineupOpen;
    // The dashboard tab yields to the Lineup tab while the editor is open —
    // two lit tabs for one screen reads as a bug.
    if (item.to === '/dashboard') return pathname === '/dashboard' && !lineupOpen;
    return pathname.startsWith(item.prefetch);
  };

  const moreActive = MORE_PATHS.some((path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  );

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom select-none"
        aria-label="Mobile navigation"
        data-tour="bottom-nav"
      >
        {/* Accent line at top - solid, no gradient per design laws */}
        <div className="h-px w-full bg-line" />

        <div className="bg-surface-card border-t border-white/10">
          <div className="flex items-center justify-around px-0.5 xs:px-1 py-1.5">
            {PRIMARY_ITEMS.map((item) => (
              <NavTab
                key={item.label}
                item={item}
                active={isActive(item)}
                showBadge={!!item.badge && badges[item.badge]}
              />
            ))}

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setMoreOpen(true);
              }}
              aria-label="More"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className="relative flex flex-col items-center justify-center gap-0.5 px-1 xs:px-2 py-1.5 min-w-[44px] xs:min-w-[50px] min-h-[48px] press-feedback"
            >
              {moreActive && (
                <m.div
                  layoutId="bottomNavActive"
                  className="absolute inset-0 bg-interactive/10 rounded-none"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <div
                className={`relative z-10 p-1.5 rounded-none transition-all duration-150 ${moreActive ? 'bg-interactive/20' : ''}`}
              >
                <MoreHorizontal
                  className={`w-5 h-5 xs:w-[22px] xs:h-[22px] transition-all duration-150 ${
                    moreActive ? 'text-interactive scale-110' : 'text-secondary'
                  }`}
                  aria-hidden="true"
                />
              </div>
              <span
                className={`relative z-10 text-[10px] font-medium leading-tight transition-all duration-150 ${
                  moreActive ? 'text-interactive' : 'text-muted'
                }`}
              >
                More
              </span>
            </button>
          </div>
        </div>
      </nav>

      <BottomSheet
        isOpen={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More"
        snapPoints={[50]}
      >
        <nav aria-label="More destinations" className="pb-4">
          {moreItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => triggerHaptic('light')}
                onMouseEnter={() => prefetchRoute(item.prefetch)}
                onFocus={() => prefetchRoute(item.prefetch)}
                className="flex items-center gap-3 px-4 min-h-touch py-3 border-b border-line-subtle text-white hover:bg-surface-raised active:bg-surface-raised transition-colors duration-150"
              >
                <Icon className="w-5 h-5 text-interactive" aria-hidden="true" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </BottomSheet>
    </>
  );
};

// =============================================================================
// TAB
// =============================================================================

const NavTab: React.FC<{ item: NavItem; active: boolean; showBadge: boolean }> = ({
  item,
  active,
  showBadge,
}) => {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-label={showBadge ? `${item.label} — needs attention` : item.label}
      aria-current={active ? 'page' : undefined}
      onClick={() => triggerHaptic('light')}
      onMouseEnter={() => prefetchRoute(item.prefetch)}
      onFocus={() => prefetchRoute(item.prefetch)}
      className="relative flex flex-col items-center justify-center gap-0.5 px-1 xs:px-2 py-1.5 min-w-[44px] xs:min-w-[50px] min-h-[48px] press-feedback"
    >
      {active && (
        <m.div
          layoutId="bottomNavActive"
          className="absolute inset-0 bg-interactive/10 rounded-none"
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}

      <div
        className={`relative z-10 p-1.5 rounded-none transition-all duration-150 ${active ? 'bg-interactive/20' : ''}`}
      >
        <Icon
          className={`w-5 h-5 xs:w-[22px] xs:h-[22px] transition-all duration-150 ${
            active ? 'text-interactive scale-110' : 'text-secondary'
          }`}
          aria-hidden="true"
        />
        {/* Attention dot — amber, the status color, so it never reads as
            branding or as the active-tab azure. */}
        {showBadge && (
          <span
            className="absolute top-0 right-0 w-2 h-2 rounded-full bg-warning border border-surface-card"
            aria-hidden="true"
          />
        )}
      </div>

      <span
        className={`relative z-10 text-[10px] font-medium leading-tight transition-all duration-150 ${
          active ? 'text-interactive' : 'text-muted'
        }`}
      >
        {item.label}
      </span>

      {active && (
        <m.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-interactive rounded-full"
        />
      )}
    </Link>
  );
};

export default BottomNav;
