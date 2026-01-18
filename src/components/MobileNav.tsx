// =============================================================================
// MOBILE NAV COMPONENT (TypeScript)
// =============================================================================
// Mobile slide-out navigation menu - Simplified with 5 main items

import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { m, AnimatePresence, Variants } from 'framer-motion';
import {
  Home, Trophy, Calendar, User, Settings, LogOut,
  Users, X, Menu, Star, Shield, LucideIcon
} from 'lucide-react';
import { useAuth } from '../App';
import { adminHelpers } from '../firebase';
import { useProfileStore } from '../store/profileStore';

// =============================================================================
// TYPES
// =============================================================================

export interface MobileNavProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

interface UserProfile {
  displayName?: string;
  xpLevel?: number;
  xp?: number;
}

// =============================================================================
// CONSTANTS - 5 main navigation items
// =============================================================================

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/schedule', label: 'Schedule', icon: Calendar },
  { path: '/scores', label: 'Scores', icon: Trophy },
  { path: '/leagues', label: 'Leagues', icon: Users },
  { path: '/profile', label: 'Profile', icon: User },
];

// Settings is now integrated into Profile page - no separate nav item needed
const secondaryItems: NavItem[] = [];

const menuVariants: Variants = {
  closed: {
    x: '100%',
    transition: { type: 'tween', duration: 0.3 },
  },
  open: {
    x: 0,
    transition: { type: 'tween', duration: 0.3 },
  },
};

const overlayVariants: Variants = {
  closed: { opacity: 0 },
  open: { opacity: 1 },
};

// =============================================================================
// COMPONENT
// =============================================================================

const MobileNav: React.FC<MobileNavProps> = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  // Use global profile store to prevent duplicate Firestore listeners
  const profile = useProfileStore((state) => state.profile) as UserProfile | null;

  // Check if user is admin
  useEffect(() => {
    adminHelpers.isAdmin().then(setIsAdmin);
  }, [user]);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location, setIsOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

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
    <>
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 z-40 lg:hidden">
        <div className="flex items-center justify-between h-full px-4">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-sm overflow-hidden">
              <img src="/logo192.svg" alt="marching.art" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-lg font-display font-bold">
              <span className="text-yellow-400">marching</span>
              <span className="text-yellow-50/90">.art</span>
            </h1>
          </Link>

          {/* Menu Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-sm hover:bg-white/10 transition-colors"
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <X className="w-6 h-6 text-yellow-50/80" />
            ) : (
              <Menu className="w-6 h-6 text-yellow-50/80" />
            )}
          </button>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-16 lg:hidden" />

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <m.div
              initial="closed"
              animate="open"
              exit="closed"
              variants={overlayVariants}
              transition={{ duration: 0.3 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
            />

            {/* Menu Panel */}
            <m.nav
              initial="closed"
              animate="open"
              exit="closed"
              variants={menuVariants}
              onClick={(e) => e.stopPropagation()}
              className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-slate-950/95 backdrop-blur-xl border-l border-white/10 z-50 lg:hidden overflow-y-auto"
            >
              <div className="flex flex-col h-full">
                {/* Menu Header */}
                <div className="p-4 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-display font-bold text-yellow-50">Menu</h2>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-2 rounded-sm hover:bg-white/10 transition-colors"
                    >
                      <X className="w-5 h-5 text-yellow-50/80" />
                    </button>
                  </div>
                </div>

                {/* User Info */}
                {user && profile && (
                  <div className="p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-sm flex items-center justify-center">
                          <User className="w-6 h-6 text-slate-900" />
                        </div>
                        {(profile.xpLevel ?? 0) >= 10 && (
                          <Star className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400 fill-yellow-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-yellow-50 truncate">
                          {profile.displayName || 'Director'}
                        </p>
                        <p className="text-sm text-yellow-50/60">
                          Level {profile.xpLevel || 1}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Navigation */}
                <div className="flex-1 py-4">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`
                          flex items-center gap-3 px-4 py-3 transition-all duration-200
                          ${active
                            ? 'bg-yellow-500/10 text-yellow-400 border-l-2 border-yellow-500'
                            : 'text-yellow-50/70 hover:bg-white/5 hover:text-yellow-50 border-l-2 border-transparent'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}

                  {/* Divider */}
                  <div className="h-px mx-4 my-4 bg-white/10" />

                  {/* Secondary Items */}
                  {secondaryItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`
                          flex items-center gap-3 px-4 py-3 transition-all duration-200
                          ${active
                            ? 'bg-yellow-500/10 text-yellow-400 border-l-2 border-yellow-500'
                            : 'text-yellow-50/70 hover:bg-white/5 hover:text-yellow-50 border-l-2 border-transparent'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}

                  {/* Admin Link - Only visible to admins */}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className={`
                        flex items-center gap-3 px-4 py-3 transition-all duration-200
                        ${isActive('/admin')
                          ? 'bg-yellow-500/10 text-yellow-400 border-l-2 border-yellow-500'
                          : 'text-yellow-50/70 hover:bg-white/5 hover:text-yellow-50 border-l-2 border-transparent'
                        }
                      `}
                    >
                      <Shield className="w-5 h-5" />
                      <span className="font-medium">Admin</span>
                    </Link>
                  )}
                </div>

                {/* Sign Out */}
                <div className="p-4 border-t border-white/10">
                  {user ? (
                    <button
                      onClick={signOut}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-sm bg-red-500/10 text-red-400 hover:bg-red-500/15 transition-all"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="font-medium">Sign Out</span>
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <Link
                        to="/login"
                        className="block w-full text-center px-4 py-3 rounded-sm bg-yellow-500 text-slate-900 font-semibold hover:bg-yellow-400 transition-all"
                      >
                        Sign In
                      </Link>
                      <Link
                        to="/register"
                        className="block w-full text-center px-4 py-3 rounded-sm border border-yellow-500 text-yellow-500 font-semibold hover:bg-yellow-500/10 transition-all"
                      >
                        Register
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </m.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default MobileNav;
