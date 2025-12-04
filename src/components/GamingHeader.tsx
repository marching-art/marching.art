// =============================================================================
// GAMING HEADER COMPONENT (TypeScript)
// =============================================================================
// Global top navigation bar with sports gaming aesthetic
// Replaces the sidebar navigation with a persistent header

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Calendar, ShoppingCart, Users, Crown,
  User, Menu, ChevronDown, Coins, Zap,
  Trophy, Settings, LogOut, Sun, Moon, HelpCircle,
  Award, Shield, X, Star
} from 'lucide-react';
import { useAuth } from '../App';
import { useTheme } from '../context/ThemeContext';
import { db, adminHelpers } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useSeasonStore } from '../store/seasonStore';
import { motion, AnimatePresence } from 'framer-motion';

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
// CONSTANTS
// =============================================================================

const mainNavItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/schedule', label: 'Schedule', icon: Calendar },
  { path: '/staff', label: 'Market', icon: ShoppingCart },
  { path: '/leagues', label: 'Leagues', icon: Users },
  { path: '/battlepass', label: 'Season Pass', icon: Crown },
];

const moreNavItems: NavItem[] = [
  { path: '/scores', label: 'Scores', icon: Trophy },
  { path: '/hall-of-champions', label: 'Hall of Champions', icon: Award },
  { path: '/how-to-play', label: 'How to Play', icon: HelpCircle },
];

const accountNavItems: NavItem[] = [
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/settings', label: 'Settings', icon: Settings },
];

// =============================================================================
// COMPONENT
// =============================================================================

