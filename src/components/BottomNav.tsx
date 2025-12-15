// =============================================================================
// BOTTOM NAV COMPONENT (TypeScript)
// =============================================================================
// Mobile bottom navigation bar with 5 direct items
// Dashboard, Schedule, Scores, Leagues, Profile

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Trophy, Users, User, LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../App';
import { useLeagueNotificationBadge } from '../hooks/useLeagueNotifications';

// =============================================================================
// TYPES
// =============================================================================

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: 'leagues'; // Used to show notification badges
}

// =============================================================================
// CONSTANTS - 5 navigation items
// =============================================================================

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: Home },
  { path: '/schedule', label: 'Schedule', icon: Calendar },
  { path: '/scores', label: 'Scores', icon: Trophy },
  { path: '/leagues', label: 'Leagues', icon: Users, badgeKey: 'leagues' },
  { path: '/profile', label: 'Profile', icon: User },
];

// =============================================================================
// COMPONENT
// =============================================================================

const BottomNav: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  // Get notification badge count for leagues
  const leagueBadge = useLeagueNotificationBadge(user?.uid);

  const isActive = (path: string) => {
    if (path === '/profile') {
      return location.pathname.startsWith('/profile');
    }
    if (path === '/scores') {
      return location.pathname.startsWith('/scores');
    }
    return location.pathname === path;
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom select-none"
      aria-label="Mobile navigation"
    >
      {/* Golden accent line at top */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent" />

      {/* Nav container */}
      <div className="bg-[#1A1A1A] border-t border-white/10">
        <div className="flex items-center justify-around px-1 py-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const badgeCount = item.badgeKey === 'leagues' ? leagueBadge.count : 0;

            return (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className="relative flex flex-col items-center justify-center gap-0.5 px-3 py-2 min-w-[56px] min-h-[44px]"
              >
                {/* Active indicator */}
                {active && (
                  <motion.div
                    layoutId="bottomNavActive"
                    className="absolute inset-0 bg-yellow-500/10 rounded-xl"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}

                {/* Icon with badge */}
                <div className={`relative z-10 p-1.5 rounded-lg transition-all duration-300 ${active ? 'bg-yellow-500/20' : ''}`}>
                  <Icon
                    className={`w-5 h-5 transition-all duration-300 ${
                      active ? 'text-yellow-400' : 'text-yellow-50/50'
                    }`}
                    aria-hidden="true"
                  />
                  {/* Notification badge */}
                  {badgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold shadow-lg">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </div>

                {/* Label */}
                <span
                  className={`relative z-10 text-[10px] font-medium transition-all duration-300 ${
                    active ? 'text-yellow-400' : 'text-yellow-50/50'
                  }`}
                >
                  {item.label}
                </span>

                {/* Active dot indicator */}
                {active && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-0.5 right-1/2 translate-x-1/2 w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_6px_rgba(234,179,8,0.6)]"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
