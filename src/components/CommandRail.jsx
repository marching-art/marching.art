// =============================================================================
// COMMAND RAIL COMPONENT (Simplified)
// =============================================================================
// Simple desktop sidebar navigation with 5 main items
// No collapse functionality - always shows icons + labels

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Calendar, Trophy, Users, User,
  Settings, LogOut, Shield
} from 'lucide-react';
import { useAuth } from '../App';
import { adminHelpers } from '../firebase';

// =============================================================================
// CONSTANTS - 5 main navigation items
// =============================================================================

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/schedule', label: 'Schedule', icon: Calendar },
  { path: '/scores', label: 'Scores', icon: Trophy },
  { path: '/leagues', label: 'Leagues', icon: Users },
  { path: '/profile', label: 'Profile', icon: User },
];

// Settings is now integrated into Profile page - no separate nav item needed
const secondaryItems = [];

// =============================================================================
// NAV ITEM COMPONENT
// =============================================================================

const NavItem = ({ item, isActive }) => {
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
        ${isActive
          ? 'bg-yellow-500/15 text-yellow-400 font-semibold'
          : 'text-yellow-50/70 hover:bg-white/5 hover:text-yellow-50'
        }
      `}
    >
      <Icon className={`w-5 h-5 ${isActive ? 'text-yellow-400' : ''}`} />
      <span className="text-sm">{item.label}</span>
    </Link>
  );
};

// =============================================================================
// COMMAND RAIL COMPONENT
// =============================================================================

const CommandRail = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

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

  const isActiveRoute = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
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
      className="h-full w-56 flex flex-col bg-slate-950/90 backdrop-blur-xl border-r border-white/5"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="h-16 px-4 flex items-center border-b border-white/5">
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
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            isActive={isActiveRoute(item.path)}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="h-px mx-4 bg-white/10" />

      {/* Secondary Navigation */}
      <div className="py-4 px-3 space-y-1">
        {secondaryItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            isActive={isActiveRoute(item.path)}
          />
        ))}

        {/* Admin Link */}
        {isAdmin && (
          <Link
            to="/admin"
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
              ${isActiveRoute('/admin')
                ? 'bg-yellow-500/15 text-yellow-400 font-semibold'
                : 'text-yellow-50/70 hover:bg-white/5 hover:text-yellow-50'
              }
            `}
          >
            <Shield className="w-5 h-5" />
            <span className="text-sm">Admin</span>
          </Link>
        )}

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-yellow-50/70 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm">Sign Out</span>
        </button>
      </div>
    </nav>
  );
};

export default CommandRail;
