// =============================================================================
// GAMING HEADER COMPONENT (TypeScript)
// =============================================================================
// Simplified global top navigation bar
// 5 main items: Dashboard, Schedule, Scores, Leagues, Profile

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Calendar, Trophy, Users, User,
  Menu, Coins, Zap, Settings, LogOut,
  Shield, X, Star
} from 'lucide-react';
import { useAuth } from '../App';
import { db, adminHelpers } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useSeasonStore } from '../store/seasonStore';
import { motion, AnimatePresence } from 'framer-motion';
import { prefetchRoute } from '../lib/prefetch';

// =============================================================================
// TYPES
// =============================================================================

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

interface UserProfile {
  displayName?: string;
  xpLevel?: number;
  xp?: number;
  corpsCoin?: number;
  avatar?: string;
}

// =============================================================================
// CONSTANTS - Simplified to 5 main items
// =============================================================================

const mainNavItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/schedule', label: 'Schedule', icon: Calendar },
  { path: '/scores', label: 'Scores', icon: Trophy },
  { path: '/leagues', label: 'Leagues', icon: Users },
  { path: '/profile', label: 'Profile', icon: User },
];

// =============================================================================
// COMPONENT
// =============================================================================

const GamingHeader: React.FC = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Use global season store
  const seasonData = useSeasonStore((state) => state.seasonData);

  useEffect(() => {
    if (user) {
      // Subscribe to profile updates
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      const unsubscribe = onSnapshot(profileRef, (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
      });

      // Check admin status
      adminHelpers.isAdmin().then(setIsAdmin);

      return () => unsubscribe();
    }
  }, [user]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

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

  // Calculate XP progress percentage
  const xpProgress = profile?.xp ? ((profile.xp % 1000) / 1000) * 100 : 0;

  return (
    <>
      {/* Main Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        {/* Subtle golden gradient line at top */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />

        <div className="h-16 px-4 lg:px-6">
          <div className="flex items-center justify-between h-full max-w-[1920px] mx-auto">
            {/* Left Section - Logo + Brand */}
            <Link to="/dashboard" className="flex items-center gap-2 group">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-lg overflow-hidden transition-all duration-300">
                  <img
                    src="/logo192.webp"
                    alt="marching.art"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              {/* Brand text - visible on all screens */}
              <div className="flex flex-col">
                <h1 className="text-base sm:text-lg font-display font-bold tracking-tight leading-tight">
                  <span className="text-yellow-400">marching</span>
                  <span className="text-yellow-50/90">.art</span>
                </h1>
                {/* Season subtitle - desktop only */}
                <p className="hidden sm:block text-[9px] text-yellow-50/40 uppercase tracking-wider -mt-0.5">
                  {seasonData?.name?.replace(/_/g, ' ') || 'Fantasy Drum Corps'}
                </p>
              </div>
            </Link>

            {/* Center Section - Main Navigation (Desktop) */}
            <nav className="hidden lg:flex items-center gap-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onMouseEnter={() => prefetchRoute(item.path)}
                    onFocus={() => prefetchRoute(item.path)}
                    className={`
                      relative flex items-center gap-2 px-4 py-2.5 rounded-lg font-display font-semibold text-sm uppercase tracking-wide
                      transition-all duration-300 group
                      ${active
                        ? 'text-yellow-400'
                        : 'text-yellow-50/80 hover:text-yellow-50'
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 transition-all duration-300 ${active ? 'text-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]' : 'text-yellow-50/60 group-hover:text-yellow-50/80'}`} />
                    <span className={active ? 'drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]' : ''}>{item.label}</span>
                    {/* Active indicator */}
                    {active && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute -bottom-1 left-3 right-3 h-[3px] rounded-full bg-gradient-to-r from-yellow-500/80 via-yellow-400 to-yellow-500/80 shadow-[0_0_12px_rgba(234,179,8,0.6)]"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}

              {/* Admin Link (Desktop) */}
              {isAdmin && (
                <Link
                  to="/admin"
                  className={`
                    relative flex items-center gap-2 px-4 py-2.5 rounded-lg font-display font-semibold text-sm uppercase tracking-wide
                    transition-all duration-300
                    ${isActive('/admin')
                      ? 'text-yellow-400'
                      : 'text-yellow-50/60 hover:text-yellow-50'
                    }
                  `}
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin</span>
                </Link>
              )}
            </nav>

            {/* Right Section - User Stats */}
            <div className="flex items-center gap-2">
              {/* Level & Coins (Desktop) */}
              {profile && (
                <Link
                  to="/profile"
                  className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl hover:border-yellow-500/30 transition-all duration-300"
                >
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <span className="font-data font-bold text-yellow-400 text-sm">
                      {profile.xpLevel || 1}
                    </span>
                  </div>
                  <div className="w-px h-4 bg-white/20" />
                  <div className="flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-yellow-400" />
                    <span className="font-data font-bold text-yellow-400 text-sm">
                      {(profile.corpsCoin || 0).toLocaleString()}
                    </span>
                  </div>
                </Link>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-all duration-300"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6 text-yellow-50/80" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 lg:hidden"
            />

            {/* Menu Panel */}
            <motion.nav
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-slate-950/95 backdrop-blur-xl border-l border-white/10 z-50 lg:hidden overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-xl font-display font-bold text-yellow-50">Menu</h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-all duration-300"
                >
                  <X className="w-5 h-5 text-yellow-50/80" />
                </button>
              </div>

              {/* User Info */}
              {profile && (
                <div className="p-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.3)]">
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
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        <span className="flex items-center gap-1 text-yellow-50/60">
                          <Zap className="w-3 h-3 text-yellow-400" />
                          Level {profile.xpLevel || 1}
                        </span>
                        <span className="flex items-center gap-1 text-yellow-400 font-data font-bold">
                          <Coins className="w-3 h-3" />
                          {(profile.corpsCoin || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="py-4">
                {mainNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onMouseEnter={() => prefetchRoute(item.path)}
                      onFocus={() => prefetchRoute(item.path)}
                      className={`
                        flex items-center gap-3 px-4 py-3 transition-all duration-200
                        ${active
                          ? 'text-yellow-400 bg-yellow-500/10 border-l-2 border-yellow-500'
                          : 'text-yellow-50/70 hover:text-yellow-50 hover:bg-white/5 border-l-2 border-transparent'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}

                {/* Settings is now integrated into Profile page */}

                {/* Admin (if applicable) */}
                {isAdmin && (
                  <Link
                    to="/admin"
                    onMouseEnter={() => prefetchRoute('/admin')}
                    onFocus={() => prefetchRoute('/admin')}
                    className={`
                      flex items-center gap-3 px-4 py-3 transition-all duration-200
                      ${isActive('/admin')
                        ? 'text-yellow-400 bg-yellow-500/10 border-l-2 border-yellow-500'
                        : 'text-yellow-50/70 hover:text-yellow-50 hover:bg-white/5 border-l-2 border-transparent'
                      }
                    `}
                  >
                    <Shield className="w-5 h-5" />
                    <span className="font-medium">Admin Panel</span>
                  </Link>
                )}
              </div>

              {/* Sign Out */}
              <div className="p-4 border-t border-white/10">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:text-red-300 hover:bg-red-500/15 transition-all duration-300"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>

              {/* Season Info */}
              {seasonData && (
                <div className="p-4 border-t border-white/10 bg-gradient-to-r from-yellow-500/10 to-transparent">
                  <div className="text-center">
                    <p className="text-xs text-yellow-50/70 uppercase tracking-wider">Current Season</p>
                    <p className="text-lg font-display font-bold text-yellow-400 mt-1 capitalize">
                      {seasonData.name?.replace(/_/g, ' ') || 'No Active Season'}
                    </p>
                  </div>
                </div>
              )}
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* Spacer for fixed header */}
      <div className="h-[68px]" />
    </>
  );
};

export default GamingHeader;
