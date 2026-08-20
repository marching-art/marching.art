// =============================================================================
// SITE HEADER - the one header for every page outside GameShell
// =============================================================================
// Promoted from components/Articles/ArticleSiteHeader, which was already a copy
// of the Landing header. The site previously carried nine different header
// implementations; this is the single one for public//marketing routes, and
// GameShell's TopNav is the single one for the fixed app shell.
//
// Signed-in users get a compact status chip on mobile plus the primary nav on
// desktop, so crossing from an app page to a public page keeps the same chrome.
// Signed-out visitors get the lightweight Discord / Privacy / Terms links; their
// auth actions live in GuestActionBar at the bottom of the viewport.

import React from 'react';
import { Link } from 'react-router-dom';
import {
  MessageCircle,
  Newspaper,
  LayoutDashboard,
  Music,
  Calendar,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DISCORD_URL } from '../../utils/siteLinks';
import DesktopNavItem from './DesktopNavItem';
import ExploreMenu from './ExploreMenu';
import SiteLinksMenu from './SiteLinksMenu';
import NotificationBell from '../Notifications/NotificationBell';

const SiteHeader = () => {
  // These render on public routes too, where there is no AuthProvider —
  // `useAuth()` is null there and `user` is simply undefined.
  const user = useAuth()?.user;

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-14 bg-surface-card border-b border-line">
      <div className="h-full flex items-center gap-2 px-4 lg:px-6">
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 flex-shrink-0 rounded-none overflow-hidden">
            <img
              src="/logo192.svg"
              alt="marching.art"
              className="w-full h-full object-cover"
              loading="eager"
              decoding="async"
            />
          </div>
          {/* Always shown, matching GameShell's TopNav; min-w-0 + truncate on
              the link keep it from forcing the row wider than the viewport. */}
          <span className="text-base font-bold text-white tracking-wider truncate">
            marching.art
          </span>
        </Link>

        <div className="ml-auto flex flex-shrink-0 items-center">
          {user ? (
            // Same order as GameShell's nav: daily loop first (Dashboard,
            // Lineup, Schedule, Scores), then News, Leagues, Profile.
            <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
              <DesktopNavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
              {/* Lineup — the game itself, opened directly (matches GameShell's
                  nav and the mobile bottom-nav tab). */}
              <DesktopNavItem to="/dashboard?panel=lineup" icon={Music} label="Lineup" />
              <DesktopNavItem to="/schedule" icon={Calendar} label="Schedule" />
              <DesktopNavItem to="/scores" icon={Trophy} label="Scores" />
              <DesktopNavItem to="/" icon={Newspaper} label="News" end />
              <DesktopNavItem to="/leagues" icon={Users} label="Leagues" />
              <DesktopNavItem to="/profile" icon={User} label="Profile" />
            </nav>
          ) : (
            /* Signed out: Discord + the legal links in the corner. The footer
               carries the full link set; these stay for parity with the app
               header, where there is no footer. */
            <div className="flex items-center gap-0.5">
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-muted hover:text-[#5865F2] hover:bg-white/10 rounded-none transition-colors press-feedback flex items-center"
                title="Join our Discord"
                aria-label="Join our Discord"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
              <Link
                to="/privacy"
                className="px-2 py-2.5 min-h-touch text-xs text-muted hover:text-secondary active:text-white transition-colors press-feedback flex items-center"
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="px-2 py-2.5 min-h-touch text-xs text-muted hover:text-secondary active:text-white transition-colors press-feedback flex items-center"
              >
                Terms
              </Link>
            </div>
          )}

          {/* Signed-in users skip the informational link row above, so surface
              the same cluster GameShell's header carries — Discord, the inbox
              bell, Explore, and the help (❓) menu, in that order — so the chrome
              is identical across the app/public boundary. The coin/XP status
              chip that used to sit here was dropped: GameShell shows no such
              chip, and a signed-in director reaches the same balances on the
              Dashboard. GameShell and PublicShell are never in the tree at once,
              so this is the session's only NotificationBell while it's on a
              public page — the single-listener invariant still holds. */}
          {user && (
            <>
              {/* Per-item margins (ml-2 here, ml-1 baked into the Explore and
                  help menus, none on the bell) rather than a container gap, so
                  the cluster's spacing is pixel-identical to GameShell's TopNav. */}
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 p-2 text-muted hover:text-[#5865F2] hover:bg-white/10 rounded-none transition-colors press-feedback flex items-center"
                title="Join our Discord"
                aria-label="Join our Discord"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
              <NotificationBell uid={user?.uid} />
              <ExploreMenu />
              <SiteLinksMenu />
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default SiteHeader;
