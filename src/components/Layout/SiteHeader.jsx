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
  Coins,
  Zap,
  Newspaper,
  LayoutDashboard,
  Music,
  Calendar,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProfileStore } from '../../store/profileStore';
import { DISCORD_URL } from '../../utils/siteLinks';
import DesktopNavItem from './DesktopNavItem';
import ExploreMenu from './ExploreMenu';
import SiteLinksMenu from './SiteLinksMenu';

const SiteHeader = () => {
  // These render on public routes too, where there is no AuthProvider —
  // `useAuth()` is null there and `user` is simply undefined.
  const user = useAuth()?.user;
  const profile = useProfileStore((state) => state.profile);

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
          {/* On a signed-in phone the coin/level status chip and the three menu
              icons already fill the row, so the wordmark is hidden below sm to
              keep them from overflowing off-screen; the logo mark still marks
              home. It returns from sm up (tablets/desktop) where there's room,
              and signed-out phones keep it since they carry no status chip. */}
          <span
            className={`text-base font-bold text-white tracking-wider truncate ${
              user ? 'hidden sm:inline' : ''
            }`}
          >
            marching.art
          </span>
        </Link>

        <div className="ml-auto flex flex-shrink-0 items-center gap-1">
          {/* Signed-in mobile status chip — navigation itself lives in the
              persistent BottomNav that PublicShell renders below. */}
          {user && profile && (
            <Link
              to="/dashboard"
              aria-label={`Dashboard — ${(profile.corpsCoin || 0).toLocaleString()} coins, level ${profile.xpLevel || 1}`}
              className="lg:hidden flex items-center gap-2 min-h-[44px] pl-3 pr-2 rounded-none bg-white/[0.04] border border-line active:scale-95 transition-all duration-150 press-feedback"
            >
              <span className="flex items-center gap-1 text-sm font-bold text-brand font-data tabular-nums">
                <Coins className="w-3.5 h-3.5" />
                {(profile.corpsCoin || 0).toLocaleString()}
              </span>
              <span className="flex items-center gap-1 text-sm font-bold text-purple-400 font-data tabular-nums pl-2 border-l border-line">
                <Zap className="w-3.5 h-3.5" />
                {Number(profile.xpLevel) || 1}
              </span>
            </Link>
          )}

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
              Discord + the same Explore and help (❓) menus GameShell's header
              carries. Before this, the app header's rich ❓ dropdown collapsed
              to a single "Game Guide" icon the moment a director stepped onto a
              public page — the two shells disagreed. They now render the same
              shared menus, so the chrome is identical across the boundary. */}
          {user && (
            <>
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
