// =============================================================================
// BOTTOM NAV COMPONENT (TypeScript)
// =============================================================================
// Mobile bottom navigation bar matching desktop nav
// News, Dashboard, Schedule, Scores, Profile

import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Trophy,
  User,
  Newspaper,
  Calendar,
  Shield,
  LucideIcon,
} from 'lucide-react';
import { m } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { adminHelpers } from '../api';
import { triggerHaptic } from '../hooks/useHaptic';
import { prefetchRoute } from '../lib/prefetch';

// =============================================================================
// TYPES
// =============================================================================

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

// =============================================================================
// CONSTANTS - 5 navigation items (matching desktop)
// =============================================================================

const navItems: NavItem[] = [
  { path: '/', label: 'News', icon: Newspaper },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/schedule', label: 'Schedule', icon: Calendar },
  { path: '/scores', label: 'Scores', icon: Trophy },
  { path: '/profile', label: 'Profile', icon: User },
];

// =============================================================================
// COMPONENT
// =============================================================================

const BottomNav: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin (mirrors the desktop TopNav in GameShell)
  useEffect(() => {
    if (user) {
      adminHelpers.isAdmin().then(setIsAdmin);
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  // Append the Admin tab only for users with admin permissions.
  const items: NavItem[] = isAdmin
    ? [...navItems, { path: '/admin', label: 'Admin', icon: Shield }]
    : navItems;

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    if (path === '/profile') {
      return location.pathname.startsWith('/profile');
    }
    if (path === '/scores') {
      return location.pathname.startsWith('/scores');
    }
    if (path === '/schedule') {
      return location.pathname.startsWith('/schedule');
    }
    if (path === '/admin') {
      return location.pathname.startsWith('/admin');
    }
    return location.pathname === path;
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom select-none"
      aria-label="Mobile navigation"
    >
      {/* Accent line at top - solid, no gradient per design laws */}
      <div className="h-px w-full bg-yellow-500/30" />

      {/* Nav container - optimized for 6 items across all screen sizes */}
      <div className="bg-surface-card border-t border-white/10">
        <div className="flex items-center justify-around px-0.5 xs:px-1 py-1.5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                onClick={() => triggerHaptic('light')}
                onMouseEnter={() => prefetchRoute(item.path)}
                onFocus={() => prefetchRoute(item.path)}
                className="relative flex flex-col items-center justify-center gap-0.5 px-1 xs:px-2 py-1.5 min-w-[44px] xs:min-w-[50px] min-h-[48px] press-feedback"
              >
                {/* Active indicator */}
                {active && (
                  <m.div
                    layoutId="bottomNavActive"
                    className="absolute inset-0 bg-yellow-500/10 rounded-none"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}

                {/* Icon - larger on active */}
                <div
                  className={`relative z-10 p-1.5 rounded-none transition-all duration-150 ${active ? 'bg-yellow-500/20' : ''}`}
                >
                  <Icon
                    className={`w-5 h-5 xs:w-[22px] xs:h-[22px] transition-all duration-150 ${
                      active ? 'text-yellow-400 scale-110' : 'text-yellow-50/70'
                    }`}
                    aria-hidden="true"
                  />
                </div>

                {/* Label - hidden on very small screens, visible on xs+ */}
                <span
                  className={`relative z-10 text-[9px] xs:text-[10px] font-medium transition-all duration-150 leading-tight ${
                    active ? 'text-yellow-400' : 'text-yellow-50/60'
                  }`}
                >
                  {item.label}
                </span>

                {/* Active dot indicator - perfectly centered */}
                {active && (
                  <m.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-yellow-400 rounded-full"
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
