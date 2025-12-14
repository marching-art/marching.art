// =============================================================================
// NAVIGATION COMPONENT (TypeScript)
// =============================================================================
// Simple desktop sidebar with 5 main items (no collapse)
// Dashboard, Schedule, Scores, Leagues, Profile

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Trophy, Calendar, User, Users,
  Settings, LogOut, Shield, LucideIcon
} from 'lucide-react';
import { useAuth } from '../App';
import { adminHelpers } from '../firebase';
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
// CONSTANTS - 5 main navigation items
// =============================================================================

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/schedule', label: 'Schedule', icon: Calendar },
  { path: '/scores', label: 'Scores', icon: Trophy },
  { path: '/leagues', label: 'Leagues', icon: Users, badgeKey: 'leagues' },
  { path: '/profile', label: 'Profile', icon: User },
];

// Settings is now integrated into Profile page - no separate nav item needed
const secondaryItems: NavItem[] = [];

// =============================================================================
// COMPONENT
// =============================================================================

const Navigation: React.FC = () => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  // Get notification badge count for leagues
  const leagueBadge = useLeagueNotificationBadge(user?.uid);

  useEffect(() => {
    adminHelpers.isAdmin().then(setIsAdmin);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

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
    <nav className="fixed left-0 top-0 h-full w-56 bg-slate-950/90 backdrop-blur-xl border-r border-white/5 z-40 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-white/5">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-yellow-500/30">
            <img src="/logo192.webp" alt="marching.art" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-lg font-display font-bold">
              <span className="text-yellow-400">Marching</span>
              <span className="text-yellow-50/90">.art</span>
            </h1>
          </div>
        </Link>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const badgeCount = item.badgeKey === 'leagues' ? leagueBadge.count : 0;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                ${active
                  ? 'bg-yellow-500/15 text-yellow-400 font-semibold'
                  : 'text-yellow-50/70 hover:bg-white/5 hover:text-yellow-50'
                }
              `}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${active ? 'text-yellow-400' : ''}`} />
                {badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold shadow-lg">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-px mx-4 bg-white/10" />

      {/* Secondary Navigation */}
      <div className="py-4 px-3 space-y-1">
        {secondaryItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                ${active
                  ? 'bg-yellow-500/15 text-yellow-400 font-semibold'
                  : 'text-yellow-50/70 hover:bg-white/5 hover:text-yellow-50'
                }
              `}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-yellow-400' : ''}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Admin Link */}
        {isAdmin && (
          <Link
            to="/admin"
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
              ${isActive('/admin')
                ? 'bg-yellow-500/15 text-yellow-400 font-semibold'
                : 'text-yellow-50/70 hover:bg-white/5 hover:text-yellow-50'
              }
            `}
          >
            <Shield className="w-5 h-5" />
            <span>Admin</span>
          </Link>
        )}

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-yellow-50/70 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </nav>
  );
};

export default Navigation;
