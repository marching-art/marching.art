// =============================================================================
// ARTICLE SITE HEADER - Fixed header for the Article page
// =============================================================================
// Mirrors the Landing header so the article page reads as the same app chrome:
// signed-in users get a compact status chip + the primary nav on desktop and a
// persistent BottomNav on mobile (rendered by the Article page itself); the
// header no longer carries the oversized DASHBOARD button. Signed-out visitors
// keep the lightweight Discord / Privacy / Terms links.

import React from 'react';
import { Link } from 'react-router-dom';
import {
  MessageCircle,
  Coins,
  Zap,
  Newspaper,
  LayoutDashboard,
  Calendar,
  Trophy,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProfileStore } from '../../store/profileStore';
import DesktopNavItem from '../Layout/DesktopNavItem';

const ArticleSiteHeader = () => {
  const { user } = useAuth();
  const profile = useProfileStore((state) => state.profile);

  return (
    <header className="flex-shrink-0 h-14 bg-[#1a1a1a] border-b border-[#333]">
      <div className="max-w-[1920px] mx-auto h-full flex items-center px-4 lg:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-sm overflow-hidden">
            <img src="/logo192.svg" alt="marching.art" className="w-full h-full object-cover" />
          </div>
          <span className="text-base font-bold text-white tracking-wider">marching.art</span>
        </Link>

        <div className="ml-auto flex items-center gap-1">
          {/* Signed-out auth actions live in the bottom nav (GuestActionBar),
              not the header — leaving the corner for Discord + Privacy/Terms. */}

          {/* Signed-in mobile status chip - replaces the old DASHBOARD button.
              Navigation lives in the persistent BottomNav rendered by the page. */}
          {user && profile && (
            <Link
              to="/dashboard"
              aria-label={`Dashboard — ${(profile.corpsCoin || 0).toLocaleString()} coins, level ${profile.xpLevel || 1}`}
              className="lg:hidden flex items-center gap-2 min-h-[44px] pl-3 pr-2 rounded-lg bg-white/[0.04] border border-[#333] active:scale-95 transition-all duration-150 press-feedback"
            >
              <span className="flex items-center gap-1 text-sm font-bold text-yellow-500 font-data tabular-nums">
                <Coins className="w-3.5 h-3.5" />
                {(profile.corpsCoin || 0).toLocaleString()}
              </span>
              <span className="flex items-center gap-1 text-sm font-bold text-purple-400 font-data tabular-nums pl-2 border-l border-[#333]">
                <Zap className="w-3.5 h-3.5" />
                {profile.xpLevel || 1}
              </span>
            </Link>
          )}

          {/* Desktop nav */}
          {user ? (
            <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
              <DesktopNavItem to="/" icon={Newspaper} label="News" end />
              <DesktopNavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
              <DesktopNavItem to="/schedule" icon={Calendar} label="Schedule" />
              <DesktopNavItem to="/scores" icon={Trophy} label="Scores" />
              <DesktopNavItem to="/profile" icon={User} label="Profile" />
            </nav>
          ) : (
            /* Signed out: Discord + Privacy/Terms in the corner, now on mobile
               too. Discord is an icon; legal links stay compact. */
            <div className="flex items-center gap-0.5">
              <a
                href="https://discord.gg/YvFRJ97A5H"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-[#5865F2] hover:bg-white/10 rounded-sm transition-colors press-feedback flex items-center"
                title="Join our Discord"
                aria-label="Join our Discord"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
              <Link
                to="/privacy"
                className="px-2 py-2.5 min-h-touch text-xs text-gray-500 hover:text-gray-300 active:text-white transition-colors press-feedback flex items-center"
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="px-2 py-2.5 min-h-touch text-xs text-gray-500 hover:text-gray-300 active:text-white transition-colors press-feedback flex items-center"
              >
                Terms
              </Link>
            </div>
          )}

          {/* Discord icon for signed-in users (the informational link row above is
              signed-out only) — matches GameShell + the Landing header. */}
          {user && (
            <a
              href="https://discord.gg/YvFRJ97A5H"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-[#5865F2] hover:bg-white/10 rounded-sm transition-colors press-feedback flex items-center"
              title="Join our Discord"
              aria-label="Join our Discord"
            >
              <MessageCircle className="w-5 h-5" />
            </a>
          )}
        </div>
      </div>
    </header>
  );
};

export default ArticleSiteHeader;