const GamingHeader: React.FC = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setMoreDropdownOpen(false);
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setMoreDropdownOpen(false);
    setProfileDropdownOpen(false);
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

  const isActive = (path: string) => location.pathname === path;

  // Calculate XP progress percentage
  const xpProgress = profile?.xp ? ((profile.xp % 1000) / 1000) * 100 : 0;

  return (
    <>
      {/* Main Header - Sleek Dark Glass Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        {/* Subtle golden gradient line at top */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />

        <div className="h-16 px-4 lg:px-6">
          <div className="flex items-center justify-between h-full max-w-[1920px] mx-auto">
            {/* Left Section - Glowing Gold Logo */}
            <Link to="/dashboard" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.25)] group-hover:shadow-[0_0_30px_rgba(234,179,8,0.4)] transition-all duration-300">
                  <img
                    src="/logo192.webp"
                    alt="marching.art"
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Pulsing indicator */}
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.8)] animate-pulse" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-display font-bold tracking-tight drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]">
                  <span className="text-yellow-400">Marching</span>
                  <span className="text-yellow-50/90">.art</span>
                </h1>
                {seasonData && (
                  <p className="text-[10px] text-yellow-50/40 uppercase tracking-wider -mt-1">
                    {seasonData.name?.replace(/_/g, ' ') || 'Fantasy Drum Corps'}
                  </p>
                )}
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
                    {/* Active under-glow indicator */}
                    {active && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute -bottom-1 left-3 right-3 h-[3px] rounded-full bg-gradient-to-r from-yellow-500/80 via-yellow-400 to-yellow-500/80 shadow-[0_0_12px_rgba(234,179,8,0.6),0_0_20px_rgba(234,179,8,0.3)]"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                    {/* Hover indicator for inactive links */}
                    {!active && (
                      <div className="absolute -bottom-1 left-3 right-3 h-[2px] rounded-full bg-yellow-50/0 group-hover:bg-yellow-50/20 transition-all duration-300" />
                    )}
                    {item.label === 'Season Pass' && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.7)] animate-pulse" />
                    )}
                  </Link>
                );
              })}

              {/* More Dropdown */}
              <div className="relative dropdown-container">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMoreDropdownOpen(!moreDropdownOpen);
                    setProfileDropdownOpen(false);
                  }}
                  className={`
                    flex items-center gap-1 px-3 py-2 rounded-lg font-display font-semibold text-sm uppercase tracking-wide
                    transition-all duration-300
                    ${moreDropdownOpen ? 'text-yellow-400 bg-yellow-500/10' : 'text-yellow-50/60 hover:text-yellow-50'}
                  `}
                >
                  <span>More</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${moreDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {moreDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full right-0 mt-2 w-56 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
                    >
                      {moreNavItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`
                              flex items-center gap-3 px-4 py-2.5 text-sm font-medium
                              transition-all duration-200
                              ${isActive(item.path)
                                ? 'text-yellow-400 bg-yellow-500/10'
                                : 'text-yellow-50/70 hover:text-yellow-50 hover:bg-white/5'
                              }
                            `}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                      {isAdmin && (
                        <>
                          <div className="my-2 border-t border-white/10" />
                          <Link
                            to="/admin"
                            className={`
                              flex items-center gap-3 px-4 py-2.5 text-sm font-medium
                              transition-all duration-200
                              ${isActive('/admin')
                                ? 'text-yellow-400 bg-yellow-500/10'
                                : 'text-yellow-50/70 hover:text-yellow-50 hover:bg-white/5'
                              }
                            `}
                          >
                            <Shield className="w-4 h-4" />
                            <span>Admin Panel</span>
                          </Link>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </nav>

            {/* Right Section - Player Stats HUD */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Glowing Game Stats Module */}
              {profile && (
                <div className="hidden sm:flex items-center gap-1.5 px-1.5 py-1 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.3)]">
                  {/* Level Stat */}
                  <Link
                    to="/profile"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/20 hover:border-yellow-500/40 hover:shadow-[0_0_15px_rgba(234,179,8,0.25)] transition-all duration-300 group"
                  >
                    <div className="relative">
                      <Zap className="w-4 h-4 text-yellow-400 drop-shadow-[0_0_4px_rgba(234,179,8,0.6)]" />
                      <div className="absolute inset-0 animate-ping opacity-30">
                        <Zap className="w-4 h-4 text-yellow-400" />
                      </div>
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-[9px] text-yellow-50/50 uppercase tracking-wider leading-none">Level</span>
                      <span className="font-data font-bold text-yellow-400 text-sm leading-none drop-shadow-[0_0_6px_rgba(234,179,8,0.4)]">
                        {profile.xpLevel || 1}
                      </span>
                    </div>
                    {/* XP micro progress */}
                    <div className="w-12 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 shadow-[0_0_8px_rgba(234,179,8,0.6)] transition-all duration-500"
                        style={{ width: `${xpProgress}%` }}
                      />
                    </div>
                  </Link>

                  {/* Divider */}
                  <div className="w-px h-8 bg-gradient-to-b from-transparent via-white/20 to-transparent" />

                  {/* Currency Stat */}
                  <Link
                    to="/profile"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-yellow-500/15 to-amber-600/10 border border-yellow-500/15 hover:border-yellow-500/40 hover:shadow-[0_0_15px_rgba(234,179,8,0.25)] transition-all duration-300 group"
                  >
                    <div className="relative">
                      <Coins className="w-4 h-4 text-yellow-400 drop-shadow-[0_0_4px_rgba(234,179,8,0.6)]" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-[9px] text-yellow-50/50 uppercase tracking-wider leading-none">Corps Coin</span>
                      <span className="font-data font-bold text-yellow-400 text-sm leading-none drop-shadow-[0_0_6px_rgba(234,179,8,0.4)]">
                        {(profile.corpsCoin || 0).toLocaleString()}
                      </span>
                    </div>
                  </Link>
                </div>
              )}

              {/* Profile Dropdown (Desktop) */}
              <div className="relative dropdown-container hidden lg:block">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setProfileDropdownOpen(!profileDropdownOpen);
                    setMoreDropdownOpen(false);
                  }}
                  className="flex items-center gap-2 p-1.5 rounded-xl bg-black/30 border border-white/10 hover:border-yellow-500/30 hover:shadow-[0_0_20px_rgba(234,179,8,0.15)] transition-all duration-300 group"
                >
                  <div className="relative">
                    <div className="w-9 h-9 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center border border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.35)] group-hover:shadow-[0_0_20px_rgba(234,179,8,0.5)] transition-all duration-300">
                      <User className="w-5 h-5 text-slate-900" />
                    </div>
                    {(profile?.xpLevel ?? 0) >= 10 && (
                      <Star className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.8)]" />
                    )}
                    {/* Online indicator */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-950 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  </div>
                  <ChevronDown className={`w-4 h-4 text-yellow-50/60 transition-transform duration-300 ${profileDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {profileDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full right-0 mt-2 w-64 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
                    >
                      {/* User Info */}
                      <div className="px-4 py-3 border-b border-white/10">
                        <p className="font-semibold text-yellow-50 truncate">
                          {profile?.displayName || 'Director'}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-yellow-50/60">
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-yellow-400" />
                            Level {profile?.xpLevel || 1}
                          </span>
                          <span className="flex items-center gap-1 text-yellow-400">
                            <Coins className="w-3 h-3" />
                            {(profile?.corpsCoin || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Account Links */}
                      {accountNavItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`
                              flex items-center gap-3 px-4 py-2.5 text-sm font-medium
                              transition-all duration-200
                              ${isActive(item.path)
                                ? 'text-yellow-400 bg-yellow-500/10'
                                : 'text-yellow-50/70 hover:text-yellow-50 hover:bg-white/5'
                              }
                            `}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}

                      <div className="my-2 border-t border-white/10" />

                      {/* Theme Toggle */}
                      <button
                        onClick={toggleTheme}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-yellow-50/70 hover:text-yellow-50 hover:bg-white/5 transition-all duration-200"
                      >
                        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                      </button>

                      {/* Sign Out */}
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

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

            {/* Menu Panel - Glassmorphism */}
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
                        <Star className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_4px_rgba(234,179,8,0.6)]" />
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

                  {/* XP Progress Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-yellow-50/60 mb-1">
                      <span>XP Progress</span>
                      <span className="font-data">{Math.round(xpProgress)}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.5)] transition-all duration-500"
                        style={{ width: `${xpProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Sections */}
              <div className="py-4">
                {/* Main Nav */}
                <div className="mb-4">
                  <h3 className="px-4 mb-2 text-xs font-semibold text-yellow-50/40 uppercase tracking-wider">
                    Main
                  </h3>
                  {mainNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`
                          flex items-center gap-3 px-4 py-3 transition-all duration-200
                          ${active
                            ? 'text-yellow-400 bg-yellow-500/10 border-l-2 border-yellow-500 shadow-[inset_0_0_20px_rgba(234,179,8,0.1)]'
                            : 'text-yellow-50/70 hover:text-yellow-50 hover:bg-white/5 border-l-2 border-transparent'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>

                {/* More Nav */}
                <div className="mb-4">
                  <h3 className="px-4 mb-2 text-xs font-semibold text-yellow-50/40 uppercase tracking-wider">
                    More
                  </h3>
                  {moreNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`
                          flex items-center gap-3 px-4 py-3 transition-all duration-200
                          ${active
                            ? 'text-yellow-400 bg-yellow-500/10 border-l-2 border-yellow-500 shadow-[inset_0_0_20px_rgba(234,179,8,0.1)]'
                            : 'text-yellow-50/70 hover:text-yellow-50 hover:bg-white/5 border-l-2 border-transparent'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                  {isAdmin && (
                    <Link
                      to="/admin"
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

                {/* Account Nav */}
                <div className="mb-4">
                  <h3 className="px-4 mb-2 text-xs font-semibold text-yellow-50/40 uppercase tracking-wider">
                    Account
                  </h3>
                  {accountNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
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
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="p-4 border-t border-white/10 space-y-3">
                {/* Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 text-yellow-50/80 hover:text-yellow-50 hover:bg-white/15 transition-all duration-300"
                >
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  <span className="font-medium">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                </button>

                {/* Sign Out */}
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
                    <p className="text-xs text-yellow-50/50 uppercase tracking-wider">Current Season</p>
                    <p className="text-lg font-display font-bold text-yellow-400 mt-1 capitalize drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]">
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
